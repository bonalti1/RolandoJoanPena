import { useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'
import { IconMenu } from './components/icons'
import { Logo } from './components/Logo'
import Home from './pages/Home'
import WorkList from './pages/WorkList'
import HomeCare from './pages/HomeCare'
import Companies from './pages/Companies'
import Team from './pages/Team'
import Finances from './pages/Finances'
import Calendar from './pages/Calendar'
import Health from './pages/Health'
import Family from './pages/Family'
import Journal from './pages/Journal'
import Ideas from './pages/Ideas'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import { actingOwner, isDelegating, leaveOs } from './lib/acting'
import { useHiddenTabs } from './lib/nav'

function useClockShort() {
  const now = new Date()
  const hour = now.getHours() % 12 || 12
  const minute = String(now.getMinutes()).padStart(2, '0')
  return `${hour}:${minute} ${now.getHours() < 12 ? 'AM' : 'PM'}`
}

export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const time = useClockShort()
  const guest = isDelegating() ? actingOwner() : null
  const { isHidden } = useHiddenTabs()
  /** A hidden page's route bounces home, so it can't be reached by URL. */
  const page = (path: string, el: React.ReactNode) => (isHidden(path) ? <Navigate to="/home" replace /> : el)

  /**
   * Working inside someone else's OS shows only their business pages — their
   * Work tasks, Companies and Ideas. Their Home tasks, Health, Family,
   * Finances and Journal are not routed at all here, and the sync layer and
   * the database both refuse those keys independently.
   */
  if (guest) {
    return (
      <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>
        <div className="flex items-center gap-3 px-4 py-2.5 shrink-0"
          style={{ background: 'linear-gradient(180deg, var(--color-sidebar) 0%, var(--color-sidebar-2) 100%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={leaveOs} className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg px-2.5 py-1.5 shrink-0"
            style={{ color: '#fff', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)' }}>
            ‹ My dashboard
          </button>
          <img src="/logos/bonalti.png" alt="BONALTI" draggable={false} className="shrink-0" style={{ height: 15, width: 'auto' }} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold leading-tight truncate" style={{ color: '#fff' }}>{guest.name}'s Operating System</div>
            <div className="text-[11px] leading-tight truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
              You're editing their work — business pages only
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex gap-1.5 px-4 pt-3 max-w-[100rem] mx-auto">
            {[['/work-tasks', 'Work tasks'], ['/companies', 'Companies'], ['/ideas', 'Ideas']].map(([to, label]) => (
              <NavLink key={to} to={to}
                className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition"
                style={({ isActive }) => ({
                  background: isActive ? 'var(--color-accent)' : 'var(--color-surface)',
                  color: isActive ? 'var(--color-on-accent)' : 'var(--color-muted)',
                  border: '1px solid var(--color-border)',
                })}>
                {label}
              </NavLink>
            ))}
          </div>
          <div key={location.pathname} className="max-w-[100rem] mx-auto px-5 sm:px-6 md:px-10 pt-5 pb-16">
            <Routes>
              <Route path="/work-tasks" element={<WorkList fixedBoard="Work" />} />
              <Route path="/companies" element={<Companies />} />
              <Route path="/ideas" element={<Ideas />} />
              <Route path="*" element={<Navigate to="/work-tasks" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full" style={{ background: 'var(--color-bg)' }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:block h-full shrink-0">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full shadow-2xl">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 h-full overflow-y-auto">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 glass" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <button onClick={() => setMobileOpen(true)} aria-label="Menu" style={{ color: 'var(--color-text)' }}>
            <IconMenu width={24} height={24} />
          </button>
          <Logo height={24} />
          <span className="ml-auto text-sm tnum font-medium" style={{ color: 'var(--color-muted)' }}>{time}</span>
        </div>

        <div key={location.pathname} className={`${/^\/(home-tasks|work-tasks|companies)/.test(location.pathname) ? 'max-w-[100rem]' : 'max-w-6xl'} mx-auto px-5 sm:px-6 md:px-10 pt-6 md:pt-8 pb-28 lg:pb-8`}>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/home-tasks" element={page('home-tasks', <WorkList fixedBoard="Home" />)} />
            <Route path="/home-care" element={<HomeCare />} />
            <Route path="/work-tasks" element={page('work-tasks', <WorkList fixedBoard="Work" />)} />
            <Route path="/companies" element={page('companies', <Companies />)} />
            <Route path="/team" element={page('team', <Team />)} />
            <Route path="/tasks" element={<Navigate to="/home-tasks" replace />} />
            <Route path="/work" element={<Navigate to="/work-tasks" replace />} />
            <Route path="/finances" element={page('finances', <Finances />)} />
            <Route path="/payments" element={<Navigate to="/finances" replace />} />
            <Route path="/bank" element={<Navigate to="/finances" replace />} />
            <Route path="/calendar" element={page('calendar', <Calendar />)} />
            <Route path="/health" element={page('health', <Health />)} />
            <Route path="/family" element={page('family', <Family />)} />
            <Route path="/journal" element={page('journal', <Journal />)} />
            <Route path="/ideas" element={page('ideas', <Ideas />)} />
            <Route path="/assistant" element={<Navigate to="/journal" replace />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <BottomNav onMore={() => setMobileOpen(true)} />
    </div>
  )
}
