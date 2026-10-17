/**
 * What the server functions share: configuration, the Supabase connection
 * and "today" in your timezone. Used by functions/bot.ts (your bots) and
 * functions/strava-sync.ts (the scheduled health sync).
 *
 * These talk to Supabase with the service key, which bypasses Row Level
 * Security — so every query is pinned to BOT_USER_ID. Keys come from the
 * environment only; nothing secret is written in code or sent to a browser.
 * And none of it ever writes app_state: the app on your devices stays its
 * only writer.
 */
import { appliesOn, mondayOf, nonNegList, weekdayName, type NonNeg } from '../../src/lib/osCore'

export type Json = Record<string, unknown>

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public extra?: Json) {
    super(message)
  }
}

export const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)
/** Lower-case, accents off — "Ejercício" and "ejercicio" match. */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// ── Config ──────────────────────────────────────────────────────────────────

export type Config = { url: string; service: string; owner: string; tz: string }

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** The service key only ever travels over https (plain http just for a local Supabase). */
const SAFE_URL = /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$))/

/** The public anon/publishable key pasted by mistake would quietly read nothing (RLS). */
function isPublicKey(key: string): boolean {
  if (key.startsWith('sb_publishable_') || key === (process.env.VITE_SUPABASE_ANON_KEY || '').trim()) return true
  try { return JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()).role === 'anon' } catch { return false }
}

export function readConfig(): Config {
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

// ── Supabase (PostgREST) ────────────────────────────────────────────────────

export async function db<T>(cfg: Config, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', table: string,
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
  if (res.ok) {
    const text = await res.text()
    return text ? (JSON.parse(text) as T[]) : []
  }

  // Log the database's error code only — its `details` can echo row values.
  let code = ''
  let message = ''
  try { const e = (await res.json()) as { code?: string; message?: string }; code = e.code ?? ''; message = e.message ?? '' } catch { /* not JSON */ }
  console.error(`${method} ${table} → ${res.status} ${code} ${message}`.trim())
  // PostgREST answers 404 only when the table itself is missing (no rows is a 200).
  if (res.status === 404 || code === 'PGRST205' || code === '42P01') {
    throw new ApiError(503, 'not_set_up', `Supabase has no "${table}" table yet — run the os_items migration (docs/BOT_API.md).`)
  }
  if (code === '42703' || code === 'PGRST204') {
    throw new ApiError(503, 'not_set_up', `Supabase's "${table}" table is from an older version — run the os_items migration again (docs/BOT_API.md).`)
  }
  if (res.status === 401 || res.status === 403 || code === '42501') {
    throw new ApiError(503, 'not_configured', 'Supabase refused SUPABASE_SERVICE_ROLE_KEY — it must be the secret / service_role key.')
  }
  throw new ApiError(502, 'database_error', 'The database did not accept the request.')
}

/** Read-only peek at a few of your app_state keys. */
export async function readState(cfg: Config, keys: string[]): Promise<Record<string, unknown>> {
  const rows = await db<{ key: string; value: unknown }>(cfg, 'GET', 'app_state', {
    select: 'key,value',
    user_id: `eq.${cfg.owner}`,
    key: `in.(${keys.map((k) => `"${k}"`).join(',')})`,
  })
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

// ── Today, in your timezone ─────────────────────────────────────────────────

export const dayIn = (tz: string, at: Date = new Date()): string => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at)
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export type Today = { date: string; weekday: string; weekKey: string }
export function today(tz: string): Today {
  const date = dayIn(tz)
  return { date, weekday: weekdayName(date), weekKey: mondayOf(date) }
}

// ── Non-negotiables ─────────────────────────────────────────────────────────

export type Mark = { day: string; nonneg_id: string; bot: string }

/** Today's non-negotiables, exactly as Home picks them. */
export const nonNegsToday = (state: Record<string, unknown>, t: Today): NonNeg[] =>
  nonNegList(state['home.nonneg']).filter((n) => appliesOn(n, t.date))

/** What you ticked yourself in the app today. */
export function appTicks(state: Record<string, unknown>, t: Today): string[] {
  const v = state['home.nonneg.today']
  return isObj(v) && v.date === t.date && Array.isArray(v.done) ? v.done.filter((x): x is string => typeof x === 'string') : []
}

/**
 * Ticks one of today's non-negotiables on a bot's behalf. Never app_state:
 * the tick goes to os_nonneg_marks and the app folds it into your list.
 */
export async function tickNonNeg(cfg: Config, t: Today, state: Record<string, unknown>, n: NonNeg, bot: string) {
  if (appTicks(state, t).includes(n.id)) return { already_done: true }
  const added = await db<Mark>(cfg, 'POST', 'os_nonneg_marks', { on_conflict: 'user_id,day,nonneg_id', select: 'nonneg_id' },
    [{ user_id: cfg.owner, day: t.date, nonneg_id: n.id, bot }], 'resolution=ignore-duplicates,return=representation')
  return { already_done: added.length === 0 }
}
