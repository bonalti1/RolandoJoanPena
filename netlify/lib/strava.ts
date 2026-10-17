/**
 * Strava → today's exercise non-negotiable.
 *
 * Reads today's workouts and, if there's one of at least 10 minutes, ticks
 * the ONE non-negotiable of today that's about the gym or exercise ("Gym /
 * exercise" on weekdays, "Move / exercise" on weekends). Nothing else. If no
 * non-negotiable — or more than one — looks like exercise, it ticks nothing
 * and says why. Like every bot tick it goes to os_nonneg_marks, never to
 * app_state.
 *
 * Runs on a schedule (functions/strava-sync.ts) and on demand
 * (`sync_strava` in functions/bot.ts).
 *
 * Keys: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN in the
 * environment — from a Strava API app used only by the OS. Strava hands out a
 * new refresh token as it refreshes and the old one stops working, so the
 * latest one is kept in os_tokens (a table only the service key can read).
 * Putting a new STRAVA_REFRESH_TOKEN in Netlify always wins over the saved one.
 *
 * When Strava refuses the login, an open "Reconnect Strava" task (needs_me)
 * lands in "Esperando por ti", so it's seen on Home and not only in the logs.
 */
import { createHash } from 'node:crypto'
import { ApiError, db, fold, nonNegsToday, readState, tickNonNeg, today, type Config } from './server'

const RECONNECT_TITLE = 'Reconnect Strava'

const STRAVA = 'https://www.strava.com'
const MIN_MINUTES = 10
const EXERCISE = /\b(gym|exercise|exercising|ejercicio|ejercicios|workout|entreno|entrenar|entrenamiento|train|training)\b/

export type StravaEnv = { clientId: string; clientSecret: string; refreshToken: string }

/** The three Strava variables, or null when Strava isn't set up. */
export function stravaEnv(): StravaEnv | null {
  const clientId = (process.env.STRAVA_CLIENT_ID || '').trim()
  const clientSecret = (process.env.STRAVA_CLIENT_SECRET || '').trim()
  const refreshToken = (process.env.STRAVA_REFRESH_TOKEN || '').trim()
  return clientId && clientSecret && refreshToken ? { clientId, clientSecret, refreshToken } : null
}

type Tokens = { access_token: string; refresh_token: string; expires_at: number }
type Saved = { refresh_token: string; access_token: string | null; expires_at: string | null; seed_hash: string }
type Activity = { name?: string; type?: string; sport_type?: string; start_date_local?: string; moving_time?: number }

const strava = (path: string, init: RequestInit) =>
  fetch(`${STRAVA}${path}`, { ...init, signal: AbortSignal.timeout(8000) }).catch(() => {
    throw new ApiError(502, 'strava_error', 'Strava did not answer.')
  })

async function refresh(env: StravaEnv, refreshToken: string): Promise<Tokens | null> {
  const res = await strava('/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: env.clientId, client_secret: env.clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken }),
  })
  if (res.status === 400 || res.status === 401) return null
  if (!res.ok) throw new ApiError(502, 'strava_error', `Strava answered ${res.status}.`)
  const t = (await res.json()) as Partial<Tokens>
  if (!t.access_token || !t.refresh_token || !t.expires_at) throw new ApiError(502, 'strava_error', 'Strava sent an unexpected answer.')
  return t as Tokens
}

/** A working access token, refreshing (and saving Strava's new refresh token) when needed. */
async function accessToken(cfg: Config, env: StravaEnv): Promise<string> {
  const seed = createHash('sha256').update(env.refreshToken).digest('hex')
  const [saved] = await db<Saved>(cfg, 'GET', 'os_tokens', {
    select: 'refresh_token,access_token,expires_at,seed_hash', user_id: `eq.${cfg.owner}`, provider: 'eq.strava',
  })
  // A different STRAVA_REFRESH_TOKEN in Netlify means you logged in again: use it.
  const current = saved && saved.seed_hash === seed ? saved : null
  if (current?.access_token && current.expires_at && Date.parse(current.expires_at) > Date.now() + 2 * 60 * 1000) {
    return current.access_token
  }

  let tokens = await refresh(env, current?.refresh_token ?? env.refreshToken)
  if (!tokens && current && current.refresh_token !== env.refreshToken) tokens = await refresh(env, env.refreshToken)
  if (!tokens) throw new ApiError(503, 'strava_auth', 'Strava refused the login — get a new STRAVA_REFRESH_TOKEN (docs/BOT_API.md).')

  // Strava has already retired the old refresh token: this new one is the only
  // copy. One retry, then shout — losing it means logging in to Strava again.
  const save = () => db(cfg, 'POST', 'os_tokens', { on_conflict: 'user_id,provider' }, [{
    user_id: cfg.owner,
    provider: 'strava',
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    expires_at: new Date(tokens.expires_at * 1000).toISOString(),
    seed_hash: seed,
    updated_at: new Date().toISOString(),
  }], 'resolution=merge-duplicates,return=minimal')
  try {
    await save()
  } catch {
    await new Promise((r) => setTimeout(r, 500))
    try {
      await save()
    } catch (e) {
      console.error(
        '🚨 STRAVA TOKEN NOT SAVED 🚨 Strava issued a new refresh token and saving it to os_tokens failed twice ' +
        `(${e instanceof ApiError ? e.code : (e as Error)?.message}). The old token no longer works, so the next ` +
        'refresh will fail: put a fresh STRAVA_REFRESH_TOKEN in Netlify (docs/BOT_API.md → Strava) and redeploy.',
      )
    }
  }
  return tokens.access_token
}

/**
 * One open "Reconnect Strava" in "Esperando por ti", however many syncs fail.
 * Never hides the original error: if this fails too, it's only logged.
 */
async function askToReconnect(cfg: Config, reason: string) {
  try {
    const open = await db<{ id: string }>(cfg, 'GET', 'os_items', {
      select: 'id', user_id: `eq.${cfg.owner}`, bot: 'eq.strava', title: `eq.${RECONNECT_TITLE}`, status: 'eq.abierta', limit: '1',
    })
    if (open.length) return
    await db(cfg, 'POST', 'os_items', {}, [{
      user_id: cfg.owner,
      title: RECONNECT_TITLE,
      notes: `${reason} Until then your workouts won't tick the exercise non-negotiable. Check this off once it's done.`,
      bot: 'strava',
      area: 'salud',
      priority: 'alta',
      needs_me: true,
    }], 'return=minimal')
  } catch (e) {
    console.error('strava: could not add "Reconnect Strava" to Esperando por ti:', e instanceof ApiError ? e.code : (e as Error)?.message)
  }
}

export async function syncStrava(cfg: Config, env: StravaEnv) {
  try {
    return await sync(cfg, env)
  } catch (e) {
    if (e instanceof ApiError && e.code === 'strava_auth') await askToReconnect(cfg, e.message)
    throw e
  }
}

async function sync(cfg: Config, env: StravaEnv) {
  const t = today(cfg.tz)
  const token = await accessToken(cfg, env)
  const after = Math.floor(Date.now() / 1000) - 36 * 3600
  const res = await strava(`/api/v3/athlete/activities?after=${after}&per_page=50`, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401 || res.status === 403) {
    throw new ApiError(503, 'strava_auth', 'Strava won\'t share activities — log in again with the activity:read_all permission (docs/BOT_API.md).')
  }
  if (!res.ok) throw new ApiError(502, 'strava_error', `Strava answered ${res.status}.`)
  const activities = (await res.json()) as Activity[]

  // start_date_local is the clock time where you trained, so its date is "your" day.
  const workouts = (Array.isArray(activities) ? activities : [])
    .filter((a) => a.start_date_local?.slice(0, 10) === t.date && (a.moving_time ?? 0) >= MIN_MINUTES * 60)
    .map((a) => ({ name: a.name ?? '', type: a.sport_type || a.type || '', minutes: Math.round((a.moving_time ?? 0) / 60) }))
  const result = { ok: true, date: t.date, workouts }
  if (workouts.length === 0) return { ...result, marked: null, reason: 'no_workout_today' }

  const state = await readState(cfg, ['home.nonneg', 'home.nonneg.today'])
  const exercise = nonNegsToday(state, t).filter((n) => EXERCISE.test(fold(n.text)))
  if (exercise.length !== 1) {
    return {
      ...result,
      marked: null,
      reason: exercise.length ? 'more_than_one_exercise_non_negotiable' : 'no_exercise_non_negotiable_today',
      options: exercise.map((n) => ({ id: n.id, text: n.text })),
    }
  }
  const n = exercise[0]
  const { already_done } = await tickNonNeg(cfg, t, state, n, 'strava')
  return { ...result, marked: { id: n.id, text: n.text }, already_done }
}
