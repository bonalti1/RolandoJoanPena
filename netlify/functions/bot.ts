/**
 * Bot API — lets your AI bots read and write a small, safe slice of the OS.
 *
 * One endpoint (/.netlify/functions/bot), one key. Every call is a POST with a
 * JSON body naming an `action`, and must carry
 * `Authorization: Bearer <BOT_API_KEY>`. docs/BOT_API.md has every action with
 * curl examples.
 *
 * What a bot can touch:
 *  • os_items — tasks bots leave you: add (any area, a home task, or one
 *    that's waiting for you — needs_me), flag/unflag needs_me, mark done.
 *  • os_events — add a dated event (school, the kids' activities).
 *  • os_nonneg_marks — tick one of TODAY's existing non-negotiables, by hand
 *    or from today's Strava workouts.
 *  • os_bot_activity — set_status: a bot says what it's doing (Oficina tab).
 *  • app_state — READ ONLY: today's non-negotiables and your streak, today's
 *    home and work tasks, the week's summary and your 3 priorities. This
 *    function never writes app_state. The app on your devices stays its only
 *    writer, so a bot can't overwrite an edit you're making with the app open.
 *
 * Shared plumbing (keys, Supabase, "today" in your timezone) lives in
 * netlify/lib/server.ts; the day math is src/lib/osCore.ts, the same code
 * the app runs.
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import {
  addDaysISO, appliesOn, AREAS, boardDay, dayScore, mondayOf, nonNegList, nonNegsOn, prioritiesFor, streaks, weekSummary,
  type Area, type HistDay, type NonNeg,
} from '../../src/lib/osCore'
import {
  ApiError, appTicks, dayIn, db, fold, isObj, json, nonNegsToday, readConfig, readState, tickNonNeg, today, UUID,
  type Config, type Json, type Mark, type Today,
} from '../lib/server'
import { stravaEnv, syncStrava } from '../lib/strava'

/** Constant-time key check (hashing first also hides the key's length). */
function keyMatches(given: string, expected: string): boolean {
  const h = (s: string) => createHash('sha256').update(s).digest()
  return timingSafeEqual(h(given), h(expected))
}

function presentedKey(req: Request): string {
  const auth = req.headers.get('authorization') || ''
  const bearer = /^Bearer\s+(.+)$/i.exec(auth)?.[1]
  return (bearer || req.headers.get('x-bot-key') || '').trim()
}

// ── Rows ────────────────────────────────────────────────────────────────────

const ITEM_COLS = 'id,title,notes,bot,area,due,priority,status,needs_me,done_at,created_at'
type Item = { id: string; title: string; notes: string; bot: string; area: string; due: string | null; priority: string; status: string; needs_me: boolean; done_at: string | null; created_at: string }

const EVENT_COLS = 'id,title,notes,bot,area,day,start_time,end_time,created_at'
type Event = { id: string; title: string; notes: string; bot: string; area: string; day: string; start_time: string | null; end_time: string | null; created_at: string }

// ── Input ───────────────────────────────────────────────────────────────────

const AREA_WORDS: Record<string, Area> = {
  casa: 'casa', home: 'casa', hogar: 'casa',
  trabajo: 'trabajo', work: 'trabajo', negocio: 'trabajo', business: 'trabajo',
  salud: 'salud', health: 'salud',
  familia: 'familia', family: 'familia',
}
const PRIORITIES: Record<string, string> = {
  baja: 'baja', low: 'baja',
  media: 'media', medium: 'media', normal: 'media',
  alta: 'alta', high: 'alta', urgente: 'alta', urgent: 'alta',
}

function text(body: Json, field: string, max: number, required: boolean): string {
  const v = body[field]
  if (v === undefined || v === null || v === '') {
    if (required) throw new ApiError(400, 'missing_field', `"${field}" is required.`)
    return ''
  }
  if (typeof v !== 'string') throw new ApiError(400, 'bad_field', `"${field}" must be text.`)
  const s = v.trim()
  if (required && !s) throw new ApiError(400, 'missing_field', `"${field}" is required.`)
  if (s.length > max) throw new ApiError(400, 'too_long', `"${field}" can be at most ${max} characters.`)
  return s
}

function flag(body: Json, field: string): boolean | undefined {
  const v = body[field]
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'boolean') throw new ApiError(400, 'bad_field', `"${field}" must be true or false.`)
  return v
}

/** YYYY-MM-DD, or "today"/"hoy", "tomorrow"/"mañana". */
function dateField(body: Json, fields: string[], t: Today, required: boolean): string | null {
  const name = fields[0]
  const v = fields.map((f) => body[f]).find((x) => x !== undefined && x !== null && x !== '')
  if (v === undefined) {
    if (required) throw new ApiError(400, 'missing_field', `"${name}" is required (YYYY-MM-DD, "today" or "tomorrow").`)
    return null
  }
  const s = typeof v === 'string' ? fold(v) : ''
  if (s === 'today' || s === 'hoy') return t.date
  if (s === 'tomorrow' || s === 'manana') return addDaysISO(t.date, 1)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && addDaysISO(s, 0) === s) return s
  throw new ApiError(400, 'bad_date', `"${name}" must be YYYY-MM-DD, "today" or "tomorrow".`)
}

/** "7:30", "07:30", "19:30", "7pm", "7:30 p.m." → "HH:MM" (24-hour). */
function timeField(body: Json, fields: string[]): string | null {
  const name = fields[0]
  const v = fields.map((f) => body[f]).find((x) => x !== undefined && x !== null && x !== '')
  if (v === undefined) return null
  const m = typeof v === 'string' ? /^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i.exec(v.trim()) : null
  let h = m ? Number(m[1]) : NaN
  const min = m?.[2] ? Number(m[2]) : 0
  const ap = m?.[3]?.toLowerCase().replace(/\./g, '')
  if (m && !m[2] && !ap) h = NaN                       // a bare "7" is ambiguous
  if (ap) h = h === 12 ? (ap === 'am' ? 0 : 12) : ap === 'pm' ? h + 12 : h
  if (!(h >= 0 && h <= 23 && min >= 0 && min <= 59) || (ap && Number(m![1]) > 12)) {
    throw new ApiError(400, 'bad_time', `"${name}" must be a time like "07:30", "19:30" or "7:30 pm".`)
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function areaField(body: Json, fallback?: Area): Area {
  const a = AREA_WORDS[typeof body.area === 'string' ? fold(body.area) : '']
  if (a) return a
  if (fallback && (body.area === undefined || body.area === null || body.area === '')) return fallback
  throw new ApiError(400, 'bad_area', '"area" must be one of: casa, trabajo, salud, familia.')
}

function newTask(body: Json, t: Today, area?: Area) {
  const rawPriority = typeof body.priority === 'string' ? fold(body.priority) : 'media'
  const priority = PRIORITIES[rawPriority]
  if (!priority) throw new ApiError(400, 'bad_priority', '"priority" must be one of: baja, media, alta.')
  return {
    title: text(body, 'title', 300, true),
    notes: text(body, 'notes', 5000, false),
    bot: text(body, 'bot', 60, true),
    area: area ?? areaField(body),
    due: dateField(body, ['due', 'date'], t, false),
    priority,
    needs_me: flag(body, 'needs_me') ?? false,
  }
}

const idField = (body: Json): string => {
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  if (!UUID.test(id)) throw new ApiError(400, 'bad_id', '"id" must be a task id from add_task or today.')
  return id
}

/**
 * Finds the one non-negotiable a bot means — by id, or by words ("gym").
 * Never guesses: two plausible matches come back as a question instead.
 */
function pickNonNeg(list: NonNeg[], body: Json): NonNeg {
  const options = list.map((n) => ({ id: n.id, text: n.text }))
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  if (id) {
    const hit = list.find((n) => n.id === id)
    if (!hit) throw new ApiError(404, 'not_found', 'No non-negotiable with that id applies today.', { options })
    return hit
  }
  const q = typeof body.text === 'string' ? fold(body.text) : ''
  if (!q) throw new ApiError(400, 'missing_field', 'Send "id" (from the today action) or "text", e.g. "gym".', { options })
  const exact = list.filter((n) => fold(n.text) === q)
  const partial = exact.length ? exact : list.filter((n) => fold(n.text).includes(q) || q.includes(fold(n.text)))
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) {
    throw new ApiError(409, 'ambiguous', 'More than one non-negotiable matches — send its "id".', {
      options: partial.map((n) => ({ id: n.id, text: n.text })),
    })
  }
  throw new ApiError(404, 'not_found', 'None of today\'s non-negotiables match that text.', { options })
}

// ── Your check-ins, with bot ticks the app hasn't folded in yet ─────────────

/**
 * home.nonneg.history plus bot ticks since `from` — the app folds those in
 * when it opens, but a bot asking before then should see them already.
 */
async function checkIns(cfg: Config, state: Record<string, unknown>, t: Today, from: string, to: string = t.date) {
  const marks = await db<Mark>(cfg, 'GET', 'os_nonneg_marks', {
    select: 'day,nonneg_id,bot', user_id: `eq.${cfg.owner}`, and: `(day.gte.${from},day.lte.${to})`,
  })
  const list = nonNegList(state['home.nonneg'])
  const raw = isObj(state['home.nonneg.history']) ? (state['home.nonneg.history'] as Record<string, HistDay>) : {}
  const history: Record<string, HistDay> = { ...raw }
  for (const m of marks) {
    if (m.day >= t.date || !list.some((n) => n.id === m.nonneg_id && appliesOn(n, m.day))) continue
    // A day the history holds in some other shape is left as it is, not crashed on.
    const recorded: unknown = history[m.day]
    if (recorded !== undefined && !(isObj(recorded) && Array.isArray(recorded.done))) continue
    const h = (recorded as HistDay | undefined) ?? { done: [], total: nonNegsOn(list, m.day).length }
    if (!h.done.includes(m.nonneg_id)) history[m.day] = { ...h, done: [...h.done, m.nonneg_id] }
  }
  const botToday = new Map(marks.filter((m) => m.day === t.date).map((m) => [m.nonneg_id, m.bot]))
  const todayDone = [...new Set([...appTicks(state, t), ...botToday.keys()])]
  return { list, history, todayDone, botToday }
}

// ── Actions ─────────────────────────────────────────────────────────────────

async function addTask(cfg: Config, body: Json, area?: Area) {
  const t = today(cfg.tz)
  const [task] = await db<Item>(cfg, 'POST', 'os_items', { select: ITEM_COLS },
    [{ ...newTask(body, t, area), user_id: cfg.owner }], 'return=representation')
  return { ok: true, task }
}

async function todayView(cfg: Config) {
  const t = today(cfg.tz)
  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString()
  const [state, items, events] = await Promise.all([
    readState(cfg, ['home.nonneg', 'home.nonneg.today', 'home.nonneg.history', 'work.home', 'work.work', 'week.priorities']),
    db<Item>(cfg, 'GET', 'os_items', {
      select: ITEM_COLS,
      user_id: `eq.${cfg.owner}`,
      or: `(status.eq.abierta,due.eq.${t.date},done_at.gte."${since}")`,
      order: 'due.asc.nullslast,created_at.asc',
    }),
    db<Event>(cfg, 'GET', 'os_events', { select: EVENT_COLS, user_id: `eq.${cfg.owner}`, day: `eq.${t.date}`, order: 'start_time.asc.nullsfirst' }),
  ])
  const { list, history, todayDone, botToday } = await checkIns(cfg, state, t, addDaysISO(t.date, -13))
  const score = dayScore(list, t.date, todayDone)
  const streak = streaks(history, t.date, score)
  const relevant = items.filter((i) => i.status === 'abierta' || i.due === t.date || (i.done_at && dayIn(cfg.tz, new Date(i.done_at)) === t.date))
  const board = (raw: unknown, withCompany: boolean) => boardDay(raw, t.date)
    .map((i) => ({
      id: i.id,
      text: i.text,
      done: !!i.done,
      urgent: !!i.urgent && !i.done,
      ...(withCompany && i.company ? { company: i.company } : {}),
      ...(i.desc || i.notes ? { notes: i.desc || i.notes } : {}),
    }))
    .sort((a, b) => Number(a.done) - Number(b.done) || Number(b.urgent) - Number(a.urgent))

  return {
    ok: true,
    date: t.date,
    weekday: t.weekday,
    timezone: cfg.tz,
    score: { ...score, streak: streak.current, best_streak: streak.best },
    priorities: prioritiesFor(state['week.priorities'], t.weekKey),
    // Open ones, plus anything due today or finished today.
    waiting_for_you: relevant.filter((i) => i.needs_me),
    bot_tasks: relevant.filter((i) => !i.needs_me),
    events,
    non_negotiables: nonNegsToday(state, t).map((n) => ({
      id: n.id,
      text: n.text,
      done: todayDone.includes(n.id),
      marked_by_bot: botToday.get(n.id) ?? null,
    })),
    home_tasks: board(state['work.home'], false),
    work_tasks: board(state['work.work'], true),
  }
}

async function completeTask(cfg: Config, body: Json) {
  const id = idField(body)
  const [task] = await db<Item>(cfg, 'PATCH', 'os_items',
    { id: `eq.${id}`, user_id: `eq.${cfg.owner}`, select: ITEM_COLS },
    { status: 'hecha' }, 'return=representation')
  if (!task) throw new ApiError(404, 'not_found', 'No bot task with that id.')
  return { ok: true, task }
}

async function setNeedsMe(cfg: Config, body: Json) {
  const id = idField(body)
  const needsMe = flag(body, 'needs_me')
  if (needsMe === undefined) throw new ApiError(400, 'missing_field', '"needs_me" (true or false) is required.')
  const [task] = await db<Item>(cfg, 'PATCH', 'os_items',
    { id: `eq.${id}`, user_id: `eq.${cfg.owner}`, select: ITEM_COLS },
    { needs_me: needsMe }, 'return=representation')
  if (!task) throw new ApiError(404, 'not_found', 'No bot task with that id.')
  return { ok: true, task }
}

async function markNonNeg(cfg: Config, body: Json) {
  const bot = text(body, 'bot', 60, true)
  const t = today(cfg.tz)
  const state = await readState(cfg, ['home.nonneg', 'home.nonneg.today'])
  const list = nonNegsToday(state, t)
  if (list.length === 0) throw new ApiError(404, 'none_today', 'No non-negotiables apply today.')
  const n = pickNonNeg(list, body)
  const { already_done } = await tickNonNeg(cfg, t, state, n, bot)
  return { ok: true, date: t.date, non_negotiable: { id: n.id, text: n.text, done: true }, already_done }
}

async function addEvent(cfg: Config, body: Json) {
  const t = today(cfg.tz)
  const event = {
    title: text(body, 'title', 300, true),
    notes: text(body, 'notes', 5000, false),
    bot: text(body, 'bot', 60, true),
    area: areaField(body, 'familia'),
    day: dateField(body, ['date', 'day'], t, true)!,
    start_time: timeField(body, ['start_time', 'time']),
    end_time: timeField(body, ['end_time']),
  }
  if (event.end_time && !event.start_time) throw new ApiError(400, 'bad_time', '"end_time" needs a "start_time".')
  if (event.end_time && event.start_time && event.end_time <= event.start_time) {
    throw new ApiError(400, 'bad_time', '"end_time" must be after "start_time".')
  }

  // Bots resend things. The same title at the same time on the same day is the same event.
  const sameDay = await db<Event>(cfg, 'GET', 'os_events', { select: EVENT_COLS, user_id: `eq.${cfg.owner}`, day: `eq.${event.day}` })
  const twin = sameDay.find((e) => fold(e.title) === fold(event.title) && (e.start_time ?? '') === (event.start_time ?? ''))
  if (twin) return { ok: true, event: twin, duplicate: true }

  const [saved] = await db<Event>(cfg, 'POST', 'os_events', { select: EVENT_COLS },
    [{ ...event, user_id: cfg.owner }], 'return=representation')
  return { ok: true, event: saved, duplicate: false }
}

async function weekSummaryView(cfg: Config, body: Json) {
  const t = today(cfg.tz)
  const weekStart = mondayOf(dateField(body, ['date'], t, false) ?? t.date)
  if (weekStart > t.date) throw new ApiError(400, 'bad_date', 'That week hasn\'t started yet.')
  const weekEnd = addDaysISO(weekStart, 6)
  const [state, done] = await Promise.all([
    readState(cfg, ['home.nonneg', 'home.nonneg.today', 'home.nonneg.history', 'work.home', 'work.work', 'week.priorities']),
    // A day of slack each side; the exact day is decided in your timezone below.
    db<Item>(cfg, 'GET', 'os_items', {
      select: 'title,area,done_at',
      user_id: `eq.${cfg.owner}`,
      status: 'eq.hecha',
      and: `(done_at.gte."${addDaysISO(weekStart, -1)}T00:00:00Z",done_at.lt."${addDaysISO(weekEnd, 2)}T00:00:00Z")`,
    }),
  ])
  const { list, history, todayDone } = await checkIns(cfg, state, t, weekStart, weekEnd)
  const summary = weekSummary({
    weekStart, today: t.date, nonNegs: list, history, todayDone,
    homeBoard: state['work.home'], workBoard: state['work.work'],
    botDone: done, dayOf: (ms) => dayIn(cfg.tz, new Date(ms)),
  })
  return {
    ok: true,
    ...summary,
    by_area: Object.fromEntries(AREAS.map((a) => [a, {
      count: summary.by_area[a].count,
      items: summary.by_area[a].items.map(({ title, date, source }) => ({ title, date, source })),
    }])),
    priorities: {
      this_week: prioritiesFor(state['week.priorities'], weekStart),
      next_week: prioritiesFor(state['week.priorities'], addDaysISO(weekStart, 7)),
    },
  }
}

async function syncStravaNow(cfg: Config) {
  const env = stravaEnv()
  if (!env) throw new ApiError(503, 'not_configured', 'Strava is not set up: add STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET and STRAVA_REFRESH_TOKEN.')
  return syncStrava(cfg, env)
}

const BOT_STATUSES = ['working', 'idle', 'paused']

/** A bot reports what it's doing — shown live on the Oficina tab. Insert only. */
async function setStatus(cfg: Config, body: Json) {
  const bot = text(body, 'bot', 60, true)
  const status = typeof body.status === 'string' ? body.status.trim().toLowerCase() : ''
  if (!BOT_STATUSES.includes(status)) throw new ApiError(400, 'bad_status', '"status" must be one of: working, idle, paused.')
  const activity = text(body, 'activity', 500, false)
  const [row] = await db<{ id: string; bot: string; status: string; activity: string; created_at: string }>(
    cfg, 'POST', 'os_bot_activity', { select: 'id,bot,status,activity,created_at' },
    [{ user_id: cfg.owner, bot, status, activity }], 'return=representation')
  return { ok: true, activity: row }
}

const ACTIONS: Record<string, (cfg: Config, body: Json) => Promise<unknown>> = {
  add_task: (cfg, body) => addTask(cfg, body),
  add_home_task: (cfg, body) => addTask(cfg, body, 'casa'),
  today: (cfg) => todayView(cfg),
  complete_task: completeTask,
  set_needs_me: setNeedsMe,
  mark_non_negotiable: markNonNeg,
  add_event: addEvent,
  week_summary: weekSummaryView,
  sync_strava: (cfg) => syncStravaNow(cfg),
  set_status: setStatus,
}

// ── Handler ─────────────────────────────────────────────────────────────────

export default async (req: Request): Promise<Response> => {
  try {
    if (req.method !== 'POST') throw new ApiError(405, 'method_not_allowed', 'Use POST with a JSON body.')

    const expected = (process.env.BOT_API_KEY || '').trim()
    if (expected.length < 24) throw new ApiError(503, 'not_configured', 'BOT_API_KEY is not set (or is shorter than 24 characters).')
    if (!keyMatches(presentedKey(req), expected)) throw new ApiError(401, 'unauthorized', 'Missing or wrong bot key.')

    let body: unknown
    try { body = await req.json() } catch { throw new ApiError(400, 'invalid_json', 'The body must be JSON.') }
    if (!isObj(body)) throw new ApiError(400, 'invalid_json', 'The body must be a JSON object.')

    const action = typeof body.action === 'string' ? body.action.trim() : ''
    const run = ACTIONS[action]
    if (!run) throw new ApiError(400, 'unknown_action', `"action" must be one of: ${Object.keys(ACTIONS).join(', ')}.`)

    return json(await run(readConfig(), body))
  } catch (err) {
    if (err instanceof ApiError) return json({ ok: false, error: err.code, message: err.message, ...err.extra }, err.status)
    console.error('bot: unexpected error', (err as Error)?.message)
    return json({ ok: false, error: 'server_error', message: 'Something went wrong.' }, 500)
  }
}
