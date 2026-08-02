import { useMemo, useRef, useState } from 'react'
import { Card, PageHeader, Button, Input, EmptyState } from '../components/ui'
import { IconPlus, IconTrash, IconCheck, IconTasks } from '../components/icons'
import { useStore, uid } from '../lib/store'
import { useToast } from '../lib/toast'
import { formatDueLabel, daysUntil, isoWeek, parseDate, monthShort, startOfWeek, addDays, toISO } from '../lib/dates'

type Task = { id: string; text: string; done: boolean; created: number; due?: string }

/** A compact date control that displays the due date as "Week N · Mon D". */
function DuePill({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const days = value ? daysUntil(value) : null
  const overdue = days !== null && days < 0
  const today = days === 0
  const color = overdue ? '#d97a7a' : today ? 'var(--color-accent)' : 'var(--color-muted)'
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => ref.current?.showPicker?.()}
        className="text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap transition"
        style={{ color, background: value ? 'color-mix(in srgb, currentColor 12%, transparent)' : 'var(--color-bg)', border: '1px solid var(--color-border)' }}
      >
        {value ? formatDueLabel(value) : '＋ Date'}
      </button>
      <input
        ref={ref}
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="absolute inset-0 opacity-0 cursor-pointer"
        aria-label="Due date"
      />
    </div>
  )
}

export default function Tasks() {
  const [tasks, setTasks] = useStore<Task[]>('tasks.master', [])
  const [dump, setDump] = useStore<Task[]>('tasks.dump', [])
  const { removeWithUndo } = useToast()
  const [draft, setDraft] = useState('')
  const [draftDue, setDraftDue] = useState('')
  const [dumpDraft, setDumpDraft] = useState('')

  const addTask = (text: string, due?: string) => {
    const t = text.trim()
    if (!t) return
    setTasks((prev) => [{ id: uid('t'), text: t, done: false, created: Date.now(), due: due || undefined }, ...prev])
    setDraft(''); setDraftDue('')
  }

  const addDump = () => {
    const t = dumpDraft.trim()
    if (!t) return
    setDump((prev) => [{ id: uid('d'), text: t, done: false, created: Date.now() }, ...prev])
    setDumpDraft('')
  }

  const toggle = (id: string) =>
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, done: !x.done } : x)))
  const setDue = (id: string, due: string | undefined) =>
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, due } : x)))
  const removeTask = (id: string) => {
    const t = tasks.find((x) => x.id === id)
    if (!t) return
    removeWithUndo('Task deleted', () => setTasks((prev) => prev.filter((x) => x.id !== id)), () => setTasks((prev) => [t, ...prev]))
  }
  const removeDump = (id: string) => setDump((prev) => prev.filter((x) => x.id !== id))

  const promote = (item: Task) => {
    addTask(item.text)
    removeDump(item.id)
  }

  // Sort: open tasks first, then by due date (undated last), then newest.
  const sorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      if (a.due && b.due) return a.due.localeCompare(b.due)
      if (a.due) return -1
      if (b.due) return 1
      return b.created - a.created
    })
  }, [tasks])

  const remaining = tasks.filter((t) => !t.done).length

  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'overdue'>('all')
  const [group, setGroup] = useState<'none' | 'week' | 'month'>('none')

  const filtered = useMemo(() => {
    const todayStr = toISO(new Date())
    const ws = toISO(startOfWeek(new Date()))
    const we = toISO(addDays(startOfWeek(new Date()), 6))
    return sorted.filter((t) => {
      if (filter === 'all') return true
      if (!t.due) return false
      if (filter === 'today') return t.due === todayStr
      if (filter === 'week') return t.due >= ws && t.due <= we
      if (filter === 'overdue') return !t.done && (daysUntil(t.due) ?? 0) < 0
      return true
    })
  }, [sorted, filter])

  const grouped = useMemo(() => {
    if (group === 'none') return null
    const map = new Map<string, Task[]>()
    for (const t of filtered) {
      const d = t.due ? parseDate(t.due) : null
      const keyName = !d ? 'No date' : group === 'week' ? `Week ${isoWeek(d)}` : `${monthShort(d)} ${d.getFullYear()}`
      if (!map.has(keyName)) map.set(keyName, [])
      map.get(keyName)!.push(t)
    }
    return Array.from(map.entries())
  }, [filtered, group])

  const renderRow = (t: Task) => (
    <li key={t.id} className="group flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-black/5">
      <button onClick={() => toggle(t.id)} className="h-5 w-5 rounded-md grid place-items-center shrink-0 transition"
        style={{ border: '2px solid var(--color-accent)', background: t.done ? 'var(--color-accent)' : 'transparent' }} aria-label="toggle">
        {t.done && <IconCheck width={13} height={13} style={{ color: 'var(--color-on-accent)' }} />}
      </button>
      <span className="flex-1 text-sm min-w-0 truncate" style={{ color: 'var(--color-text)', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.5 : 1 }}>{t.text}</span>
      <DuePill value={t.due} onChange={(v) => setDue(t.id, v)} />
      <button onClick={() => removeTask(t.id)} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 shrink-0" style={{ color: 'var(--color-muted)' }}><IconTrash width={16} height={16} /></button>
    </li>
  )

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'today', label: 'Today' }, { key: 'week', label: 'This week' }, { key: 'overdue', label: 'Overdue' },
  ]

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="The Alastair Method — a master checklist plus a brain dump for everything else."
      />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Master checklist */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>Master checklist</h2>
            <span className="text-sm" style={{ color: 'var(--color-muted)' }}>{remaining} left</span>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); addTask(draft, draftDue) }} className="flex gap-2 mb-4">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a task…" />
            <input
              type="date"
              value={draftDue}
              onChange={(e) => setDraftDue(e.target.value)}
              title="Optional due date"
              className="rounded-xl px-2 text-sm outline-none shrink-0"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
            />
            <Button type="submit"><IconPlus width={18} height={18} /></Button>
          </form>

          {/* Filters + grouping */}
          {tasks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {FILTERS.map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)} className="text-xs font-semibold px-2.5 py-1 rounded-full transition"
                  style={filter === f.key ? { background: 'var(--color-accent)', color: 'var(--color-on-accent)' } : { background: 'var(--color-bg)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
                  {f.label}
                </button>
              ))}
              <select value={group} onChange={(e) => setGroup(e.target.value as typeof group)} className="ml-auto rounded-lg px-2 py-1 text-xs outline-none" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                <option value="none">No grouping</option>
                <option value="week">By week</option>
                <option value="month">By month</option>
              </select>
            </div>
          )}

          {tasks.length === 0 ? (
            <EmptyState icon={<IconTasks width={40} height={40} />} title="No tasks yet" hint="Add one above, or promote something from your brain dump." />
          ) : filtered.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--color-muted)' }}>Nothing matches this filter.</p>
          ) : grouped ? (
            <div className="flex flex-col gap-4">
              {grouped.map(([name, items]) => (
                <div key={name}>
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1 px-1" style={{ color: 'var(--color-muted)' }}>{name}</div>
                  <ul className="flex flex-col gap-1">{items.map(renderRow)}</ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="flex flex-col gap-1">{filtered.map(renderRow)}</ul>
          )}
        </Card>

        {/* Brain dump */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>Brain dump</h2>
            <span className="text-sm" style={{ color: 'var(--color-muted)' }}>{dump.length} ideas</span>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); addDump() }} className="flex gap-2 mb-4">
            <Input value={dumpDraft} onChange={(e) => setDumpDraft(e.target.value)} placeholder="Dump a thought…" />
            <Button type="submit"><IconPlus width={18} height={18} /></Button>
          </form>

          {dump.length === 0 ? (
            <EmptyState title="Clear mind ✨" hint="Jot down anything on your mind. Turn the good ones into tasks." />
          ) : (
            <ul className="flex flex-col gap-1">
              {dump.map((d) => (
                <li key={d.id} className="group flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-black/5">
                  <span className="flex-1 text-sm" style={{ color: 'var(--color-text)' }}>{d.text}</span>
                  <button
                    onClick={() => promote(d)}
                    className="text-xs font-semibold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100"
                    style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
                  >
                    → Task
                  </button>
                  <button onClick={() => removeDump(d.id)} className="opacity-0 group-hover:opacity-60" style={{ color: 'var(--color-muted)' }}>
                    <IconTrash width={16} height={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
