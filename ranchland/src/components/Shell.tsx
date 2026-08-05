import { type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LangToggle, useI18n } from '../lib/i18n.tsx'
import { signOut } from '../lib/store.ts'
import { isLive } from '../lib/supabase.ts'

interface NavItem {
  to: string
  label: string
  end?: boolean
}

export function Shell({ nav, title, sub, actions, children }: {
  nav: NavItem[]
  title: string
  sub?: string
  actions?: ReactNode
  children: ReactNode
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <img src="/brand/stag.png" alt="Ranch Land Group" />
          <span className="wordmark">Ranch Land<small>— GROUP —</small></span>
        </div>
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>
            {n.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <div style={{ padding: '0 0.7rem 0.6rem' }}><LangToggle /></div>
        <button
          className="btn ghost"
          style={{ margin: '0 0.5rem', color: '#D8CFC0', borderColor: 'rgba(255,255,255,0.2)' }}
          onClick={() => { signOut(); navigate('/') }}
        >
          {t('signOut')}
        </button>
      </aside>
      <main className="main">
        {!isLive && (
          <div className="badge warn" style={{ marginBottom: '1rem' }}>{t('demoBanner')}</div>
        )}
        <div className="page-head">
          <div>
            <h1>{title}</h1>
            {sub && <p className="sub">{sub}</p>}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  )
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}

export function StatusBadge({ status }: { status: 'current' | 'late' | 'paid_off' | 'settled' | 'pending' | 'returned' }) {
  const { t } = useI18n()
  const map: Record<string, { cls: string; label: string }> = {
    current: { cls: 'good', label: t('current') },
    late: { cls: 'bad', label: t('late') },
    paid_off: { cls: 'neutral', label: t('paidOff') },
    settled: { cls: 'good', label: t('settled') },
    pending: { cls: 'warn', label: t('pending') },
    returned: { cls: 'bad', label: t('returned') },
  }
  const m = map[status]
  return <span className={`badge ${m.cls}`}>{m.label}</span>
}
