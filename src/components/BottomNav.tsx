import { NavLink } from 'react-router-dom'
import { IconHome, IconWork, IconTasks, IconIdea, IconOffice } from './icons'
import { useHiddenTabs } from '../lib/nav'
import { usePendingCount } from '../lib/office'

/**
 * Thumb-reachable bottom tab bar for phones (hidden on lg+, where the sidebar
 * takes over). Holds the daily-use destinations; everything else lives behind
 * "More", which opens the full menu drawer.
 */

const TABS = [
  { to: '/home', label: 'Home', Icon: IconHome },
  { to: '/oficina', label: 'Oficina', Icon: IconOffice },
  { to: '/work-tasks', label: 'Work', Icon: IconWork },
  { to: '/home-tasks', label: 'Tasks', Icon: IconTasks },
  // Ideas takes the fourth slot: they arrive at random moments and have to be
  // one thumb-tap away. Journal lives on behind More.
  { to: '/ideas', label: 'Ideas', Icon: IconIdea },
]

function IconMore({ width = 22, height = 22 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="19" cy="12" r="1.9" />
    </svg>
  )
}

export default function BottomNav({ onMore, dark = false }: { onMore: () => void; dark?: boolean }) {
  const { isHidden } = useHiddenTabs()
  const tabs = TABS.filter((t) => !isHidden(t.to))
  const pending = usePendingCount()
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 glass"
      style={{ background: dark ? '#000' : 'var(--color-surface)', borderTop: dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid var(--color-border)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className="flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 min-h-[56px] transition-colors"
            style={({ isActive }) => ({ color: dark ? (isActive ? '#fff' : 'rgba(255,255,255,0.55)') : isActive ? 'var(--color-accent)' : 'var(--color-muted)' })}
          >
            {({ isActive }) => (
              <>
                <span className="relative" style={{ transform: isActive ? 'translateY(-1px)' : 'none', transition: 'transform .15s' }}>
                  <Icon width={22} height={22} />
                  {to === '/oficina' && pending > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full grid place-items-center text-[10px] font-bold tnum"
                      style={{ background: '#facc15', color: '#000' }}>{pending > 99 ? '99+' : pending}</span>
                  )}
                </span>
                <span className="text-[10px] font-semibold tracking-tight">{label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={onMore}
          className="flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 min-h-[56px]"
          style={{ color: dark ? 'rgba(255,255,255,0.55)' : 'var(--color-muted)' }}
          aria-label="More"
        >
          <IconMore />
          <span className="text-[10px] font-semibold tracking-tight">More</span>
        </button>
      </div>
    </nav>
  )
}
