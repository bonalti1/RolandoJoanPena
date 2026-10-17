import { useState } from 'react'
import { Button, Input } from './ui'
import { useToast } from '../lib/toast'
import { useBotDone } from '../lib/bots'
import { parseDate, toISO } from '../lib/dates'
import {
  addDaysISO, AREAS, mondayOf, prioritiesFor, weekSummary,
  type Area, type HistDay, type NonNeg, type Priorities,
} from '../lib/osCore'

/**
 * Resumen de la semana — what you got done by area (your Home and Work boards
 * plus tasks your bots left you), how each day's non-negotiables went, and
 * your 3 priorities for next week. Bots read the same summary through the
 * bot function (`week_summary`); both run src/lib/osCore.ts.
 *
 * Home owns the data and passes it in, so a tick or a saved priority shows
 * here and on Home at the same moment.
 */

const AREA_NAME: Record<Area, string> = { casa: 'Home', trabajo: 'Work', salud: 'Health', familia: 'Family' }
const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions) => parseDate(iso)?.toLocaleDateString(undefined, opts) ?? iso
const range = (start: string, end: string) => `${fmtDay(start, { month: 'short', day: 'numeric' })} – ${fmtDay(end, { month: 'short', day: 'numeric' })}`

/** Your 3 priorities for a week: shown, or edited in place. */
export function PrioritiesEditor({ initial, onSave, onCancel, saveLabel = 'Save' }: {
  initial: string[]; onSave: (items: string[]) => void; onCancel?: () => void; saveLabel?: string
}) {
  const [draft, setDraft] = useState<string[]>(() => [0, 1, 2].map((i) => initial[i] ?? ''))
  const save = () => onSave(draft.map((d) => d.trim().slice(0, 120)).filter(Boolean))
  return (
    <div className="flex flex-col gap-2">
      {draft.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-full grid place-items-center text-xs font-bold shrink-0" style={{ background: 'var(--color-bg)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>{i + 1}</span>
          <Input value={d} maxLength={120} placeholder={`Priority ${i + 1}`}
            onChange={(e) => setDraft((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }} />
        </div>
      ))}
      <div className="flex gap-2 justify-end mt-1">
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button onClick={save}>{saveLabel}</Button>
      </div>
    </div>
  )
}

export function PriorityList({ items }: { items: string[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((p, i) => (
        <li key={i} className="flex items-start gap-3 text-sm">
          <span className="h-6 w-6 rounded-full grid place-items-center text-xs font-bold shrink-0" style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}>{i + 1}</span>
          <span className="pt-0.5 min-w-0" style={{ color: 'var(--color-text)' }}>{p}</span>
        </li>
      ))}
    </ol>
  )
}

export default function WeekReview({ today, nonNegs, history, todayDone, homeBoard, workBoard, priorities, setPriorities }: {
  today: string
  nonNegs: NonNeg[]
  history: Record<string, HistDay>
  todayDone: string[]
  homeBoard: unknown
  workBoard: unknown
  priorities: Priorities
  setPriorities: (fn: (prev: Priorities) => Priorities) => void
}) {
  const { toast } = useToast()
  const [offset, setOffset] = useState(0)   // 0 = this week, -1 = last week…
  const weekStart = addDaysISO(mondayOf(today), offset * 7)
  const nextWeek = addDaysISO(weekStart, 7)
  const botDone = useBotDone(`${addDaysISO(weekStart, -1)}T00:00:00Z`)
  const s = weekSummary({
    weekStart, today, nonNegs, history, todayDone, homeBoard, workBoard, botDone,
    dayOf: (ms) => toISO(new Date(ms)),
  })
  const busiest = AREAS.reduce((a, b) => (s.by_area[b].count > s.by_area[a].count ? b : a), AREAS[0])
  const [areaPick, setAreaPick] = useState<Area | null>(null)
  const area = areaPick ?? busiest
  const [editing, setEditing] = useState(false)
  const next = prioritiesFor(priorities, nextWeek)

  const savePriorities = (items: string[]) => {
    setPriorities((prev) => ({ ...prev, [nextWeek]: items }))
    setEditing(false)
    toast(items.length ? 'Saved — they’ll be on Home all next week' : 'Priorities cleared')
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm" style={{ color: 'var(--color-muted)' }}>
          <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{offset === 0 ? 'This week' : offset === -1 ? 'Last week' : 'Week'}</span> · {range(s.week_start, s.week_end)}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" onClick={() => { setOffset((o) => o - 1); setAreaPick(null) }} aria-label="Previous week">‹</Button>
          <Button variant="outline" onClick={() => { setOffset((o) => Math.min(0, o + 1)); setAreaPick(null) }} disabled={offset === 0} aria-label="Next week">›</Button>
        </div>
      </div>

      {/* What got done, by area */}
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-muted)' }}>Done by area</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {AREAS.map((a) => (
            <button key={a} onClick={() => setAreaPick(a)} className="rounded-xl p-2.5 text-left transition"
              aria-pressed={a === area}
              style={{ background: 'var(--color-bg)', border: `1px solid ${a === area ? 'var(--color-accent)' : 'transparent'}` }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{s.by_area[a].count}</div>
              <div className="text-[11px] font-semibold" style={{ color: 'var(--color-muted)' }}>{AREA_NAME[a]}</div>
            </button>
          ))}
        </div>
        {s.by_area[area].items.length === 0 ? (
          <p className="text-sm mt-3" style={{ color: 'var(--color-muted)' }}>Nothing finished in {AREA_NAME[area]} this week.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 mt-3">
            {s.by_area[area].items.map((it, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="text-xs w-9 shrink-0" style={{ color: 'var(--color-muted)' }}>{fmtDay(it.date, { weekday: 'short' })}</span>
                <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--color-text)' }}>{it.title}</span>
                {it.source === 'bot' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--color-bg)', color: 'var(--color-muted)' }}>bot</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Non-negotiables, day by day */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Non-negotiables by day</h4>
          {s.average_percent !== null && <span className="text-xs" style={{ color: 'var(--color-muted)' }}>Average <b style={{ color: 'var(--color-text)' }}>{s.average_percent}%</b></span>}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {s.non_negotiables.map((d) => {
            const future = d.percent === null
            const tip = future ? '' : `${fmtDay(d.date, { weekday: 'long', month: 'short', day: 'numeric' })} — ${d.done} of ${d.total} (${d.percent}%)`
            return (
              <div key={d.date} className="flex flex-col items-center" title={tip} tabIndex={future ? -1 : 0} aria-label={tip || `${d.weekday}: not yet`}>
                <div className="h-16 w-full flex items-end justify-center">
                  <div className="w-6 rounded-t-[4px]"
                    style={future
                      ? { height: '100%', border: '1px dashed var(--color-border)', borderRadius: 4 }
                      : { height: `${Math.max(d.percent ?? 0, 3)}%`, background: d.percent ? 'var(--color-accent)' : 'var(--color-border)' }} />
                </div>
                <div className="text-[11px] font-semibold mt-1" style={{ color: d.date === today ? 'var(--color-accent)' : 'var(--color-text)' }}>{d.weekday.slice(0, 3)}</div>
                <div className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{future ? '·' : `${d.percent}%`}</div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Next week's 3 priorities */}
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-muted)' }}>
          {offset === 0 ? 'Next week’s 3 priorities' : 'Priorities that week'} · {range(offset === 0 ? nextWeek : weekStart, addDaysISO(offset === 0 ? nextWeek : weekStart, 6))}
        </h4>
        {offset !== 0 ? (
          prioritiesFor(priorities, weekStart).length
            ? <PriorityList items={prioritiesFor(priorities, weekStart)} />
            : <p className="text-sm" style={{ color: 'var(--color-muted)' }}>None were set.</p>
        ) : editing || next.length === 0 ? (
          <PrioritiesEditor key={nextWeek} initial={next} onSave={savePriorities} onCancel={next.length ? () => setEditing(false) : undefined} saveLabel="Save priorities" />
        ) : (
          <>
            <PriorityList items={next} />
            <button onClick={() => setEditing(true)} className="text-xs font-semibold mt-3" style={{ color: 'var(--color-accent)' }}>Edit</button>
          </>
        )}
      </section>
    </div>
  )
}
