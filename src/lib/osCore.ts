/**
 * The OS's day math, shared by the app and the bot function (netlify/) so a
 * bot and your screen always agree on what "today's non-negotiables", "a
 * 100% day", a streak and a week's summary mean.
 *
 * Pure on purpose: no React, no browser storage, and every date is a plain
 * YYYY-MM-DD string. The caller decides what "today" is — your phone's day in
 * the app, BOT_TIMEZONE's day on the server — and everything here agrees.
 */

export type Scope = 'week' | 'weekend' | 'all'
export type NonNeg = { id: string; text: string; scope?: Scope }
/** home.nonneg.history: which non-negotiables were done that day, and how many applied. */
export type HistDay = { done: string[]; total: number }
export type BoardItem = { id: string; text: string; done?: boolean; completedAt?: number; urgent?: boolean; company?: string; desc?: string; notes?: string }
export type Area = 'casa' | 'trabajo' | 'salud' | 'familia'
export type Score = { done: number; total: number; percent: number }

export const AREAS: Area[] = ['casa', 'trabajo', 'salud', 'familia']
export const WDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// ── Dates as strings ────────────────────────────────────────────────────────

export const addDaysISO = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** Mon=0 … Sun=6, the way the week boards count. */
export const weekdayIndex = (iso: string): number => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7
export const mondayOf = (iso: string): string => addDaysISO(iso, -weekdayIndex(iso))
export const weekdayName = (iso: string): string => WDAYS[weekdayIndex(iso)]

// ── Non-negotiables ─────────────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** home.nonneg as stored, keeping only well-formed entries. */
export const nonNegList = (raw: unknown): NonNeg[] =>
  (Array.isArray(raw) ? raw : []).filter((n): n is NonNeg => isObj(n) && typeof n.id === 'string' && typeof n.text === 'string')

/** Weekday ones on weekdays, weekend ones on weekends, every-day ones always. */
export const appliesOn = (n: NonNeg, iso: string): boolean => {
  const s = n.scope ?? 'all'
  return s === 'all' || s === (weekdayIndex(iso) >= 5 ? 'weekend' : 'week')
}
export const nonNegsOn = (list: NonNeg[], iso: string): NonNeg[] => list.filter((n) => appliesOn(n, iso))

/** How much of a day's list is ticked. 0% when nothing applies. */
export function dayScore(list: NonNeg[], iso: string, doneIds: string[]): Score {
  const due = nonNegsOn(list, iso)
  const done = due.filter((n) => doneIds.includes(n.id)).length
  return { done, total: due.length, percent: due.length ? Math.round((done / due.length) * 100) : 0 }
}

/** A past day as the history recorded it (the same reading the weekly report uses). */
export function historyScore(h: HistDay | undefined): Score | null {
  if (!h || !Array.isArray(h.done)) return null
  const done = new Set(h.done).size
  const total = h.total || 0
  return { done, total, percent: total ? Math.min(100, Math.round((done / total) * 100)) : 0 }
}

export const isPerfect = (s: Score | null): boolean => !!s && s.total > 0 && s.done >= s.total

/**
 * Days in a row at 100%. Today joins the run once it's perfect; until then
 * the current streak is the run that ended yesterday, so it doesn't drop to
 * zero every morning.
 */
export function streaks(history: Record<string, HistDay>, today: string, todayScore: Score): { current: number; best: number } {
  const perfect = new Set(Object.keys(history).filter((d) => d < today && isPerfect(historyScore(history[d]))))
  if (isPerfect(todayScore)) perfect.add(today)

  let current = 0
  for (let d = perfect.has(today) ? today : addDaysISO(today, -1); perfect.has(d); d = addDaysISO(d, -1)) current++

  let best = 0
  let run = 0
  let prev = ''
  for (const d of [...perfect].sort()) {
    run = prev && addDaysISO(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return { current, best }
}

// ── Week boards ─────────────────────────────────────────────────────────────

const boardItems = (raw: unknown): BoardItem[] => {
  if (!isObj(raw)) return []
  const ok = (i: unknown): i is BoardItem => isObj(i) && typeof i.id === 'string' && typeof i.text === 'string'
  const backlog = Array.isArray(raw.backlog) ? raw.backlog.filter(ok) : []
  const weeks = isObj(raw.weeks) ? Object.values(raw.weeks) : []
  return [...backlog, ...weeks.flatMap((w) => (isObj(w) ? Object.values(w) : []).flatMap((d) => (Array.isArray(d) ? d.filter(ok) : [])))]
}

/** One day's column of a week board — what Home's focus cards show. */
export function boardDay(raw: unknown, iso: string): BoardItem[] {
  const weeks = isObj(raw) && isObj(raw.weeks) ? raw.weeks : {}
  const week = weeks[mondayOf(iso)]
  const items = isObj(week) ? week[weekdayName(iso)] : undefined
  return Array.isArray(items) ? items.filter((i): i is BoardItem => isObj(i) && typeof i.id === 'string' && typeof i.text === 'string') : []
}

// ── The week in review ──────────────────────────────────────────────────────

export type DoneEntry = { title: string; area: Area; date: string; source: 'board' | 'bot' }
export type WeekDay = { date: string; weekday: string; done: number; total: number; percent: number | null }
export type WeekSummary = {
  week_start: string
  week_end: string
  by_area: Record<Area, { count: number; items: DoneEntry[] }>
  non_negotiables: WeekDay[]
  /** Average of the days so far (today included). */
  average_percent: number | null
}

/**
 * What got done in the week starting `weekStart` (a Monday), by area — your
 * Home and Work boards plus tasks bots left you — and how each day's
 * non-negotiables went. `dayOf` turns a completion time into a local day.
 */
export function weekSummary(input: {
  weekStart: string
  today: string
  nonNegs: NonNeg[]
  history: Record<string, HistDay>
  todayDone: string[]
  homeBoard: unknown
  workBoard: unknown
  botDone: { title: string; area: string; done_at: string | null }[]
  dayOf: (ms: number) => string
}): WeekSummary {
  const { weekStart, today } = input
  const weekEnd = addDaysISO(weekStart, 6)
  const inWeek = (d: string) => d >= weekStart && d <= weekEnd

  const by_area = Object.fromEntries(AREAS.map((a) => [a, { count: 0, items: [] as DoneEntry[] }])) as WeekSummary['by_area']
  const add = (e: DoneEntry) => { by_area[e.area].items.push(e); by_area[e.area].count++ }

  for (const [raw, area] of [[input.homeBoard, 'casa'], [input.workBoard, 'trabajo']] as const) {
    for (const i of boardItems(raw)) {
      if (!i.done || typeof i.completedAt !== 'number') continue
      const date = input.dayOf(i.completedAt)
      if (inWeek(date)) add({ title: i.text, area, date, source: 'board' })
    }
  }
  for (const b of input.botDone) {
    const ms = b.done_at ? Date.parse(b.done_at) : NaN
    if (Number.isNaN(ms) || !(AREAS as string[]).includes(b.area)) continue
    const date = input.dayOf(ms)
    if (inWeek(date)) add({ title: b.title, area: b.area as Area, date, source: 'bot' })
  }
  for (const a of AREAS) by_area[a].items.sort((x, y) => x.date.localeCompare(y.date))

  const non_negotiables: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysISO(weekStart, i)
    const weekday = WDAYS[i]
    if (date > today) return { date, weekday, done: 0, total: 0, percent: null }
    const s = date === today
      ? dayScore(input.nonNegs, today, input.todayDone)
      : historyScore(input.history[date]) ?? { done: 0, total: nonNegsOn(input.nonNegs, date).length, percent: 0 }
    return { date, weekday, ...s }
  })
  const sofar = non_negotiables.filter((d) => d.percent !== null)
  const average_percent = sofar.length ? Math.round(sofar.reduce((s, d) => s + (d.percent ?? 0), 0) / sofar.length) : null

  return { week_start: weekStart, week_end: weekEnd, by_area, non_negotiables, average_percent }
}

/** week.priorities: your 3 priorities, keyed by the Monday of the week they're for. */
export type Priorities = Record<string, string[]>
export const prioritiesFor = (raw: unknown, weekStart: string): string[] => {
  const v = isObj(raw) ? raw[weekStart] : undefined
  return Array.isArray(v) ? v.filter((p): p is string => typeof p === 'string' && p.trim() !== '').slice(0, 3) : []
}
