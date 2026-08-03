import { useEffect, useState } from 'react'
import { Card, PageHeader, Input, Button } from '../components/ui'
import { IconPlus, IconTrash, IconCheck } from '../components/icons'
import { useStore, uid } from '../lib/store'
import { startOfWeek, addDays, toISO, todayISO, isoWeek, formatWeekRange } from '../lib/dates'

type Cat = 'Home' | 'Work' | 'Errands' | 'Someday'
type Item = { id: string; text: string; done: boolean; completedAt?: number; cat?: Cat; notes?: string; time?: string }
type WeekBoard = Record<string, Item[]> // day name -> items
type Board = { backlog: Item[]; weeks: Record<string, WeekBoard> }

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_SHORT: Record<string, string> = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' }
const BACKLOG = 'Unscheduled'
type Tab = 'Home' | 'Work'
const CATS: Cat[] = ['Home', 'Work', 'Errands', 'Someday']
const DRAG_MIME = 'application/x-jess-task'

const emptyWeek = (): WeekBoard => Object.fromEntries(DAYS.map((d) => [d, []]))

/** Accept both the new shape and the older { Unscheduled, Monday, … } shape. */
function migrate(raw: unknown): Board {
  const r = raw as Record<string, unknown>
  if (r && Array.isArray(r.backlog) && r.weeks && typeof r.weeks === 'object') {
    return { backlog: r.backlog as Item[], weeks: r.weeks as Record<string, WeekBoard> }
  }
  const old = (r ?? {}) as Record<string, Item[]>
  const week = emptyWeek()
  let hasDayData = false
  for (const d of DAYS) if (Array.isArray(old[d]) && old[d].length) { week[d] = old[d]; hasDayData = true }
  const weeks: Record<string, WeekBoard> = {}
  if (hasDayData) weeks[toISO(startOfWeek(new Date()))] = week
  return { backlog: Array.isArray(old[BACKLOG]) ? old[BACKLOG] : [], weeks }
}

function TaskRow({ item, showCat, onToggle, onRemove, onOpen, onDragStart }: {
  item: Item; showCat?: boolean
  onToggle: () => void; onRemove: () => void; onOpen: () => void; onDragStart: () => void
}) {
  return (
    <li
      draggable
      onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, '1'); e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      className="group flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing"
      style={{ background: 'var(--color-bg)' }}
    >
      <span className="select-none text-xs leading-none shrink-0" style={{ color: 'var(--color-muted)' }}>⋮⋮</span>
      <button onClick={onToggle} className="h-4 w-4 rounded grid place-items-center shrink-0" style={{ border: '2px solid var(--color-accent)', background: item.done ? 'var(--color-accent)' : 'transparent' }} aria-label="Toggle done">
        {item.done && <IconCheck width={11} height={11} style={{ color: 'var(--color-on-accent)' }} />}
      </button>
      <button onClick={onOpen} className="flex-1 min-w-0 text-left text-sm truncate" style={{ color: 'var(--color-text)', textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.5 : 1 }}>
        {item.text}
      </button>
      {item.time && <span className="text-[10px] tnum shrink-0" style={{ color: 'var(--color-accent)' }}>{item.time}</span>}
      {showCat && item.cat && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--color-surface)', color: 'var(--color-muted)' }}>{item.cat}</span>}
      <button onClick={onRemove} className="opacity-0 group-hover:opacity-60 shrink-0" style={{ color: 'var(--color-muted)' }} aria-label="Delete"><IconTrash width={13} height={13} /></button>
    </li>
  )
}

export default function WorkList({ fixedBoard }: { fixedBoard?: Tab }) {
  const tab: Tab = fixedBoard ?? 'Home'
  const [homeRaw, setHome] = useStore<Board>('work.home', { backlog: [], weeks: {} })
  const [workRaw, setWork] = useStore<Board>('work.work', { backlog: [], weeks: {} })
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [overBucket, setOverBucket] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ from: string; id: string } | null>(null)
  const [selected, setSelected] = useState<{ bucket: string; id: string } | null>(null)
  const [addingCol, setAddingCol] = useState<string | null>(null)
  const [addDraft, setAddDraft] = useState('')
  const [masterAdding, setMasterAdding] = useState(false)
  const [masterDraft, setMasterDraft] = useState('')
  const [masterCat, setMasterCat] = useState<Cat>('Home')
  const [catFilter, setCatFilter] = useState<'All' | Cat>('All')
  const [rolledNote, setRolledNote] = useState(0)

  const board = migrate(tab === 'Home' ? homeRaw : workRaw)
  const setBoard = tab === 'Home' ? setHome : setWork
  const weekKey = toISO(weekStart)
  const week = board.weeks[weekKey] ?? emptyWeek()
  const prevKey = toISO(addDays(weekStart, -7))
  const hasPrev = !!board.weeks[prevKey]
  const thisWeekKey = toISO(startOfWeek(new Date()))
  const isThisWeek = weekKey === thisWeekKey

  const getBucket = (b: Board, bucket: string): Item[] => bucket === BACKLOG ? b.backlog : (b.weeks[weekKey]?.[bucket] ?? [])
  const setBucket = (b: Board, bucket: string, items: Item[]): Board => {
    if (bucket === BACKLOG) return { ...b, backlog: items }
    const wk = { ...(b.weeks[weekKey] ?? emptyWeek()), [bucket]: items }
    return { ...b, weeks: { ...b.weeks, [weekKey]: wk } }
  }
  const update = (fn: (b: Board) => Board) => setBoard((prev) => fn(migrate(prev)))

  const add = (bucket: string, text: string, cat?: Cat) =>
    update((b) => setBucket(b, bucket, [...getBucket(b, bucket), { id: uid('w'), text, done: false, ...(cat ? { cat } : {}) }]))
  const toggle = (bucket: string, id: string) =>
    update((b) => setBucket(b, bucket, getBucket(b, bucket).map((i) => (i.id === id ? { ...i, done: !i.done, completedAt: !i.done ? Date.now() : undefined } : i))))
  const remove = (bucket: string, id: string) =>
    update((b) => setBucket(b, bucket, getBucket(b, bucket).filter((i) => i.id !== id)))
  const updateItem = (bucket: string, id: string, patch: Partial<Item>) =>
    update((b) => setBucket(b, bucket, getBucket(b, bucket).map((i) => (i.id === id ? { ...i, ...patch } : i))))
  const moveItem = (from: string, to: string, id: string) => {
    if (from === to) return
    update((b) => {
      const item = getBucket(b, from).find((i) => i.id === id); if (!item) return b
      const removed = setBucket(b, from, getBucket(b, from).filter((i) => i.id !== id))
      return setBucket(removed, to, [...getBucket(removed, to), item])
    })
  }
  const handleDrop = (toBucket: string) => {
    setOverBucket(null)
    if (!drag || drag.from === toBucket) { setDrag(null); return }
    moveItem(drag.from, toBucket, drag.id)
    setDrag(null)
  }

  const copyLastWeek = () =>
    update((b) => {
      const prev = b.weeks[prevKey]; if (!prev) return b
      const cur = { ...(b.weeks[weekKey] ?? emptyWeek()) }
      for (const d of DAYS) cur[d] = [...(cur[d] ?? []), ...(prev[d] ?? []).map((i) => ({ id: uid('w'), text: i.text, done: false }))]
      return { ...b, weeks: { ...b.weeks, [weekKey]: cur } }
    })

  // Auto-roll: pull incomplete tasks from past weeks into the current week.
  useEffect(() => {
    const b = migrate(tab === 'Home' ? homeRaw : workRaw)
    const movedByDay: Record<string, Item[]> = {}
    const newWeeks: Record<string, WeekBoard> = {}
    let count = 0
    for (const [wk, wkBoard] of Object.entries(b.weeks)) {
      if (wk >= thisWeekKey) { newWeeks[wk] = wkBoard; continue }
      const kept = emptyWeek()
      for (const day of DAYS) for (const it of wkBoard[day] ?? []) {
        if (it.done) kept[day].push(it); else { (movedByDay[day] ??= []).push(it); count++ }
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

  const weekTotal = DAYS.reduce((s, d) => s + (week[d]?.length ?? 0), 0)
  const weekDone = DAYS.reduce((s, d) => s + (week[d]?.filter((i) => i.done).length ?? 0), 0)
  const masterItems = board.backlog.filter((i) => !i.done).filter((i) => catFilter === 'All' || i.cat === catFilter)
  const selItem = selected ? getBucket(board, selected.bucket).find((i) => i.id === selected.id) ?? null : null

  const submitColAdd = (day: string) => { const t = addDraft.trim(); if (t) { add(day, t); setAddDraft('') } }
  const submitMaster = () => { const t = masterDraft.trim(); if (t) { add(BACKLOG, t, masterCat); setMasterDraft('') } }

  const completed = [
    ...DAYS.flatMap((day) => (week[day] ?? []).filter((i) => i.done).map((i) => ({ item: i, where: day }))),
    ...board.backlog.filter((i) => i.done).map((i) => ({ item: i, where: BACKLOG })),
  ].sort((a, b) => (b.item.completedAt ?? 0) - (a.item.completedAt ?? 0))
  const fmtDone = (ts?: number) => ts ? new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

  return (
    <div onDragEnd={() => { setDrag(null); setOverBucket(null) }}>
      <PageHeader
        title={fixedBoard ? `${fixedBoard} tasks` : 'Work list'}
        subtitle="Plan your week by dragging tasks onto a day."
        action={
          <div className="flex items-center gap-1.5">
            <Button variant="outline" onClick={() => setWeekStart((w) => addDays(w, -7))}>‹</Button>
            <div className="text-center px-2 min-w-[150px]">
              <div className="font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>Week {isoWeek(weekStart)}</div>
              <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{formatWeekRange(weekStart)}</div>
            </div>
            <Button variant="outline" onClick={() => setWeekStart((w) => addDays(w, 7))}>›</Button>
          </div>
        }
      />

      {/* Weekly progress — kept close to the title */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[220px]">
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${weekTotal ? (weekDone / weekTotal) * 100 : 0}%`, background: 'var(--color-accent)' }} />
          </div>
          <span className="text-sm font-semibold tnum shrink-0" style={{ color: 'var(--color-muted)' }}>{weekDone}/{weekTotal}</span>
        </div>
        {!isThisWeek && <Button variant="outline" onClick={() => setWeekStart(startOfWeek(new Date()))}>This week</Button>}
        {hasPrev && <Button variant="outline" onClick={copyLastWeek} title="Copy last week's tasks">Copy last week</Button>}
      </div>

      {rolledNote > 0 && (
        <button onClick={() => { setWeekStart(startOfWeek(new Date())); setRolledNote(0) }} className="w-full text-left mb-4 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))', border: '1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)', color: 'var(--color-text)' }}>
          ⤴ Rolled over {rolledNote} unfinished task{rolledNote === 1 ? '' : 's'} into this week.{!isThisWeek && <span style={{ color: 'var(--color-accent)' }}> Jump to this week →</span>}
        </button>
      )}

      {/* Week across the top — 7 columns on desktop, swipeable on mobile */}
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 lg:grid lg:grid-cols-7 lg:overflow-visible">
        {DAYS.map((day, idx) => {
          const dayDate = addDays(weekStart, idx)
          const isToday = toISO(dayDate) === todayISO()
          const items = (week[day] ?? []).filter((i) => !i.done)
          const over = overBucket === day
          return (
            <div
              key={day}
              onDragOver={(e) => { e.preventDefault(); if (overBucket !== day) setOverBucket(day) }}
              onDragLeave={() => setOverBucket((o) => (o === day ? null : o))}
              onDrop={(e) => { e.preventDefault(); handleDrop(day) }}
              className="snap-start shrink-0 min-w-[78%] sm:min-w-[46%] md:min-w-[31%] lg:min-w-0 flex flex-col rounded-2xl p-2.5 min-h-[240px] transition-colors"
              style={{
                background: over ? 'color-mix(in srgb, var(--color-accent) 14%, var(--color-surface))' : isToday ? 'color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))' : 'var(--color-surface)',
                border: `1px solid ${over ? 'var(--color-accent)' : 'var(--color-border)'}`,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div className="flex items-baseline justify-between px-1 mb-2">
                <span className="font-semibold text-sm" style={{ color: isToday ? 'var(--color-accent)' : 'var(--color-text)' }}>{DAY_SHORT[day]}</span>
                <span className="text-[11px] tnum" style={{ color: isToday ? 'var(--color-accent)' : 'var(--color-muted)' }}>{dayDate.getDate()}</span>
              </div>
              <ul className="flex flex-col gap-1 flex-1">
                {items.map((i) => (
                  <TaskRow key={i.id} item={i} onToggle={() => toggle(day, i.id)} onRemove={() => remove(day, i.id)} onOpen={() => setSelected({ bucket: day, id: i.id })} onDragStart={() => setDrag({ from: day, id: i.id })} />
                ))}
              </ul>
              {addingCol === day ? (
                <input
                  autoFocus value={addDraft}
                  onChange={(e) => setAddDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitColAdd(day); if (e.key === 'Escape') { setAddingCol(null); setAddDraft('') } }}
                  onBlur={() => { submitColAdd(day); setAddingCol(null) }}
                  placeholder="Task…"
                  className="mt-1 rounded-lg px-2 py-1 text-sm outline-none w-full"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              ) : (
                <button onClick={() => { setAddingCol(day); setAddDraft('') }} className="mt-1 text-xs font-semibold flex items-center gap-1 px-1 py-1 opacity-70 hover:opacity-100 transition" style={{ color: 'var(--color-accent)' }}>
                  <IconPlus width={13} height={13} /> Add
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Master List — everything not yet scheduled */}
      <div
        className="rounded-[20px] p-4 mt-5"
        onDragOver={(e) => { e.preventDefault(); if (overBucket !== BACKLOG) setOverBucket(BACKLOG) }}
        onDragLeave={() => setOverBucket((o) => (o === BACKLOG ? null : o))}
        onDrop={(e) => { e.preventDefault(); handleDrop(BACKLOG) }}
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)', outline: overBucket === BACKLOG ? '2px solid var(--color-accent)' : '2px solid transparent', outlineOffset: -2 }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>Master List</h2>
          <button onClick={() => setMasterAdding((v) => !v)} className="text-sm font-semibold flex items-center gap-1" style={{ color: 'var(--color-accent)' }}><IconPlus width={15} height={15} /> Add task</button>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {(['All', ...CATS] as const).map((c) => (
            <button key={c} onClick={() => setCatFilter(c)} className="text-xs font-semibold px-3 py-1 rounded-full transition" style={{ background: catFilter === c ? 'var(--color-accent)' : 'var(--color-bg)', color: catFilter === c ? 'var(--color-on-accent)' : 'var(--color-muted)', border: '1px solid var(--color-border)' }}>{c}</button>
          ))}
        </div>

        {masterAdding && (
          <div className="flex gap-2 mb-3 flex-wrap">
            <input autoFocus value={masterDraft} onChange={(e) => setMasterDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitMaster(); if (e.key === 'Escape') setMasterAdding(false) }} placeholder="New task…" className="flex-1 min-w-[160px] rounded-lg px-3 py-2 text-sm outline-none" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
            <select value={masterCat} onChange={(e) => setMasterCat(e.target.value as Cat)} className="rounded-lg px-2 py-2 text-sm outline-none" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
              {CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <Button onClick={submitMaster}>Add</Button>
          </div>
        )}

        {masterItems.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--color-muted)' }}>
            {board.backlog.filter((i) => !i.done).length === 0 ? 'Nothing here yet. Add tasks, then drag them up onto a day.' : 'No tasks in this category.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {masterItems.map((i) => (
              <TaskRow key={i.id} item={i} showCat onToggle={() => toggle(BACKLOG, i.id)} onRemove={() => remove(BACKLOG, i.id)} onOpen={() => setSelected({ bucket: BACKLOG, id: i.id })} onDragStart={() => setDrag({ from: BACKLOG, id: i.id })} />
            ))}
          </ul>
        )}
      </div>

      {completed.length > 0 && (
        <Card className="p-4 mt-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--color-muted)' }}>
            <IconCheck width={15} height={15} /> Completed this week ({completed.length})
          </h3>
          <ul className="flex flex-col gap-1">
            {completed.map(({ item, where }) => (
              <li key={item.id} className="group flex items-center gap-2 py-1.5 px-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                <button onClick={() => toggle(where, item.id)} className="h-4 w-4 rounded grid place-items-center shrink-0" style={{ border: '2px solid var(--color-accent)', background: 'var(--color-accent)' }} title="Mark not done">
                  <IconCheck width={11} height={11} style={{ color: 'var(--color-on-accent)' }} />
                </button>
                <span className="flex-1 text-sm" style={{ color: 'var(--color-text)', textDecoration: 'line-through', opacity: 0.6 }}>{item.text}</span>
                <span className="text-xs tnum shrink-0" style={{ color: 'var(--color-muted)' }}>{where === BACKLOG ? 'Master List' : where} · {fmtDone(item.completedAt)}</span>
                <button onClick={() => remove(where, item.id)} className="opacity-0 group-hover:opacity-60" style={{ color: 'var(--color-muted)' }}><IconTrash width={14} height={14} /></button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Task detail drawer */}
      {selItem && selected && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setSelected(null)} />
          <div className="fixed right-0 top-0 z-50 h-full w-full sm:w-96 p-5 overflow-y-auto" style={{ background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>Task details</h3>
              <button onClick={() => setSelected(null)} className="text-lg" style={{ color: 'var(--color-muted)' }} aria-label="Close">✕</button>
            </div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Task</label>
            <Input value={selItem.text} onChange={(e) => updateItem(selected.bucket, selItem.id, { text: e.target.value })} className="mb-3 mt-1" />
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Notes</label>
            <textarea value={selItem.notes ?? ''} onChange={(e) => updateItem(selected.bucket, selItem.id, { notes: e.target.value })} rows={4} placeholder="Add notes…" className="w-full mb-3 mt-1 rounded-xl px-3 py-2 text-sm outline-none resize-y" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Due time</label>
                <input type="time" value={selItem.time ?? ''} onChange={(e) => updateItem(selected.bucket, selItem.id, { time: e.target.value || undefined })} className="w-full mt-1 rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Category</label>
                <select value={selItem.cat ?? ''} onChange={(e) => updateItem(selected.bucket, selItem.id, { cat: (e.target.value || undefined) as Cat | undefined })} className="w-full mt-1 rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                  <option value="">—</option>
                  {CATS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Move to</label>
            <select value={selected.bucket} onChange={(e) => { const to = e.target.value; moveItem(selected.bucket, to, selItem.id); setSelected({ bucket: to, id: selItem.id }) }} className="w-full mt-1 mb-5 rounded-xl px-3 py-2 text-sm outline-none" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
              <option value={BACKLOG}>Master List</option>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <Button variant="outline" onClick={() => { remove(selected.bucket, selItem.id); setSelected(null) }} style={{ color: '#c0504d' }}><IconTrash width={15} height={15} /> Delete task</Button>
          </div>
        </>
      )}
    </div>
  )
}
