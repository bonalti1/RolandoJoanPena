import { useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import { IconMenu } from './components/icons'
import Home from './pages/Home'
import Tasks from './pages/Tasks'
import WorkList from './pages/WorkList'
import Payments from './pages/Payments'
import Bank from './pages/Bank'
import Calendar from './pages/Calendar'
import Health from './pages/Health'
import Family from './pages/Family'
import Journal from './pages/Journal'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'

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
          <span className="font-signature text-2xl leading-none" style={{ color: 'var(--color-text)' }}>Rolando Joan</span>
          <span className="ml-auto text-sm tnum font-medium" style={{ color: 'var(--color-muted)' }}>{time}</span>
        </div>

        <div key={location.pathname} className="max-w-6xl mx-auto px-5 sm:px-6 md:px-10 py-6 md:py-8">
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/work" element={<WorkList />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/bank" element={<Bank />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/health" element={<Health />} />
            <Route path="/family" element={<Family />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/assistant" element={<Navigate to="/journal" replace />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
