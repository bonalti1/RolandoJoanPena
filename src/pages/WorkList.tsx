import { useEffect, useState } from 'react'
import { Card, PageHeader, Input, Button } from '../components/ui'
import { IconPlus, IconTrash, IconCheck } from '../components/icons'
import { useStore, uid } from '../lib/store'
import { startOfWeek, addDays, toISO, todayISO, isoWeek, formatWeekRange, formatDayShort } from '../lib/dates'

type Item = { id: string; text: string; done: boolean }
type WeekBoard = Record<string, Item[]> // day name -> items
type Board = { backlog: Item[]; weeks: Record<string, WeekBoard> } // weeks keyed by Monday ISO

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const BACKLOG = 'Unscheduled'
const TABS = ['Home', 'Work'] as const
type Tab = (typeof TABS)[number]
const DRAG_MIME = 'application/x-jess-task'

const emptyWeek = (): WeekBoard => Object.fromEntries(DAYS.map((d) => [d, []]))

/** Accept both the new shape and the older { Unscheduled, Monday, … } shape. */
function migrate(raw: unknown): Board {
  const r = raw as Record<string, unknown>
  if (r && Array.isArray(r.backlog) && r.weeks && typeof r.weeks === 'object') {
    return { backlog: r.backlog as Item[], weeks: r.weeks as Record<string, WeekBoard> }
  }
  // Old flat board → move Unscheduled to backlog, days into the current week.
  const old = (r ?? {}) as Record<string, Item[]>
  const week = emptyWeek()
  let hasDayData = false
  for (const d of DAYS) if (Array.isArray(old[d]) && old[d].length) { week[d] = old[d]; hasDayData = true }
  const weeks: Record<string, WeekBoard> = {}
  if (hasDayData) weeks[toISO(startOfWeek(new Date()))] = week
  return { backlog: Array.isArray(old[BACKLOG]) ? old[BACKLOG] : [], weeks }
}

function Bucket({
  name, subtitle, highlight, accent, items, draggingOver, className = '',
  onAdd, onToggle, onRemove, onDropItem, onDragStart, onDragOverBucket, onDragLeaveBucket,
}: {
  name: string; subtitle?: string; highlight?: boolean; accent?: boolean
  items: Item[]; draggingOver: boolean; className?: string
  onAdd: (text: string) => void
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onDropItem: (toBucket: string) => void
  onDragStart: (fromBucket: string, id: string) => void
  onDragOverBucket: (name: string) => void
  onDragLeaveBucket: () => void
}) {
  const [draft, setDraft] = useState('')
  const done = items.filter((i) => i.done).length
  return (
    <Card
      className={`p-4 flex flex-col transition-colors ${className}`}
      style={{
        outline: draggingOver ? '2px solid var(--color-accent)' : highlight ? '2px solid color-mix(in srgb, var(--color-accent) 55%, transparent)' : '2px solid transparent',
        outlineOffset: -2,
        background: accent ? 'color-mix(in srgb, var(--color-accent) 6%, var(--color-surface))' : 'var(--color-surface)',
      }}
    >
      <div
        className="flex items-start justify-between mb-3"
        onDragOver={(e) => { e.preventDefault(); onDragOverBucket(name) }}
        onDragLeave={onDragLeaveBucket}
        onDrop={(e) => { e.preventDefault(); onDropItem(name) }}
      >
        <div>
          <h3 className="font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>{name}</h3>
          {subtitle && (
            <span className="text-xs" style={{ color: highlight ? 'var(--color-accent)' : 'var(--color-muted)', fontWeight: highlight ? 600 : 400 }}>
              {highlight ? 'Today · ' : ''}{subtitle}
            </span>
          )}
        </div>
        {items.length > 0 && <span className="text-xs tnum mt-0.5" style={{ color: 'var(--color-muted)' }}>{done}/{items.length}</span>}
      </div>

      <ul
        className="flex flex-col gap-1 mb-3 min-h-[2.5rem] flex-1"
        onDragOver={(e) => { e.preventDefault(); onDragOverBucket(name) }}
        onDragLeave={onDragLeaveBucket}
        onDrop={(e) => { e.preventDefault(); onDropItem(name) }}
      >
        {items.length === 0 && (
          <li className="text-xs text-center py-3 rounded-lg" style={{ color: 'var(--color-muted)', border: '1px dashed var(--color-border)' }}>
            Drop here
          </li>
        )}
        {items.map((i) => (
          <li
            key={i.id}
            draggable
            onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, '1'); e.dataTransfer.effectAllowed = 'move'; onDragStart(name, i.id) }}
            className="group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing"
            style={{ background: 'var(--color-bg)' }}
          >
            <span className="select-none text-xs leading-none" style={{ color: 'var(--color-muted)' }}>⋮⋮</span>
            <button
              onClick={() => onToggle(i.id)}
              className="h-4 w-4 rounded grid place-items-center shrink-0"
              style={{ border: '2px solid var(--color-accent)', background: i.done ? 'var(--color-accent)' : 'transparent' }}
            >
              {i.done && <IconCheck width={11} height={11} style={{ color: 'var(--color-on-accent)' }} />}
            </button>
            <span className="flex-1 text-sm" style={{ color: 'var(--color-text)', textDecoration: i.done ? 'line-through' : 'none', opacity: i.done ? 0.5 : 1 }}>
              {i.text}
            </span>
            <button onClick={() => onRemove(i.id)} className="opacity-0 group-hover:opacity-60" style={{ color: 'var(--color-muted)' }}>
              <IconTrash width={14} height={14} />
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { onAdd(draft.trim()); setDraft('') } }}
        className="flex gap-1 mt-auto"
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add…" className="!py-1.5 text-sm" />
        <button type="submit" className="shrink-0 rounded-lg px-2" style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}>
          <IconPlus width={16} height={16} />
        </button>
      </form>
    </Card>
  )
}

export default function WorkList() {
  const [tab, setTab] = useState<Tab>('Home')
  const [homeRaw, setHome] = useStore<Board>('work.home', { backlog: [], weeks: {} })
  const [workRaw, setWork] = useStore<Board>('work.work', { backlog: [], weeks: {} })
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [overBucket, setOverBucket] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ from: string; id: string } | null>(null)

  const board = migrate(tab === 'Home' ? homeRaw : workRaw)
  const setBoard = tab === 'Home' ? setHome : setWork
  const weekKey = toISO(weekStart)
  const week = board.weeks[weekKey] ?? emptyWeek()
  const prevKey = toISO(addDays(weekStart, -7))
  const hasPrev = !!board.weeks[prevKey]

  const getBucket = (b: Board, bucket: string): Item[] =>
    bucket === BACKLOG ? b.backlog : (b.weeks[weekKey]?.[bucket] ?? [])
  const setBucket = (b: Board, bucket: string, items: Item[]): Board => {
    if (bucket === BACKLOG) return { ...b, backlog: items }
    const wk = { ...(b.weeks[weekKey] ?? emptyWeek()), [bucket]: items }
    return { ...b, weeks: { ...b.weeks, [weekKey]: wk } }
  }
  const update = (fn: (b: Board) => Board) => setBoard((prev) => fn(migrate(prev)))

  const add = (bucket: string, text: string) =>
    update((b) => setBucket(b, bucket, [...getBucket(b, bucket), { id: uid('w'), text, done: false }]))
  const toggle = (bucket: string, id: string) =>
    update((b) => setBucket(b, bucket, getBucket(b, bucket).map((i) => (i.id === id ? { ...i, done: !i.done } : i))))
  const remove = (bucket: string, id: string) =>
    update((b) => setBucket(b, bucket, getBucket(b, bucket).filter((i) => i.id !== id)))

  const handleDrop = (toBucket: string) => {
    setOverBucket(null)
    if (!drag || drag.from === toBucket) { setDrag(null); return }
    update((b) => {
      const item = getBucket(b, drag.from).find((i) => i.id === drag.id)
      if (!item) return b
      const removed = setBucket(b, drag.from, getBucket(b, drag.from).filter((i) => i.id !== drag.id))
      return setBucket(removed, toBucket, [...getBucket(removed, toBucket), item])
    })
    setDrag(null)
  }

  const copyLastWeek = () =>
    update((b) => {
      const prev = b.weeks[prevKey]
      if (!prev) return b
      const cur = { ...(b.weeks[weekKey] ?? emptyWeek()) }
      for (const d of DAYS) cur[d] = [...(cur[d] ?? []), ...(prev[d] ?? []).map((i) => ({ id: uid('w'), text: i.text, done: false }))]
      return { ...b, weeks: { ...b.weeks, [weekKey]: cur } }
    })

  const thisWeekKey = toISO(startOfWeek(new Date()))
  const isThisWeek = weekKey === thisWeekKey

  // Auto-roll: pull incomplete tasks from past weeks into the real current
  // week (same weekday). Completed tasks stay in history. Runs per board; the
  // count-guard means it stops once there's nothing left to move (no loop).
  const [rolledNote, setRolledNote] = useState(0)
  useEffect(() => {
    const raw = tab === 'Home' ? homeRaw : workRaw
    const b = migrate(raw)
    const movedByDay: Record<string, Item[]> = {}
    const newWeeks: Record<string, WeekBoard> = {}
    let count = 0
    for (const [wk, wkBoard] of Object.entries(b.weeks)) {
      if (wk >= thisWeekKey) { newWeeks[wk] = wkBoard; continue }
      const kept = emptyWeek()
      for (const day of DAYS) {
        for (const it of wkBoard[day] ?? []) {
          if (it.done) kept[day].push(it)
          else { (movedByDay[day] ??= []).push(it); count++ }
        }
      }
      newWeeks[wk] = kept
    }
    if (count === 0) return
    const cur = { ...emptyWeek(), ...(b.weeks[thisWeekKey] ?? {}) }
    for (const day of DAYS) cur[day] = [...(cur[day] ?? []), ...(movedByDay[day] ?? [])]
    newWeeks[thisWeekKey] = cur
    ;(tab === 'Home' ? setHome : setWork)({ ...b, weeks: newWeeks })
    setRolledNote(count)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, homeRaw, workRaw])

  return (
    <div onDragEnd={() => { setDrag(null); setOverBucket(null) }}>
      <PageHeader
        title="Work list"
        subtitle="Plan the week by date. Drag tasks from Unscheduled onto any day."
        action={
          <div className="flex items-center gap-1.5">
            <Button variant="outline" onClick={() => setWeekStart((w) => addDays(w, -7))}>‹</Button>
            <div className="text-center px-2 min-w-[180px]">
              <div className="font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>Week {isoWeek(weekStart)}</div>
              <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{formatWeekRange(weekStart)}</div>
            </div>
            <Button variant="outline" onClick={() => setWeekStart((w) => addDays(w, 7))}>›</Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="inline-flex rounded-xl p-1" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-6 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: tab === t ? 'var(--color-accent)' : 'transparent', color: tab === t ? 'var(--color-on-accent)' : 'var(--color-muted)' }}
            >
              {t}
            </button>
          ))}
        </div>
        {!isThisWeek && (
          <Button variant="outline" onClick={() => setWeekStart(startOfWeek(new Date()))}>This week</Button>
        )}
        {hasPrev && (
          <Button variant="outline" onClick={copyLastWeek} title="Copy last week's tasks into this week">Copy last week</Button>
        )}
      </div>

      {rolledNote > 0 && (
        <button
          onClick={() => { setWeekStart(startOfWeek(new Date())); setRolledNote(0) }}
          className="w-full text-left mb-5 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 transition hover:scale-[1.005]"
          style={{ background: 'color-mix(in srgb, var(--color-accent) 14%, var(--color-surface))', border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)', color: 'var(--color-text)' }}
        >
          ⤴ Rolled over {rolledNote} unfinished task{rolledNote === 1 ? '' : 's'} from earlier weeks into this week.
          {!isThisWeek && <span style={{ color: 'var(--color-accent)' }}>Jump to this week →</span>}
        </button>
      )}

      {(() => {
        const total = DAYS.reduce((s, d) => s + (week[d]?.length ?? 0), 0)
        const done = DAYS.reduce((s, d) => s + (week[d]?.filter((i) => i.done).length ?? 0), 0)
        if (total === 0) return null
        return (
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(done / total) * 100}%`, background: 'var(--color-accent)' }} />
            </div>
            <span className="text-sm font-semibold tnum" style={{ color: 'var(--color-muted)' }}>{done}/{total} done</span>
          </div>
        )
      })()}

      <div className="flex flex-col xl:flex-row gap-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1">
          {DAYS.map((day, idx) => {
            const dayDate = addDays(weekStart, idx)
            return (
              <Bucket
                key={day}
                name={day}
                subtitle={formatDayShort(dayDate)}
                highlight={toISO(dayDate) === todayISO()}
                items={week[day] ?? []}
                draggingOver={overBucket === day}
                onAdd={(text) => add(day, text)}
                onToggle={(id) => toggle(day, id)}
                onRemove={(id) => remove(day, id)}
                onDropItem={handleDrop}
                onDragStart={(from, id) => setDrag({ from, id })}
                onDragOverBucket={setOverBucket}
                onDragLeaveBucket={() => setOverBucket((o) => (o === day ? null : o))}
              />
            )
          })}
        </div>

        <div className="xl:w-72 shrink-0">
          <Bucket
            name={BACKLOG}
            subtitle="Carries across weeks"
            accent
            items={board.backlog}
            draggingOver={overBucket === BACKLOG}
            onAdd={(text) => add(BACKLOG, text)}
            onToggle={(id) => toggle(BACKLOG, id)}
            onRemove={(id) => remove(BACKLOG, id)}
            onDropItem={handleDrop}
            onDragStart={(from, id) => setDrag({ from, id })}
            onDragOverBucket={setOverBucket}
            onDragLeaveBucket={() => setOverBucket((o) => (o === BACKLOG ? null : o))}
            className="xl:sticky xl:top-4"
          />
        </div>
      </div>
    </div>
  )
}
