import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { currentUserId } from './cloud'
import { isDelegating } from './acting'
import { toISO } from './dates'

/**
 * What your AI bots leave in the OS (they write through the `bot` Netlify
 * function — see docs/BOT_API.md).
 *
 * Bots never write app_state, so they can't overwrite an edit you're making
 * with the app open. They write two tables of their own instead, both private
 * to you by Row Level Security:
 *  • os_items — tasks a bot created. Home shows them under "De mis bots";
 *    the home-area ('casa') ones also show on Home tasks.
 *  • os_nonneg_marks — a bot's tick on one of today's non-negotiables
 *    ("hice gym"). Home folds it into your own checklist.
 *
 * Both stay live like the rest of the app: a realtime subscription, plus a
 * re-read whenever the app comes back to the foreground or online.
 */

export type BotArea = 'casa' | 'trabajo' | 'salud' | 'familia'
export type BotItem = {
  id: string; title: string; notes: string; bot: string; area: BotArea
  due: string | null; priority: 'baja' | 'media' | 'alta'; status: 'abierta' | 'hecha'
  done_at: string | null; created_at: string
}
export type BotMark = { day: string; nonneg_id: string; bot: string }

export const AREA_LABEL: Record<BotArea, string> = { casa: 'Home', trabajo: 'Work', salud: 'Health', familia: 'Family' }

/** off = no cloud (or inside someone else's OS) · missing = migration not run yet */
export type BotStatus = 'off' | 'loading' | 'ready' | 'missing' | 'error'

const ITEM_COLS = 'id,title,notes,bot,area,due,priority,status,done_at,created_at'
let channelSeq = 0

type Load<T> = () => PromiseLike<{ data: T[] | null; error: { code?: string } | null }>

/** One table's rows for the signed-in user, kept live. */
function useLiveRows<T>(table: string, load: Load<T>, reloadKey = '') {
  const [rows, setRows] = useState<T[]>([])
  const [status, setStatus] = useState<BotStatus>(() => (supabase && !isDelegating() ? 'loading' : 'off'))
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    const db = supabase
    const uid = currentUserId()
    if (!db || !uid || isDelegating()) { setStatus('off'); return }
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null

    const read = async () => {
      const { data, error } = await loadRef.current()
      if (!alive) return
      if (error) { setStatus(error.code === 'PGRST205' || error.code === '42P01' ? 'missing' : 'error'); return }
      setRows(data ?? [])
      setStatus('ready')
    }
    // A burst of changes (a bot adding several tasks) reads once.
    const soon = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => void read(), 250) }
    void read()

    const ch = db.channel(`${table}_live_${++channelSeq}`)
    try {
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${uid}` }, soon)
      ch.subscribe()
    } catch { /* realtime unavailable — the wake re-read below still catches up */ }

    const onWake = () => { if (document.visibilityState === 'visible') soon() }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('online', onWake)
    window.addEventListener('focus', onWake)
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('online', onWake)
      window.removeEventListener('focus', onWake)
      void db.removeChannel(ch)
    }
  }, [table, reloadKey])

  return { rows, setRows, status }
}

/** The local day a bot task was finished, if it was. */
export const doneDay = (i: BotItem): string | null => (i.done_at ? toISO(new Date(i.done_at)) : null)

/**
 * Every open bot task, plus the ones finished in the last day and a half (so
 * today's done ones still show, and can be unticked). Checking one off writes
 * straight to os_items; on failure the row snaps back and you get `false`.
 */
export function useBotItems() {
  const { rows, setRows, status } = useLiveRows<BotItem>('os_items', () =>
    supabase!.from('os_items').select(ITEM_COLS)
      .eq('user_id', currentUserId()!)
      .or(`status.eq.abierta,done_at.gte."${new Date(Date.now() - 36 * 3600 * 1000).toISOString()}"`)
      .order('created_at'))

  const setDone = async (id: string, done: boolean): Promise<boolean> => {
    const before = rows.find((r) => r.id === id)
    if (!before || !supabase) return false
    const patch = (fn: (r: BotItem) => BotItem) => setRows((prev) => prev.map((r) => (r.id === id ? fn(r) : r)))
    patch((r) => ({ ...r, status: done ? 'hecha' : 'abierta', done_at: done ? new Date().toISOString() : null }))
    const { error } = await supabase.from('os_items').update({ status: done ? 'hecha' : 'abierta' }).eq('id', id)
    if (error) { patch(() => before); return false }
    return true
  }

  return { items: rows, status, setDone }
}

/**
 * Bot ticks on non-negotiables since `fromDay`. `clear` takes one back (when
 * you untick it yourself) so it doesn't fold straight back in; it removes the
 * tick locally at once, and restores it if the cloud can't be reached.
 */
export function useBotMarks(fromDay: string) {
  const { rows, setRows, status } = useLiveRows<BotMark>('os_nonneg_marks', () =>
    supabase!.from('os_nonneg_marks').select('day,nonneg_id,bot')
      .eq('user_id', currentUserId()!)
      .gte('day', fromDay), fromDay)

  const clear = async (day: string, nonnegId: string): Promise<boolean> => {
    const same = (m: BotMark) => m.day === day && m.nonneg_id === nonnegId
    const mark = rows.find(same)
    if (!mark || !supabase) return true
    setRows((prev) => prev.filter((m) => !same(m)))
    const { error } = await supabase.from('os_nonneg_marks').delete()
      .eq('user_id', currentUserId()!).eq('day', day).eq('nonneg_id', nonnegId)
    if (error) { setRows((prev) => [...prev, mark]); return false }
    return true
  }

  return { marks: rows, status, clear }
}
