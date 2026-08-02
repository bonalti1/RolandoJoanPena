import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Button, Input } from '../components/ui'
import { IconTasks, IconPayments, IconCalendar, IconHealth, IconBell, IconPlus } from '../components/icons'
import { useStore, uid } from '../lib/store'
import { taskAgenda } from '../lib/agenda'
import { todayISO, daysUntil, formatDayShort, parseDate } from '../lib/dates'
import { money } from '../lib/format'

type Task = { id: string; text: string; done: boolean; created: number; due?: string }
type Bill = { id: string; name: string; amount: number }
type Event = { id: string; date: string; title: string }
type Appt = { id: string; who: string; what: string; date: string }
type Member = { id: string; name: string; birthday: string }
type Weigh = { id: string; date: string; value: number }

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const [profile] = useStore<{ name: string; photo?: string }>('profile', { name: 'Rolando' })
  const [tasks, setTasks] = useStore<Task[]>('tasks.master', [])
  const [bills] = useStore<Bill[]>('pay.bills', [])
  const [cells] = useStore<Record<string, number>>('pay.cells', {})
  const [events] = useStore<Event[]>('calendar.events', [])
  const [appts] = useStore<Appt[]>('family.appts', [])
  const [members] = useStore<Member[]>('family.members', [])
  const [weights] = useStore<Weigh[]>('health.weights', [])
  const [quick, setQuick] = useState('')

  const today = todayISO()
  const now = new Date()
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  // Today's agenda: due tasks + planner + events + appointments dated today.
  const todayItems = useMemo(() => {
    const out: { text: string; tag: string; done?: boolean }[] = []
    tasks.filter((t) => t.due === today && !t.done).forEach((t) => out.push({ text: t.text, tag: 'Task' }))
    taskAgenda().filter((a) => a.date === today && (a.source === 'Home' || a.source === 'Work')).forEach((a) => out.push({ text: a.title, tag: a.source, done: a.done }))
    events.filter((e) => e.date === today).forEach((e) => out.push({ text: e.title, tag: 'Event' }))
    appts.filter((a) => a.date === today).forEach((a) => out.push({ text: `${a.who} — ${a.what}`, tag: 'Appt' }))
    return out
  }, [tasks, events, appts, today])

  const overdue = useMemo(() => tasks.filter((t) => !t.done && t.due && (daysUntil(t.due) ?? 0) < 0), [tasks])

  // This month's bills.
  const month = now.getMonth(), year = now.getFullYear()
  const monthLabel = now.toLocaleDateString(undefined, { month: 'long' })
  const expected = bills.reduce((s, b) => s + b.amount, 0)
  const paidThisMonth = bills.reduce((s, b) => s + (cells[`${year}:${b.id}:${month}`] ?? 0), 0)
  const billsLeft = bills.filter((b) => cells[`${year}:${b.id}:${month}`] === undefined).length

  // Coming up (next 7 days).
  const coming = useMemo(() => {
    const out: { text: string; days: number; tag: string }[] = []
    const within = (d: number | null) => d !== null && d >= 0 && d <= 7
    events.forEach((e) => { const d = daysUntil(e.date); if (within(d) && d! > 0) out.push({ text: e.title, days: d!, tag: 'Event' }) })
    appts.forEach((a) => { const d = daysUntil(a.date); if (within(d) && d! > 0) out.push({ text: `${a.who} — ${a.what}`, days: d!, tag: 'Appt' }) })
    tasks.forEach((t) => { if (t.done || !t.due) return; const d = daysUntil(t.due); if (within(d) && d! > 0) out.push({ text: t.text, days: d!, tag: 'Task' }) })
    members.forEach((m) => {
      if (!m.birthday) return
      const [, mm, dd] = m.birthday.split('-').map(Number)
      if (!mm || !dd) return
      let next = new Date(now.getFullYear(), mm - 1, dd)
      if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next = new Date(now.getFullYear() + 1, mm - 1, dd)
      const d = Math.round((next.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000)
      if (d >= 0 && d <= 7) out.push({ text: `${m.name}'s birthday 🎂`, days: d, tag: 'Birthday' })
    })
    return out.sort((a, b) => a.days - b.days).slice(0, 6)
  }, [events, appts, tasks, members])

  const latestWeight = useMemo(() => weights.length ? [...weights].sort((a, b) => b.date.localeCompare(a.date))[0] : null, [weights])

  const addQuick = () => {
    const t = quick.trim()
    if (!t) return
    setTasks((prev) => [{ id: uid('t'), text: t, done: false, created: Date.now(), due: today }, ...prev])
    setQuick('')
  }

  return (
    <div className="fade-up">
      <div className="mb-7 flex items-center gap-4">
        {profile.photo && <img src={profile.photo} alt="" className="h-14 w-14 rounded-full object-cover shrink-0" />}
        <div>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{dateLabel}</p>
          <h1 className="text-[32px] font-semibold leading-tight mt-1" style={{ color: 'var(--color-text)' }}>
            {greeting()}, {(profile.name || 'Rolando').split(' ')[0]} 👋
          </h1>
        </div>
      </div>

      {/* Quick add */}
      <Card className="p-3 mb-6 flex gap-2">
        <Input value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addQuick() }} placeholder="Quick add a task for today…" />
        <Button onClick={addQuick}><IconPlus width={16} height={16} /> Add</Button>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--color-text)' }}><IconTasks width={18} height={18} /> Today</h2>
            <Link to="/work" className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>Open week →</Link>
          </div>
          {overdue.length > 0 && (
            <Link to="/tasks" className="block text-sm font-semibold mb-2 px-3 py-2 rounded-lg" style={{ background: 'color-mix(in srgb, #d97a7a 14%, transparent)', color: '#c25b5b' }}>
              ⚠ {overdue.length} overdue task{overdue.length === 1 ? '' : 's'}
            </Link>
          )}
          {todayItems.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--color-muted)' }}>Nothing scheduled today. Enjoy! ✨</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {todayItems.map((it, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--color-accent)', opacity: it.done ? 0.4 : 1 }} />
                  <span className="flex-1" style={{ color: 'var(--color-text)', textDecoration: it.done ? 'line-through' : 'none', opacity: it.done ? 0.5 : 1 }}>{it.text}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-muted)' }}>{it.tag}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Bills this month */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--color-text)' }}><IconPayments width={18} height={18} /> {monthLabel} bills</h2>
            <Link to="/payments" className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>Open →</Link>
          </div>
          <div className="flex items-end gap-4 mb-3">
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Paid</p>
              <p className="text-2xl font-semibold tnum" style={{ color: 'var(--color-accent)' }}>{money(paidThisMonth)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>of</p>
              <p className="text-2xl font-semibold tnum" style={{ color: 'var(--color-text)' }}>{money(expected)}</p>
            </div>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg)' }}>
            <div className="h-full rounded-full" style={{ width: `${expected ? Math.min(100, (paidThisMonth / expected) * 100) : 0}%`, background: 'var(--color-accent)' }} />
          </div>
          <p className="text-sm mt-2" style={{ color: 'var(--color-muted)' }}>{billsLeft === 0 ? 'All bills handled this month 🎉' : `${billsLeft} bill${billsLeft === 1 ? '' : 's'} left to pay`}</p>
        </Card>

        {/* Coming up */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--color-text)' }}><IconBell width={18} height={18} /> Coming up</h2>
            <Link to="/notifications" className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>All →</Link>
          </div>
          {coming.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--color-muted)' }}>Nothing in the next 7 days.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {coming.map((c, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm">
                  <span className="text-xs font-semibold w-16 shrink-0" style={{ color: 'var(--color-accent)' }}>{c.days === 1 ? 'Tomorrow' : `${c.days} days`}</span>
                  <span className="flex-1" style={{ color: 'var(--color-text)' }}>{c.text}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-muted)' }}>{c.tag}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Health + calendar quick */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--color-text)' }}><IconHealth width={18} height={18} /> Health</h2>
            <Link to="/health" className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>Open →</Link>
          </div>
          {latestWeight ? (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tnum" style={{ color: 'var(--color-accent)' }}>{latestWeight.value}</span>
              <span className="text-sm" style={{ color: 'var(--color-muted)' }}>latest weight · {(() => { const d = parseDate(latestWeight.date); return d ? formatDayShort(d) : latestWeight.date })()}</span>
            </div>
          ) : (
            <p className="text-sm py-4" style={{ color: 'var(--color-muted)' }}>Log a weight or a doctor visit to see it here.</p>
          )}
          <Link to="/calendar" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>
            <IconCalendar width={16} height={16} /> Open calendar
          </Link>
        </Card>
      </div>
    </div>
  )
}
