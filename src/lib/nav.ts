/**
 * Which pages this person's OS shows.
 *
 * Two layers, both subtractive:
 *  • The site's VITE_HIDDEN_TABS — pages nobody using that deploy gets
 *    (the shared team door hides Family and Team for everyone).
 *  • The account's own `nav.hidden` list — chosen in Settings → Pages and
 *    synced with the login, so each leader carries their own set of tabs to
 *    any device.
 *
 * Hidden means gone: out of the sidebar, the phone menus, and the router —
 * typing the address bounces home.
 */
import { useStore } from './store'
import { isHiddenTab } from './brand'

export const HIDEABLE_PAGES: { path: string; label: string }[] = [
  { path: 'home-tasks', label: 'Home tasks' },
  { path: 'work-tasks', label: 'Work tasks' },
  { path: 'companies', label: 'Companies' },
  { path: 'ideas', label: 'Ideas' },
  { path: 'team', label: 'Team' },
  { path: 'finances', label: 'Finances' },
  { path: 'calendar', label: 'Calendar' },
  { path: 'health', label: 'Health' },
  { path: 'family', label: 'Family' },
  { path: 'journal', label: 'Journal' },
]

export function useHiddenTabs() {
  const [hidden, setHidden] = useStore<string[]>('nav.hidden', [])
  const norm = (path: string) => path.replace(/^\//, '').toLowerCase()
  const isHidden = (path: string) => isHiddenTab(norm(path)) || hidden.includes(norm(path))
  const toggle = (path: string) =>
    setHidden((prev) => prev.includes(norm(path)) ? prev.filter((p) => p !== norm(path)) : [...prev, norm(path)])
  /** Pages this site allows at all — what Settings offers to toggle. */
  const offerable = HIDEABLE_PAGES.filter((p) => !isHiddenTab(p.path))
  return { hidden, isHidden, toggle, offerable }
}
