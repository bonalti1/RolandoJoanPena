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
  Charcoal: {
    sidebar: '#212327', sidebar2: '#2c2f34', sidebarText: '#f2f3f5',
    accent: '#4b5563', onAccent: '#ffffff', bg: '#f3f4f6', surface: '#ffffff',
    text: '#1f2023', muted: '#6b7280', border: '#e5e7eb',
  },
  Slate: {
    sidebar: '#1e293b', sidebar2: '#334155', sidebarText: '#f1f5f9',
    accent: '#64748b', onAccent: '#ffffff', bg: '#f4f6f8', surface: '#ffffff',
    text: '#1e293b', muted: '#64748b', border: '#e6eaef',
  },
  Graphite: {
    sidebar: '#1c1d22', sidebar2: '#2b2d35', sidebarText: '#f0f1f4',
    accent: '#5b6472', onAccent: '#ffffff', bg: '#f4f5f7', surface: '#ffffff',
    text: '#1c1d22', muted: '#888c96', border: '#eaecef',
  },
  Steel: {
    sidebar: '#1f2733', sidebar2: '#2d3a4a', sidebarText: '#eef2f7',
    accent: '#5a7796', onAccent: '#ffffff', bg: '#f3f5f8', surface: '#ffffff',
    text: '#1f2733', muted: '#77808c', border: '#e6eaef',
  },
  Fog: {
    sidebar: '#f4f5f7', sidebar2: '#e9ebef', sidebarText: '#2b2e33',
    accent: '#5b6472', onAccent: '#ffffff', bg: '#fafafb', surface: '#ffffff',
    text: '#22242a', muted: '#9297a0', border: '#ededf1',
  },
  Onyx: {
    sidebar: '#161719', sidebar2: '#212327', sidebarText: '#ebecee',
    accent: '#8a919c', onAccent: '#17181a', bg: '#191a1c', surface: '#222427',
    text: '#ebecee', muted: '#8b8f96', border: '#33363b',
  },
}

/** The default theme new installs start with. */
export const DEFAULT_PRESET = 'Charcoal'

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
  const [theme, setTheme] = useStore<Theme>('theme', PRESETS[DEFAULT_PRESET])

  useEffect(() => {
    // Backfill any keys added in newer versions so older saved themes don't break.
    applyTheme({ ...PRESETS[DEFAULT_PRESET], ...theme })
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
