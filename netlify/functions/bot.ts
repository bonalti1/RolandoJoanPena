/**
 * Bot API — lets your AI bots read and write a small, safe slice of the OS.
 *
 * One endpoint (/.netlify/functions/bot), one key. Every call is a POST with a
 * JSON body naming an `action`, and must carry
 * `Authorization: Bearer <BOT_API_KEY>`. docs/BOT_API.md has every action with
 * curl examples.
 *
 * What a bot can touch:
 *  • os_items — tasks bots leave you: add (any area, or a home task), list,
 *    mark done.
 *  • os_nonneg_marks — tick one of TODAY's existing non-negotiables.
 *  • app_state — READ ONLY: today's non-negotiables and whether they're
 *    ticked, today's home and work tasks. This function never writes
 *    app_state. The app on your devices stays its only writer, so a bot can't
 *    overwrite an edit you're making with the app open; a bot's tick waits in
 *    os_nonneg_marks and the app folds it into your checklist itself.
 *
 * It talks to Supabase with the service key, which bypasses Row Level
 * Security — so every query below is pinned to BOT_USER_ID. Keys come from the
 * environment only; nothing secret is written in code or sent to a browser.
 *
 * Netlify environment variables:
 *   BOT_API_KEY                – the key your bots send (long and random)
 *   SUPABASE_SERVICE_ROLE_KEY  – Supabase secret / service_role key
 *   BOT_USER_ID                – your Supabase user id (Authentication → Users)
 * Optional:
 *   SUPABASE_URL               – defaults to VITE_SUPABASE_URL
 *   BOT_TIMEZONE               – what "today" means; defaults to America/Chicago
 */
import { createHash, timingSafeEqual } from 'node:crypto'

type Json = Record<string, unknown>

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public extra?: Json) {
    super(message)
  }
}

// ── Config ──────────────────────────────────────────────────────────────────

type Config = { url: string; service: string; owner: string; tz: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** The service key only ever travels over https (plain http just for a local Supabase). */
const SAFE_URL = /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$))/

/** The public anon/publishable key pasted by mistake would quietly read nothing (RLS). */
function isPublicKey(key: string): boolean {
  if (key.startsWith('sb_publishable_') || key === (process.env.VITE_SUPABASE_ANON_KEY || '').trim()) return true
  try { return JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()).role === 'anon' } catch { return false }
}

function readConfig(): Config {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const owner = (process.env.BOT_USER_ID || '').trim()
  const tz = (process.env.BOT_TIMEZONE || '').trim() || 'America/Chicago'
  const missing = [
    !SAFE_URL.test(url) && 'SUPABASE_URL',
    (!service || isPublicKey(service)) && 'SUPABASE_SERVICE_ROLE_KEY',
    !UUID.test(owner) && 'BOT_USER_ID',
  ].filter(Boolean)
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }) } catch { missing.push('BOT_TIMEZONE') }
  if (missing.length) {
    throw new ApiError(503, 'not_configured', `The bot API is missing or has an invalid: ${missing.join(', ')}.`)
  }
  return { url, service, owner, tz }
}

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

// ── Supabase (PostgREST) ────────────────────────────────────────────────────

async function db<T>(cfg: Config, method: 'GET' | 'POST' | 'PATCH', table: string,
  params: Record<string, string>, body?: unknown, prefer?: string): Promise<T[]> {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${cfg.url}/rest/v1/${table}${qs ? `?${qs}` : ''}`, {
    method,
    headers: {
      apikey: cfg.service,
      Authorization: `Bearer ${cfg.service}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.ok) return res.status === 204 ? [] : ((await res.json()) as T[])

  // Log the database's error code only — its `details` can echo row values.
  let code = ''
  let message = ''
  try { const e = (await res.json()) as { code?: string; message?: string }; code = e.code ?? ''; message = e.message ?? '' } catch { /* not JSON */ }
  console.error(`bot: ${method} ${table} → ${res.status} ${code} ${message}`.trim())
  // PostgREST answers 404 only when the table itself is missing (no rows is a 200).
  if (res.status === 404 || code === 'PGRST205' || code === '42P01') {
    throw new ApiError(503, 'not_set_up', `Supabase has no "${table}" table yet — run the os_items migration (docs/BOT_API.md).`)
  }
  if (res.status === 401 || res.status === 403 || code === '42501') {
    throw new ApiError(503, 'not_configured', 'Supabase refused SUPABASE_SERVICE_ROLE_KEY — it must be the secret / service_role key.')
  }
  throw new ApiError(502, 'database_error', 'The database did not accept the request.')
}

/** Read-only peek at a few of your app_state keys. */
async function readState(cfg: Config, keys: string[]): Promise<Record<string, unknown>> {
  const rows = await db<{ key: string; value: unknown }>(cfg, 'GET', 'app_state', {
    select: 'key,value',
    user_id: `eq.${cfg.owner}`,
    key: `in.(${keys.map((k) => `"${k}"`).join(',')})`,
  })
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

// ── Dates — "today" is the owner's day, not the server's ────────────────────

const WDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const dayIn = (tz: string, at: Date = new Date()): string => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at)
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}
const addDaysISO = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** Mon=0 … Sun=6, the way the app's week boards count. */
const weekdayIndex = (iso: string): number => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7

type Today = { date: string; weekday: string; weekKey: string; weekend: boolean }
function today(tz: string): Today {
  const date = dayIn(tz)
  const i = weekdayIndex(date)
  return { date, weekday: WDAYS[i], weekKey: addDaysISO(date, -i), weekend: i >= 5 }
}

// ── Your data, as the app stores it ─────────────────────────────────────────

type NonNeg = { id: string; text: string; scope?: 'week' | 'weekend' | 'all' }
type BoardItem = { id: string; text: string; done?: boolean; urgent?: boolean; company?: string; desc?: string; notes?: string }
type Mark = { nonneg_id: string; bot: string }

const ITEM_COLS = 'id,title,notes,bot,area,due,priority,status,done_at,created_at'
type Item = { id: string; title: string; notes: string; bot: string; area: string; due: string | null; priority: string; status: string; done_at: string | null; created_at: string }

const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)

/** Non-negotiables that apply on this day, exactly as Home picks them. */
function todaysNonNegs(state: Record<string, unknown>, t: Today): NonNeg[] {
  const list = Array.isArray(state['home.nonneg']) ? state['home.nonneg'] : []
  return list
    .filter((n): n is NonNeg => isObj(n) && typeof n.id === 'string' && typeof n.text === 'string')
    .filter((n) => { const s = n.scope ?? 'all'; return s === 'all' || s === (t.weekend ? 'weekend' : 'week') })
}

/** What you ticked yourself in the app today. */
function appTicks(state: Record<string, unknown>, t: Today): string[] {
  const v = state['home.nonneg.today']
  return isObj(v) && v.date === t.date && Array.isArray(v.done) ? v.done.filter((x): x is string => typeof x === 'string') : []
}

/** Today's column of a week board — the same list Home's focus cards show. */
function boardToday(raw: unknown, t: Today, withCompany: boolean) {
  const weeks = isObj(raw) && isObj(raw.weeks) ? raw.weeks : {}
  const week = isObj(weeks[t.weekKey]) ? (weeks[t.weekKey] as Json) : {}
  const items = Array.isArray(week[t.weekday]) ? (week[t.weekday] as unknown[]) : []
  return items
    .filter((i): i is BoardItem => isObj(i) && typeof i.id === 'string' && typeof i.text === 'string')
    .map((i) => ({
      id: i.id,
      text: i.text,
      done: !!i.done,
      urgent: !!i.urgent && !i.done,
      ...(withCompany && i.company ? { company: i.company } : {}),
      ...(i.desc || i.notes ? { notes: i.desc || i.notes } : {}),
    }))
    .sort((a, b) => Number(a.done) - Number(b.done) || Number(b.urgent) - Number(a.urgent))
}

// ── Input ───────────────────────────────────────────────────────────────────

const AREAS: Record<string, string> = {
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

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

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

function dueDate(body: Json, t: Today): string | null {
  const v = body.due ?? body.date
  if (v === undefined || v === null || v === '') return null
  if (typeof v !== 'string') throw new ApiError(400, 'bad_date', '"due" must be YYYY-MM-DD, "today" or "tomorrow".')
  const s = fold(v)
  if (s === 'today' || s === 'hoy') return t.date
  if (s === 'tomorrow' || s === 'manana') return addDaysISO(t.date, 1)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && addDaysISO(s, 0) === s) return s
  throw new ApiError(400, 'bad_date', '"due" must be YYYY-MM-DD, "today" or "tomorrow".')
}

function newTask(body: Json, t: Today, area?: string) {
  const rawArea = area ?? (typeof body.area === 'string' ? fold(body.area) : '')
  const a = AREAS[rawArea]
  if (!a) throw new ApiError(400, 'bad_area', '"area" must be one of: casa, trabajo, salud, familia.')
  const rawPriority = typeof body.priority === 'string' ? fold(body.priority) : 'media'
  const priority = PRIORITIES[rawPriority]
  if (!priority) throw new ApiError(400, 'bad_priority', '"priority" must be one of: baja, media, alta.')
  return {
    title: text(body, 'title', 300, true),
    notes: text(body, 'notes', 5000, false),
    bot: text(body, 'bot', 60, true),
    area: a,
    due: dueDate(body, t),
    priority,
  }
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

// ── Actions ─────────────────────────────────────────────────────────────────

async function addTask(cfg: Config, body: Json, area?: string) {
  const t = today(cfg.tz)
  const [task] = await db<Item>(cfg, 'POST', 'os_items', { select: ITEM_COLS },
    [{ ...newTask(body, t, area), user_id: cfg.owner }], 'return=representation')
  return { ok: true, task }
}

async function todayView(cfg: Config) {
  const t = today(cfg.tz)
  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString()
  const [state, items, marks] = await Promise.all([
    readState(cfg, ['home.nonneg', 'home.nonneg.today', 'work.home', 'work.work']),
    db<Item>(cfg, 'GET', 'os_items', {
      select: ITEM_COLS,
      user_id: `eq.${cfg.owner}`,
      or: `(status.eq.abierta,due.eq.${t.date},done_at.gte."${since}")`,
      order: 'due.asc.nullslast,created_at.asc',
    }),
    db<Mark>(cfg, 'GET', 'os_nonneg_marks', { select: 'nonneg_id,bot', user_id: `eq.${cfg.owner}`, day: `eq.${t.date}` }),
  ])

  const ticked = appTicks(state, t)
  const botTick = new Map(marks.map((m) => [m.nonneg_id, m.bot]))
  return {
    ok: true,
    date: t.date,
    weekday: t.weekday,
    timezone: cfg.tz,
    // Open ones, plus anything due today or finished today.
    bot_tasks: items.filter((i) => i.status === 'abierta' || i.due === t.date || (i.done_at && dayIn(cfg.tz, new Date(i.done_at)) === t.date)),
    non_negotiables: todaysNonNegs(state, t).map((n) => ({
      id: n.id,
      text: n.text,
      done: ticked.includes(n.id) || botTick.has(n.id),
      marked_by_bot: botTick.get(n.id) ?? null,
    })),
    home_tasks: boardToday(state['work.home'], t, false),
    work_tasks: boardToday(state['work.work'], t, true),
  }
}

async function completeTask(cfg: Config, body: Json) {
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  if (!UUID.test(id)) throw new ApiError(400, 'bad_id', '"id" must be a task id from add_task or today.')
  const [task] = await db<Item>(cfg, 'PATCH', 'os_items',
    { id: `eq.${id}`, user_id: `eq.${cfg.owner}`, select: ITEM_COLS },
    { status: 'hecha' }, 'return=representation')
  if (!task) throw new ApiError(404, 'not_found', 'No bot task with that id.')
  return { ok: true, task }
}

async function markNonNeg(cfg: Config, body: Json) {
  const bot = text(body, 'bot', 60, true)
  const t = today(cfg.tz)
  const state = await readState(cfg, ['home.nonneg', 'home.nonneg.today'])
  const list = todaysNonNegs(state, t)
  if (list.length === 0) throw new ApiError(404, 'none_today', 'No non-negotiables apply today.')
  const n = pickNonNeg(list, body)
  const result = { ok: true, date: t.date, non_negotiable: { id: n.id, text: n.text, done: true } }

  // Already ticked in the app — nothing to add.
  if (appTicks(state, t).includes(n.id)) return { ...result, already_done: true }
  const added = await db<Mark>(cfg, 'POST', 'os_nonneg_marks', { on_conflict: 'user_id,day,nonneg_id', select: 'nonneg_id,bot' },
    [{ user_id: cfg.owner, day: t.date, nonneg_id: n.id, bot }], 'resolution=ignore-duplicates,return=representation')
  return { ...result, already_done: added.length === 0 }
}

const ACTIONS: Record<string, (cfg: Config, body: Json) => Promise<unknown>> = {
  add_task: (cfg, body) => addTask(cfg, body),
  add_home_task: (cfg, body) => addTask(cfg, body, 'casa'),
  today: (cfg) => todayView(cfg),
  complete_task: completeTask,
  mark_non_negotiable: markNonNeg,
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
