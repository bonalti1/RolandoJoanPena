/**
 * Working inside someone else's OS.
 *
 * A dashboard normally shows the signed-in person their own data. A delegate —
 * granted access in Supabase (`os_access`) — can instead open a colleague's OS
 * and work in it directly: their Work tasks, their Companies, their Ideas.
 *
 * Two rules make this safe:
 *
 *  1. **Business only.** Only the keys below ever cross. Home tasks, Health,
 *     Family, Finances and the Journal are never read or written for someone
 *     else, and the database enforces the same list independently — a bug here
 *     cannot widen what a delegate can reach.
 *  2. **Separate drawer.** While delegating, local storage is namespaced under
 *     the owner's id, so their data never lands in yours and yours is never
 *     pushed up as theirs.
 *
 * Delegation is chosen at boot (from sessionStorage) rather than toggled live,
 * so every screen and the sync layer agree on whose OS this is for the whole
 * session. Entering or leaving reloads the app — deliberately.
 */

const SESSION_KEY = 'jess:acting_as'

export type ActingOwner = { id: string; name: string }

/** The business keys a delegate may read and write. Nothing else syncs. */
export const DELEGATE_KEYS = ['work.work', 'ideas.list'] as const
export const DELEGATE_PREFIXES = ['companies.'] as const

export function isDelegateKey(key: string): boolean {
  return (DELEGATE_KEYS as readonly string[]).includes(key)
    || DELEGATE_PREFIXES.some((p) => key.startsWith(p))
}

/** Read once at module load: whose OS this session is for (null = your own). */
let acting: ActingOwner | null = (() => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as ActingOwner
    return v?.id ? v : null
  } catch { return null }
})()

export const actingOwner = (): ActingOwner | null => acting
export const isDelegating = (): boolean => !!acting

/** Storage namespace, so a delegate's copy of someone else's boards is kept
 *  entirely apart from their own. */
export const storeNamespace = (): string => (acting ? `as:${acting.id}:` : '')

/** Enter someone's OS. Reloads, because whose OS this is decides everything. */
export function enterOs(owner: ActingOwner) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(owner)) } catch { /* ignore */ }
  window.location.assign('/work-tasks')
}

/** Back to your own OS. */
export function leaveOs() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
  window.location.assign('/home')
}

/** Test seam — not used by the app at runtime. */
export function __setActingForTest(v: ActingOwner | null) { acting = v }
