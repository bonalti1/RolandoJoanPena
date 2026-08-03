/**
 * One-time data migrations for returning visitors.
 *
 * Everything is stored in the browser's localStorage, and the app keeps
 * whatever a visitor has already saved — so when a *default* changes (e.g. the
 * theme going from the original purple to charcoal, or the name gaining a
 * second word) an existing browser would otherwise hold onto the old value
 * forever. These migrations bring stale defaults forward exactly once, without
 * touching anything the user has genuinely customized.
 *
 * Runs before React renders (see main.tsx), so the store reads migrated values.
 */
import { PRESETS, DEFAULT_PRESET, type Theme } from './theme'

const PREFIX = 'jess:'
const VERSION_KEY = 'migrations.version'
const CURRENT = 1

// Accents shipped by the original purple/pink presets. If a saved theme still
// uses one of these, it predates the charcoal redesign and should be replaced.
const LEGACY_ACCENTS = new Set(['#b9a8ff', '#8b7fb8', '#e8b4be', '#9d8df1'])
// Names that were only ever auto-filled defaults (never typed by the user).
const LEGACY_DEFAULT_NAMES = new Set(['Jessica', 'Jessica Peña', 'Rolando'])

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}
function write(key: string, value: unknown): void {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)) } catch { /* ignore */ }
}

export function runMigrations(): void {
  let version = 0
  try { version = read<number>(VERSION_KEY) ?? 0 } catch { version = 0 }
  if (version >= CURRENT) return

  // v1 — retire the original purple theme and the single-word default name.
  const theme = read<Theme>('theme')
  if (theme && theme.accent && LEGACY_ACCENTS.has(theme.accent.toLowerCase())) {
    write('theme', PRESETS[DEFAULT_PRESET])
  }
  const profile = read<{ name?: string }>('profile')
  if (profile && (profile.name === undefined || LEGACY_DEFAULT_NAMES.has(profile.name))) {
    write('profile', { ...profile, name: 'Rolando Joan' })
  }

  write(VERSION_KEY, CURRENT)
}
