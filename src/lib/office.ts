import { useMemo } from 'react'
import { useBotActivity, useBotItems, type BotActivity, type BotItem } from './bots'

/**
 * The virtual office: every bot, its live state and what it needs from you.
 *
 *  • needs  — it has open os_items with needs_me (count = how many).
 *  • working — no pending asks, and its latest os_bot_activity row says
 *    'working' within the last 30 minutes.
 *  • paused — everything else.
 */

export type OfficeState = 'working' | 'needs' | 'paused'
export type OfficeBotDef = { key: string; name: string; main: boolean; short?: string }

export const MAIN_BOTS: OfficeBotDef[] = [
  { key: 'bonalti', name: 'Bonalti bot', main: true, short: 'Bonalti' },
  { key: 'grok', name: 'Grok Bot', main: true, short: 'Grok' },
  { key: 'scheduling', name: 'Scheduling', main: true, short: 'Agenda' },
  { key: 'ranch', name: 'Ranch Deals', main: true, short: 'Ranch' },
  { key: 'appt', name: 'Appt Setting', main: true, short: 'Citas' },
  { key: 'accounting', name: 'Accounting', main: true, short: 'Contab.' },
  { key: 'founder', name: 'Founder Assistant', main: true, short: 'Founder' },
  { key: 'ceo', name: 'CEO Assistant', main: true, short: 'CEO' },
]
export const OTHER_BOTS: OfficeBotDef[] = [
  { key: 'salud', name: 'Salud', main: false },
  { key: 'familia', name: 'Familia', main: false },
  { key: 'research', name: 'Research & Growth', main: false },
  { key: 'email', name: 'EMAIL Brief', main: false },
  { key: 'tc', name: 'TC Brief', main: false },
  { key: 'closers', name: 'Closers', main: false },
  { key: 'selections', name: 'Selections', main: false },
  { key: 'youtube', name: 'YouTube', main: false },
  { key: 'news', name: 'News / AI', main: false },
]
export const ALL_BOTS = [...MAIN_BOTS, ...OTHER_BOTS]

export const STATE_LABEL: Record<OfficeState, string> = { working: 'Trabajando', needs: 'Te necesita', paused: 'En pausa' }
export const STATE_COLOR: Record<OfficeState, string> = { working: '#4ade80', needs: '#facc15', paused: '#b4a7f5' }

const WORKING_WINDOW_MS = 30 * 60 * 1000

export type OfficeAction = { id: string; text: string; at: string }
export type OfficeBot = OfficeBotDef & {
  /** 1-based index into public/robots/robot-N.png (cycles after 8). */
  image: number
  state: OfficeState
  pending: BotItem[]
  now: string
  recent: OfficeAction[]
}

/** os_items.bot is free text; match it to a bot key loosely ("Bonalti Bot" → bonalti). */
export function botKey(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (ALL_BOTS.some((b) => b.key === s)) return s
  return ALL_BOTS.find((b) => b.name.toLowerCase() === s)?.key ?? s.split(/[\s_-]+/)[0] ?? s
}

export function buildOffice(items: BotItem[], activity: BotActivity[], nowMs: number): OfficeBot[] {
  return ALL_BOTS.map((def, i) => {
    const mine = activity.filter((a) => botKey(a.bot) === def.key) // newest first
    const pending = items.filter((it) => botKey(it.bot) === def.key && it.needs_me && it.status === 'abierta')
    const latest = mine[0]
    const working = !!latest && latest.status === 'working' && nowMs - Date.parse(latest.created_at) <= WORKING_WINDOW_MS
    const state: OfficeState = pending.length ? 'needs' : working ? 'working' : 'paused'

    const done: OfficeAction[] = items
      .filter((it) => botKey(it.bot) === def.key && it.status === 'hecha' && it.done_at)
      .map((it) => ({ id: `i${it.id}`, text: it.title, at: it.done_at! }))
    const reported: OfficeAction[] = mine
      .filter((a) => a.activity)
      .map((a) => ({ id: `a${a.id}`, text: a.activity, at: a.created_at }))
    const recent = [...done, ...reported].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3)

    return {
      ...def,
      image: (i % 8) + 1,
      state,
      pending,
      now: working ? latest.activity : '',
      recent,
    }
  })
}

/** Live office: items + activity from Supabase, re-evaluated every 30 s so "working" expires on its own. */
export function useOffice(tick: number) {
  const { items, status, setDone } = useBotItems()
  const { activity } = useBotActivity()
  const bots = useMemo(() => buildOffice(items, activity, Date.now()), [items, activity, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const pendingTotal = bots.reduce((n, b) => n + b.pending.length, 0)
  return { bots, status, setDone, pendingTotal }
}

/** Just the number for the nav badge. */
export function usePendingCount(): number {
  const { items } = useBotItems()
  return items.filter((i) => i.needs_me && i.status === 'abierta').length
}

/** Greeting for America/Chicago. */
export function greeting(d = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false }).format(d)) % 24
  return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
}
