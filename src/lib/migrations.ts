/**
 * One-time data migrations for returning visitors.
 *
 * Everything is stored in the browser's localStorage, and the app keeps
 * whatever a visitor has already saved — so when a *default* changes, or we want
 * to seed a starting set (non-negotiables, goals, kids), an existing browser
 * would otherwise never see it. Each versioned step runs exactly once and never
 * overwrites data the user has genuinely entered.
 *
 * Runs before React renders (see main.tsx), so the store reads migrated values.
 */
import { PRESETS, DEFAULT_PRESET, type Theme } from './theme'

const PREFIX = 'jess:'
const VERSION_KEY = 'migrations.version'
const CURRENT = 2

const LEGACY_ACCENTS = new Set(['#b9a8ff', '#8b7fb8', '#e8b4be', '#9d8df1'])
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

// Rolando's weekday/weekend non-negotiables (scope: week | weekend | all).
const SEED_NONNEG = [
  { id: 'nn_sleep', text: 'Sleep — at least 7 hours', scope: 'all' },
  { id: 'nn_deep', text: 'Deep work or relaxation (morning)', scope: 'week' },
  { id: 'nn_school', text: 'Get the kids ready & to school', scope: 'week' },
  { id: 'nn_gym', text: 'Gym / exercise', scope: 'week' },
  { id: 'nn_needle', text: 'Move the needle — 1 task to grow the business', scope: 'week' },
  { id: 'nn_home', text: 'Clear one home task from the backlog', scope: 'week' },
  { id: 'nn_family', text: 'Family time with the kids (evening)', scope: 'week' },
  { id: 'nn_wend_activity', text: 'Family activity — bike ride or outing', scope: 'weekend' },
  { id: 'nn_wend_move', text: 'Move / exercise', scope: 'weekend' },
  { id: 'nn_wend_relax', text: 'Relax & recharge', scope: 'weekend' },
  { id: 'nn_wend_plan', text: 'Plan the week ahead', scope: 'weekend' },
]

const SEED_GOALS = [
  '12% body fat', '$100K / month', '$1M+ / month', '10 homes / month',
  'Grow the company', 'Build the team', 'Family time', 'San Francisco', 'Monterrey',
].map((text, i) => ({ id: `goal_${i}`, text, done: false }))

const SEED_KIDS = [
  { id: 'kid_noe', name: 'Noe', relation: 'Son', birthday: '2017-11-07' },
  { id: 'kid_natalia', name: 'Natalia', relation: 'Daughter', birthday: '2020-07-12' },
]

export function runMigrations(): void {
  let version = 0
  try { version = read<number>(VERSION_KEY) ?? 0 } catch { version = 0 }
  if (version >= CURRENT) return

  // v1 — retire the original purple theme and the single-word default name.
  if (version < 1) {
    const theme = read<Theme>('theme')
    if (theme && theme.accent && LEGACY_ACCENTS.has(theme.accent.toLowerCase())) {
      write('theme', PRESETS[DEFAULT_PRESET])
    }
    const profile = read<{ name?: string }>('profile')
    if (profile && (profile.name === undefined || LEGACY_DEFAULT_NAMES.has(profile.name))) {
      write('profile', { ...profile, name: 'Rolando Joan' })
    }
  }

  // v2 — day-aware non-negotiables + seed goals & kids once.
  // Append the seed set unless it's already present (matched by seed id), so an
  // existing browser gets Rolando's plan without losing anything already added.
  if (version < 2) {
    const hasSeed = (list: { id?: string }[], seeds: { id: string }[]) =>
      list.some((x) => seeds.some((s) => s.id === x.id))

    // Existing non-negotiables predate scoping — default them to "every day".
    const nn = (read<{ id?: string; scope?: string }[]>('home.nonneg') ?? []).map((n) => ({ ...n, scope: n.scope ?? 'all' }))
    write('home.nonneg', hasSeed(nn, SEED_NONNEG) ? nn : [...nn, ...SEED_NONNEG])

    const goals = read<{ id?: string }[]>('journal.goals') ?? []
    write('journal.goals', hasSeed(goals, SEED_GOALS) ? goals : [...goals, ...SEED_GOALS])

    const members = read<{ id?: string }[]>('family.members') ?? []
    write('family.members', hasSeed(members, SEED_KIDS) ? members : [...members, ...SEED_KIDS])
  }

  write(VERSION_KEY, CURRENT)
}
