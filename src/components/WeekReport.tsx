import { useMemo, useState } from 'react'
import { Card, Button } from './ui'
import { useStore } from '../lib/store'
import { useToast } from '../lib/toast'
import { startOfWeek, addDays, toISO, formatWeekRange } from '../lib/dates'

/**
 * The weekly scoreboard: did the non-negotiables actually happen, and what
 * moved this week. Reads the daily scorecard Home writes on every checkmark
 * (`home.nonneg.history`), plus completion timestamps already carried by
 * tasks, ideas and journal entries — so everything except the non-negotiable
 * history works retroactively.
 *
 * The headline is Monday–Friday: a weekday counts as "hit" only when every
 * non-negotiable that applied that day was checked. No partial credit in the
 * headline — partial days show as partial in the grid instead.
 */

type Scope = 'week' | 'weekend' | 'all'
type NonNeg = { id: string; text: string; scope?: Scope }
type HistDay = { done: string[]; total: number }
type WItem = { id: string; done: boolean; completedAt?: number }
type WBoard = { backlog: WItem[]; weeks: Record<string, Record<string, WItem[]>> }
type Idea = { id: string; created: number }
type JEntry = { id: string; ts: number }

const DAY_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const normBoard = (b: unknown): WBoard => {
  const x = (b ?? {}) as WBoard
  return Array.isArray(x.backlog) && x.weeks ? x : { backlog: [], weeks: {} }
}
const everyItem = (b: WBoard): WItem[] =>
  [...b.backlog, ...Object.values(b.weeks).flatMap((w) => Object.values(w).flat())]
const doneBetween = (b: WBoard, from: number, to: number): number =>
  everyItem(b).filter((i) => i.done && i.completedAt && i.completedAt >= from && i.completedAt < to).length

type DayState = 'perfect' | 'partial' | 'missed' | 'future'

export default function WeekReport() {
  const { toast } = useToast()
  const [offset, setOffset] = useState(0)   // 0 = this week, -1 = last week…

  const [nonNegs] = useStore<NonNeg[]>('home.nonneg', [])
  const [history] = useStore<Record<string, HistDay>>('home.nonneg.history', {})
  const [workRaw] = useStore<WBoard>('work.work', { backlog: [], weeks: {} })
  const [homeRaw] = useStore<WBoard>('work.home', { backlog: [], weeks: {} })
  const [ideas] = useStore<Idea[]>('ideas.list', [])
  const [journal] = useStore<JEntry[]>('journal.entries', [])

  const report = useMemo(() => {
    const weekStart = addDays(startOfWeek(new Date()), offset * 7)
    const startMs = weekStart.getTime()
    const endMs = addDays(weekStart, 7).getTime()
    const prevStartMs = addDays(weekStart, -7).getTime()
    const todayIso = toISO(new Date())

    const dayOf = (i: number) => {
      const iso = toISO(addDays(weekStart, i))
      const h = history[iso]
      let state: DayState
      if (iso > todayIso) state = 'future'
      else if (h && h.total > 0 && h.done.length >= h.total) state = 'perfect'
      else if (h && h.done.length > 0) state = 'partial'
      else state = 'missed'
      return { iso, state, done: h?.done.length ?? 0, total: h?.total ?? 0 }
    }
    const days = Array.from({ length: 7 }, (_, i) => dayOf(i))
    const weekdays = days.slice(0, 5)
    const elapsedWeekdays = weekdays.filter((d) => d.state !== 'future')
    const perfect = weekdays.filter((d) => d.state === 'perfect').length

    // Last week's headline, for the trend arrow.
    const prevPerfect = Array.from({ length: 5 }, (_, i) => {
      const h = history[toISO(addDays(weekStart, i - 7))]
      return h && h.total > 0 && h.done.length >= h.total ? 1 : 0
    }).reduce((a: number, b) => a + b, 0)

    // Per-item weekday hit rate — only items that apply on weekdays.
    const items = nonNegs
      .filter((n) => (n.scope ?? 'all') !== 'weekend')
      .map((n) => ({
        text: n.text,
        hits: elapsedWeekdays.filter((d) => history[d.iso]?.done.includes(n.id)).length,
        of: elapsedWeekdays.length,
      }))

    const work = normBoard(workRaw)
    const home = normBoard(homeRaw)
    return {
      label: formatWeekRange(weekStart),
      days, perfect, prevPerfect,
      elapsed: elapsedWeekdays.length,
      items,
      bizDone: doneBetween(work, startMs, endMs),
      bizPrev: doneBetween(work, prevStartMs, startMs),
      homeDone: doneBetween(home, startMs, endMs),
      ideasNew: ideas.filter((i) => i.created >= startMs && i.created < endMs).length,
      journalNew: journal.filter((j) => j.ts >= startMs && j.ts < endMs).length,
    }
  }, [offset, nonNegs, history, workRaw, homeRaw, ideas, journal])

  const trend = report.perfect - report.prevPerfect
  const dayStyle: Record<DayState, React.CSSProperties> = {
    perfect: { background: 'var(--color-accent)', color: 'var(--color-on-accent)' },
    partial: { background: 'color-mix(in srgb, var(--color-accent) 18%, var(--color-surface))', color: 'var(--color-accent)', border: '1px solid var(--color-accent)' },
    missed: { background: 'var(--color-bg)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' },
    future: { background: 'transparent', color: 'var(--color-border)', border: '1px dashed var(--color-border)' },
  }

  const copyReport = () => {
    const lines = [
      `WEEK REPORT — ${report.label}`,
      `Non-negotiables: ${report.perfect}/${offset === 0 ? report.elapsed : 5} perfect weekdays` +
        (offset === 0 && report.elapsed < 5 ? ' (so far)' : '') +
        (trend !== 0 ? ` (${trend > 0 ? '+' : ''}${trend} vs last week)` : ''),
      ...report.items.map((i) => `  • ${i.text}: ${i.hits}/${i.of}`),
      `Business tasks completed: ${report.bizDone}` + (report.bizPrev ? ` (last week ${report.bizPrev})` : ''),
      `Home tasks completed: ${report.homeDone}`,
      `Ideas captured: ${report.ideasNew}`,
      `Journal entries: ${report.journalNew}`,
    ]
    void navigator.clipboard.writeText(lines.join('\n'))
    toast('Report copied — paste it anywhere')
  }

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h2 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>📊 Weekly report</h2>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" onClick={() => setOffset((o) => o - 1)}>‹</Button>
          <span className="text-xs font-semibold min-w-[110px] text-center" style={{ color: 'var(--color-muted)' }}>
            {offset === 0 ? 'This week' : offset === -1 ? 'Last week' : report.label}
          </span>
          <Button variant="outline" onClick={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset === 0}>›</Button>
        </div>
      </div>

      {/* Headline: perfect weekdays */}
      <div className="flex items-baseline gap-2 flex-wrap mt-2">
        <span className="text-3xl font-bold tnum" style={{ color: 'var(--color-accent)' }}>
          {report.perfect}<span className="text-lg font-semibold" style={{ color: 'var(--color-muted)' }}>/{offset === 0 ? Math.max(report.elapsed, 1) : 5}</span>
        </span>
        <span className="text-sm" style={{ color: 'var(--color-text)' }}>
          weekdays with every non-negotiable done{offset === 0 && report.elapsed < 5 ? ' — so far' : ''}
        </span>
        {trend !== 0 && (
          <span className="text-xs font-bold" style={{ color: trend > 0 ? '#16a34a' : '#dc2626' }}>
            {trend > 0 ? '▲' : '▼'} {Math.abs(trend)} vs last week
          </span>
        )}
      </div>

      {/* Day grid — weekend shown but not scored */}
      <div className="flex gap-1.5 mt-3">
        {report.days.map((d, i) => (
          <div key={d.iso} title={d.state === 'future' ? '' : `${d.done}/${d.total || '—'} done`}
            className="flex-1 max-w-[52px] rounded-lg py-1.5 text-center"
            style={{ ...dayStyle[d.state], opacity: i >= 5 ? 0.55 : 1 }}>
            <div className="text-[10px] font-bold">{DAY_LETTER[i]}</div>
            <div className="text-[11px] font-semibold tnum leading-tight">
              {d.state === 'perfect' ? '✓' : d.state === 'future' ? '·' : d.total ? `${d.done}/${d.total}` : '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Per-item hit rates */}
      {report.items.length > 0 && report.elapsed > 0 && (
        <div className="mt-4 flex flex-col gap-1.5">
          {report.items.map((it) => (
            <div key={it.text} className="flex items-center gap-2">
              <span className="text-xs flex-1 min-w-0 truncate" style={{ color: 'var(--color-text)' }}>{it.text}</span>
              <div className="rounded-full overflow-hidden shrink-0" style={{ width: 90, height: 6, background: 'var(--color-bg)' }}>
                <div className="h-full rounded-full" style={{ width: `${it.of ? (it.hits / it.of) * 100 : 0}%`, background: it.hits === it.of ? '#16a34a' : 'var(--color-accent)' }} />
              </div>
              <span className="text-[11px] tnum font-semibold shrink-0 w-8 text-right" style={{ color: 'var(--color-muted)' }}>{it.hits}/{it.of}</span>
            </div>
          ))}
        </div>
      )}

      {/* The rest of the week's output */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        {[
          { label: 'Business tasks done', value: report.bizDone },
          { label: 'Home tasks done', value: report.homeDone },
          { label: 'Ideas captured', value: report.ideasNew },
          { label: 'Journal entries', value: report.journalNew },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-2.5 text-center" style={{ background: 'var(--color-bg)' }}>
            <div className="text-xl font-bold tnum" style={{ color: 'var(--color-text)' }}>{s.value}</div>
            <div className="text-[10px] font-semibold" style={{ color: 'var(--color-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <Button variant="outline" onClick={copyReport}>Copy report</Button>
        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
          Day tracking starts today — past days before this feature show as “—”.
        </span>
      </div>
    </Card>
  )
}
