import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useStore } from './store'

export type Theme = {
  sidebar: string
  sidebar2: string
  sidebarText: string
  accent: string
  onAccent: string
  bg: string
  surface: string
  text: string
  muted: string
  border: string
}

export const PRESETS: Record<string, Theme> = {
  'Noir Lavender': {
    sidebar: '#1d1b29', sidebar2: '#2d2a44', sidebarText: '#f3f1fb',
    accent: '#b9a8ff', onAccent: '#241f3a', bg: '#f5f4f8', surface: '#ffffff',
    text: '#1d1b26', muted: '#8a8699', border: '#ecebf2',
  },
  Pearl: {
    sidebar: '#ffffff', sidebar2: '#f3f2f7', sidebarText: '#2a2740',
    accent: '#8b7fb8', onAccent: '#ffffff', bg: '#fafafb', surface: '#ffffff',
    text: '#222029', muted: '#9b97a8', border: '#ededf3',
  },
  'Rose Gold': {
    sidebar: '#2a1f24', sidebar2: '#422d36', sidebarText: '#fbf2f5',
    accent: '#e8b4be', onAccent: '#3a2229', bg: '#faf6f7', surface: '#ffffff',
    text: '#2a1f24', muted: '#a18d94', border: '#f1e7ea',
  },
  Graphite: {
    sidebar: '#1c1d22', sidebar2: '#2b2d35', sidebarText: '#f0f1f4',
    accent: '#8ad1c5', onAccent: '#0c322c', bg: '#f4f5f7', surface: '#ffffff',
    text: '#1c1d22', muted: '#888c96', border: '#eaecef',
  },
  Sage: {
    sidebar: '#1f2622', sidebar2: '#2f3a33', sidebarText: '#f0f4f1',
    accent: '#a8cbb0', onAccent: '#1d3526', bg: '#f4f7f4', surface: '#ffffff',
    text: '#1f2622', muted: '#86918a', border: '#e7eee9',
  },
  Midnight: {
    sidebar: '#16151f', sidebar2: '#23212f', sidebarText: '#ecebf5',
    accent: '#9d8df1', onAccent: '#1b1726', bg: '#191822', surface: '#22212e',
    text: '#ecebf5', muted: '#928eaa', border: '#34323f',
  },
}

const VAR_MAP: Record<keyof Theme, string> = {
  sidebar: '--color-sidebar',
  sidebar2: '--color-sidebar-2',
  sidebarText: '--color-sidebar-text',
  accent: '--color-accent',
  onAccent: '--color-on-accent',
  bg: '--color-bg',
  surface: '--color-surface',
  text: '--color-text',
  muted: '--color-muted',
  border: '--color-border',
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  for (const key of Object.keys(VAR_MAP) as (keyof Theme)[]) {
    root.style.setProperty(VAR_MAP[key], theme[key])
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme.sidebar)
}

type ThemeCtx = {
  theme: Theme
  setTheme: (t: Theme) => void
  applyPreset: (name: string) => void
}

const Ctx = createContext<ThemeCtx | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useStore<Theme>('theme', PRESETS['Noir Lavender'])

  useEffect(() => {
    // Backfill any keys added in newer versions so older saved themes don't break.
    applyTheme({ ...PRESETS['Noir Lavender'], ...theme })
  }, [theme])

  const applyPreset = (name: string) => {
    const preset = PRESETS[name]
    if (preset) setTheme(preset)
  }

  return <Ctx.Provider value={{ theme, setTheme, applyPreset }}>{children}</Ctx.Provider>
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
