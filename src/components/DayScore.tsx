import type { Score } from '../lib/osCore'

/**
 * Marcador del día: how much of today's non-negotiables is done, and how many
 * days in a row you've hit 100%. Reads the same check-ins as the
 * Non-negotiables card (home.nonneg.today / home.nonneg.history).
 */
export default function DayScore({ score, streak }: { score: Score; streak: { current: number; best: number } }) {
  const none = score.total === 0
  const days = (n: number) => (n === 1 ? 'day' : 'days')
  return (
    <>
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <span className="text-[44px] font-bold leading-none" style={{ color: 'var(--color-text)' }}>{none ? '—' : `${score.percent}%`}</span>
        <span className="text-sm" style={{ color: 'var(--color-muted)' }}>
          {none ? 'No non-negotiables today' : score.done >= score.total ? 'Perfect day 🎉' : `${score.done} of ${score.total} non-negotiables done`}
        </span>
      </div>
      <div className="h-2 rounded-full mt-3 overflow-hidden" role="meter" aria-label="Today's non-negotiables done"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={score.percent}
        style={{ background: 'color-mix(in srgb, var(--color-accent) 16%, var(--color-surface))' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score.percent}%`, background: 'var(--color-accent)' }} />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        {[
          { label: streak.current ? 'Current streak 🔥' : 'Current streak', value: streak.current },
          { label: 'Best streak', value: streak.best },
        ].map((s) => (
          <div key={s.label} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--color-bg)' }}>
            <div className="text-[11px] font-semibold whitespace-nowrap" style={{ color: 'var(--color-muted)' }}>{s.label}</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{s.value}</span>
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{days(s.value)}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] mt-2" style={{ color: 'var(--color-muted)' }}>Days in a row with every non-negotiable done.</p>
    </>
  )
}
