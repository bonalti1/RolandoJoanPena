// localStorage with an in-memory fallback, so the app also runs in sandboxed
// contexts (embedded demos, strict privacy modes) instead of crashing at load.
const mem = new Map<string, string>()

export const storage = {
  get(key: string): string | null {
    try { return localStorage.getItem(key) } catch { return mem.get(key) ?? null }
  },
  set(key: string, value: string): void {
    try { localStorage.setItem(key, value) } catch { /* fall through */ }
    mem.set(key, value)
  },
  del(key: string): void {
    try { localStorage.removeItem(key) } catch { /* fall through */ }
    mem.delete(key)
  },
}
