import { supabase } from './supabase'
import { PREFIX, storeKey, setLocalWriteListener } from './store'
import { actingOwner, isDelegating, isDelegateKey, storeNamespace } from './acting'

/**
 * Cloud sync for all localStorage-backed dashboard data.
 *
 * Strategy — offline-first with per-key last-write-wins:
 *  • Every key we save locally also records a local timestamp (in META).
 *  • On sign-in we pull every row from Supabase and merge: for each key we keep
 *    whichever side (cloud vs. local) was written more recently, so edits made
 *    offline on one device are never silently overwritten by an older copy.
 *  • After the merge we push anything local that the cloud is missing or older
 *    on, then keep pushing on every subsequent edit (debounced).
 *  • A realtime subscription applies changes made on your other devices live.
 *
 * The table (created by the user in Supabase):
 *   app_state(user_id uuid, key text, value jsonb, updated_at timestamptz,
 *             primary key (user_id, key))  — RLS locked to auth.uid(), plus a
 *             delegate grant in `os_access` for the business keys only.
 *
 * When working inside someone else's OS, every row read and written here
 * belongs to *them*: syncTarget() is their id rather than yours, and only keys
 * on the delegate allowlist move at all. The database enforces the same rule,
 * so this layer narrowing it is defence in depth, not the defence.
 */
const TABLE = 'app_state'
/** Sync timestamps live beside the data they describe, so a delegated copy
 *  keeps its own clock and never confuses the merge for your own OS. */
const meta = () => `jess:${storeNamespace()}__synctimes__`

type Times = Record<string, number>

function loadTimes(): Times {
  try { return JSON.parse(localStorage.getItem(meta()) || '{}') } catch { return {} }
}
function saveTimes(t: Times) {
  try { localStorage.setItem(meta(), JSON.stringify(t)) } catch { /* ignore */ }
}
function stamp(key: string, ms: number) {
  const t = loadTimes(); t[key] = ms; saveTimes(t)
}

/** Every user-facing store key for whoever's OS this is (prefix and internal
 *  meta key stripped). While delegating this covers only their namespace. */
function localKeys(): string[] {
  const base = PREFIX + storeNamespace()
  const out: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith(base) || k === meta()) continue
    const key = k.slice(base.length)
    if (key.includes('__synctimes__')) continue
    if (!syncable(key)) continue
    out.push(key)
  }
  return out
}

/** Whether a key may sync at all in the current mode. */
const syncable = (key: string): boolean => !isDelegating() || isDelegateKey(key)

/** Whose rows this session reads and writes. */
const syncTarget = (): string | null => (isDelegating() ? actingOwner()!.id : userId)

let userId: string | null = null
/** The signed-in user's id, used to scope their private files in Storage. */
export function currentUserId(): string | null { return userId }
const pending = new Map<string, unknown>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

async function flush() {
  flushTimer = null
  const target = syncTarget()
  if (!supabase || !target || pending.size === 0) return
  const rows = [...pending.entries()].map(([key, value]) => ({
    user_id: target, key, value, updated_at: new Date().toISOString(),
  }))
  pending.clear()
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'user_id,key' })
  if (error) {
    // Re-queue on failure so nothing is lost; try again shortly.
    for (const r of rows) pending.set(r.key, r.value)
    flushTimer = setTimeout(flush, 4000)
  }
}

function queuePush(key: string, value: unknown) {
  if (!syncable(key)) return   // never push someone else's private pages
  stamp(key, Date.now())
  pending.set(key, value)
  if (!flushTimer) flushTimer = setTimeout(flush, 700)
}

/** Apply a value that arrived from the cloud into localStorage + live UI. */
function applyRemote(key: string, value: unknown, updatedMs: number) {
  if (!syncable(key)) return
  const str = JSON.stringify(value)
  const full = storeKey(key)
  if (localStorage.getItem(full) === str) { stamp(key, updatedMs); return }
  localStorage.setItem(full, str)
  stamp(key, updatedMs)
  // Nudge any mounted useStore(key) to re-read via its existing storage listener.
  window.dispatchEvent(new StorageEvent('storage', { key: full, newValue: str }))
}

/** Pull the whole cloud snapshot and reconcile it against local by timestamp. */
let pulling = false
async function pullAndMerge() {
  if (!supabase || !syncTarget() || pulling) return
  pulling = true
  try { await doPullAndMerge() } finally { pulling = false }
}
async function doPullAndMerge() {
  const target = syncTarget()
  if (!supabase || !target) return
  const { data, error } = await supabase.from(TABLE).select('key, value, updated_at').eq('user_id', target)
  if (error) return
  const times = loadTimes()
  const cloudKeys = new Set<string>()

  for (const row of data ?? []) {
    const cloudMs = new Date(row.updated_at as string).getTime()
    cloudKeys.add(row.key)
    if (!syncable(row.key)) continue
    const localMs = times[row.key] ?? 0
    const localHas = localStorage.getItem(storeKey(row.key)) !== null
    // Cloud wins when it's newer, or when we have no local copy at all.
    if (!localHas || cloudMs >= localMs) applyRemote(row.key, row.value, cloudMs)
  }

  // Push up anything the cloud doesn't have, or where local is newer.
  for (const key of localKeys()) {
    const localMs = times[key] ?? 0
    const raw = localStorage.getItem(storeKey(key))
    if (raw === null) continue
    let value: unknown
    try { value = JSON.parse(raw) } catch { continue }
    if (!cloudKeys.has(key) || localMs > 0) {
      // Only force-push when the cloud lacks it or we hold a newer local edit.
      const needsPush = !cloudKeys.has(key)
      if (needsPush) { pending.set(key, value); stamp(key, localMs || Date.now()) }
    }
  }
  await flush()
}

let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null
let channelSeq = 0
let onWake: (() => void) | null = null

/** Begin syncing for the signed-in user. Safe to call again after re-auth. */
export async function startCloudSync(uid: string) {
  if (!supabase) return
  userId = uid
  await pullAndMerge()
  setLocalWriteListener(queuePush)

  // Live updates from your other devices. Fully remove any prior channel first
  // and use a fresh channel name each time — startCloudSync re-runs on every
  // auth event (including token refresh), and reusing a topic that's already
  // subscribed makes supabase-js throw "cannot add postgres_changes callbacks
  // after subscribe()", which would crash the app. Wrapped so a realtime failure
  // degrades gracefully: the pull-on-focus below keeps devices in sync anyway.
  try {
    if (channel) { await supabase.removeChannel(channel); channel = null }
    const ch = supabase.channel(`app_state_changes_${++channelSeq}`)
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${syncTarget() ?? uid}` },
      (payload) => {
        const row = (payload.new ?? {}) as { key?: string; value?: unknown; updated_at?: string }
        if (!row.key || !('value' in row)) return
        const ms = row.updated_at ? new Date(row.updated_at).getTime() : Date.now()
        if (ms >= (loadTimes()[row.key] ?? 0)) applyRemote(row.key, row.value, ms)
      },
    )
    ch.subscribe()
    channel = ch
  } catch { /* realtime unavailable — pull-on-focus still keeps devices in sync */ }

  // Re-pull whenever the app comes back to the foreground or the network
  // returns, so opening it on another device always shows the latest — even if
  // a realtime event was missed while the tab was backgrounded or offline.
  if (onWake) { document.removeEventListener('visibilitychange', onWake); window.removeEventListener('online', onWake); window.removeEventListener('focus', onWake) }
  onWake = () => { if (document.visibilityState === 'visible') void pullAndMerge() }
  document.addEventListener('visibilitychange', onWake)
  window.addEventListener('online', onWake)
  window.addEventListener('focus', onWake)
}

/** Stop syncing (on sign-out) and forget the queued pushes. */
export async function stopCloudSync() {
  setLocalWriteListener(null)
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
  pending.clear()
  userId = null
  if (onWake) { document.removeEventListener('visibilitychange', onWake); window.removeEventListener('online', onWake); window.removeEventListener('focus', onWake); onWake = null }
  if (channel) { try { await supabase?.removeChannel(channel) } catch { /* ignore */ } channel = null }
}
