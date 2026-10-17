/**
 * Every 30 minutes: if you trained today (Strava), tick today's gym /
 * exercise non-negotiable. See netlify/lib/strava.ts for exactly what it
 * does and doesn't touch.
 *
 * Netlify runs scheduled functions on the published site only (never on
 * deploy previews), and they can't be called from a browser. Without the
 * STRAVA_* variables it does nothing.
 */
import type { Config as NetlifyConfig } from '@netlify/functions'
import { ApiError, readConfig } from '../lib/server'
import { stravaEnv, syncStrava } from '../lib/strava'

export default async (): Promise<void> => {
  const env = stravaEnv()
  if (!env) return
  try {
    const r = await syncStrava(readConfig(), env)
    const what = r.marked ? `ticked "${r.marked.text}"${r.already_done ? ' (already done)' : ''}` : r.reason
    console.log(`strava-sync ${r.date}: ${r.workouts.length} workout(s) — ${what}`)
  } catch (e) {
    console.error('strava-sync:', e instanceof ApiError ? `${e.code} — ${e.message}` : (e as Error)?.message)
  }
}

export const config: NetlifyConfig = { schedule: '*/30 * * * *' }
