import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Button, Input } from '../components/ui'
import { IconTasks, IconPayments, IconCalendar, IconHealth, IconBell, IconPlus, IconCheck, IconTrash } from '../components/icons'
import { useStore, uid } from '../lib/store'
import { useConfirmDelete } from '../lib/confirmDelete'
import { taskAgenda } from '../lib/agenda'
import { todayISO, daysUntil, formatDayShort, parseDate } from '../lib/dates'
import { money } from '../lib/format'

type Task = { id: string; text: string; done: boolean; created: number; due?: string }
type Scope = 'week' | 'weekend' | 'all'
type NonNeg = { id: string; text: string; scope?: Scope }
const SCOPE_LABEL: Record<Scope, string> = { week: 'Weekdays', weekend: 'Weekends', all: 'Every day' }
type Bill = { id: string; name: string; amount: number; dueDay?: number }
type Event = { id: string; date: string; title: string }
type Appt = { id: string; who: string; what: string; date: string }
type Member = { id: string; name: string; birthday: string }
type Weigh = { id: string; date: string; value: number; bodyFat?: number }
type Scan = { id: string; date: string; bodyFatPct?: number }

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Circular completion ring — accent while in progress, green when finished. */
function ProgressRing({ pct, done, size = 58 }: { pct: number; done: boolean; size?: number }) {
  const stroke = 6
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const color = done ? '#16a34a' : 'var(--color-accent)'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.27} fontWeight="700" fill={done ? '#16a34a' : 'var(--color-text)'}>{pct}%</text>
    </svg>
  )
}

export default function Home() {
  const [profile] = useStore<{ name: string; photo?: string }>('profile', { name: 'Rolando Joan' })
  const [tasks, setTasks] = useStore<Task[]>('tasks.master', [])
  const [bills] = useStore<Bill[]>('pay.bills', [])
  const [cells] = useStore<Record<string, number>>('pay.cells', {})
  const [events] = useStore<Event[]>('calendar.events', [])
  const [appts] = useStore<Appt[]>('family.appts', [])
  const [members] = useStore<Member[]>('family.members', [])
  const [weights] = useStore<Weigh[]>('health.weights', [])
  const [scans] = useStore<Scan[]>('health.scans', [])
  const [quick, setQuick] = useState('')
  const confirmDelete = useConfirmDelete()

  // Daily non-negotiables: a personal must-do list that resets every day.
  const [nonNegs, setNonNegs] = useStore<NonNeg[]>('home.nonneg', [])
  const [nnToday, setNnToday] = useStore<{ date: string; done: string[] }>('home.nonneg.today', { date: '', done: [] })
  const [nnDraft, setNnDraft] = useState('')
  const [nnView, setNnView] = useState<'today' | 'week' | 'weekend' | 'all'>('today')
  const [shared, setShared] = useState(false)

  const today = todayISO()
  const now = new Date()
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  // Today's agenda: due tasks + planner + events + appointments dated today.
  const todayItems = useMemo(() => {
    const out: { text: string; tag: string; done?: boolean; id?: string }[] = []
    tasks.filter((t) => t.due === today && !t.done).forEach((t) => out.push({ text: t.text, tag: 'Task', id: t.id }))
    taskAgenda().filter((a) => a.date === today && (a.source === 'Home' || a.source === 'Work')).forEach((a) => out.push({ text: a.title, tag: a.source, done: a.done }))
    events.filter((e) => e.date === today).forEach((e) => out.push({ text: e.title, tag: 'Event' }))
    appts.filter((a) => a.date === today).forEach((a) => out.push({ text: `${a.who} — ${a.what}`, tag: 'Appt' }))
    return out
  }, [tasks, events, appts, today])

  const completeTask = (id: string) => setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: true } : t))

  // This month's upcoming (unpaid) bills, soonest due first.
  const month = now.getMonth(), year = now.getFullYear()
  const monthShort = now.toLocaleDateString(undefined, { month: 'short' })
  const upcomingBills = useMemo(
    () => bills
      .filter((b) => cells[`${year}:${b.id}:${month}`] === undefined)
      .sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99)),
    [bills, cells, year, month],
  )

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
  const latestBodyFat = useMemo(() => {
    const entries = [
      ...weights.filter((w) => w.bodyFat != null).map((w) => ({ date: w.date, v: w.bodyFat! })),
      ...scans.filter((s) => s.bodyFatPct != null).map((s) => ({ date: s.date, v: s.bodyFatPct! })),
    ].sort((a, b) => b.date.localeCompare(a.date))
    return entries[0]?.v ?? null
  }, [weights, scans])

  const addQuick = () => {
    const t = quick.trim()
    if (!t) return
    setTasks((prev) => [{ id: uid('t'), text: t, done: false, created: Date.now(), due: today }, ...prev])
    setQuick('')
  }

  // Completion is tracked per-day; a fresh day starts everything unchecked.
  const nnDone = nnToday.date === today ? nnToday.done : []
  const isWeekend = [0, 6].includes(new Date().getDay())
  const scopeOf = (n: NonNeg): Scope => n.scope ?? 'all'
  const appliesToday = (n: NonNeg) => scopeOf(n) === 'all' || scopeOf(n) === (isWeekend ? 'weekend' : 'week')
  const scopeForView: Record<typeof nnView, Scope> = { today: isWeekend ? 'weekend' : 'week', week: 'week', weekend: 'weekend', all: 'all' }
  const visibleNonNegs = nonNegs.filter((n) => {
    if (nnView === 'today') return appliesToday(n)
    if (nnView === 'all') return true
    return scopeOf(n) === nnView || scopeOf(n) === 'all'
  })
  const todayList = nonNegs.filter(appliesToday)
  const nnCompleted = todayList.filter((n) => nnDone.includes(n.id)).length
  const toggleNonNeg = (id: string) => {
    const done = nnDone.includes(id) ? nnDone.filter((x) => x !== id) : [...nnDone, id]
    setNnToday({ date: today, done })
  }
  const addNonNeg = () => {
    const t = nnDraft.trim()
    if (!t) return
    setNonNegs((prev) => [...prev, { id: uid('nn'), text: t, scope: scopeForView[nnView] }])
    setNnDraft('')
  }
  const removeNonNeg = (id: string) => {
    setNonNegs((prev) => prev.filter((n) => n.id !== id))
    if (nnDone.includes(id)) setNnToday({ date: today, done: nnDone.filter((x) => x !== id) })
  }
  const nnPct = todayList.length ? Math.round((nnCompleted / todayList.length) * 100) : 0
  const nnAllDone = todayList.length > 0 && nnCompleted === todayList.length
  const shareNonNegs = async () => {
    const lines = todayList.map((n) => `${nnDone.includes(n.id) ? '✅' : '⬜️'} ${n.text}`).join('\n')
    const text = `Non-negotiables — ${nnCompleted}/${todayList.length} done today\n${lines}`
    try {
      if (navigator.share) { await navigator.share({ title: 'My non-negotiables', text }); return }
      await navigator.clipboard.writeText(text)
      setShared(true); setTimeout(() => setShared(false), 1800)
    } catch { /* share cancelled or unavailable */ }
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

      {/* Daily non-negotiables — the handful of things that must get done, by day type. */}
      <Card className="p-5 mb-6">
        <h2 className="font-bold text-lg flex items-center gap-2 mb-3" style={{ color: 'var(--color-text)' }}>
          <IconCheck width={18} height={18} /> Non-negotiables
        </h2>

        {/* Progress ring — turns green when the day is complete; shareable */}
        {todayList.length > 0 && (
          <div className="flex items-center gap-4 mb-4 p-3 rounded-xl" style={{ background: nnAllDone ? 'color-mix(in srgb, #16a34a 12%, var(--color-bg))' : 'var(--color-bg)', border: nnAllDone ? '1px solid color-mix(in srgb, #16a34a 40%, transparent)' : '1px solid transparent' }}>
            <ProgressRing pct={nnPct} done={nnAllDone} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold" style={{ color: nnAllDone ? '#16a34a' : 'var(--color-text)' }}>
                {nnAllDone ? 'All done — game strong! 💪' : `${nnCompleted} of ${todayList.length} done today`}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                {nnAllDone ? 'Every non-negotiable checked off.' : 'Keep going — check them off below.'}
              </p>
            </div>
            <Button variant="outline" onClick={shareNonNegs}>{shared ? 'Copied!' : 'Share'}</Button>
          </div>
        )}

        {/* View tabs: today vs each set */}
        <div className="inline-flex rounded-xl p-1 mb-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          {([['today', 'Today'], ['week', 'Weekdays'], ['weekend', 'Weekends'], ['all', 'Every day']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setNnView(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              style={{ background: nnView === v ? 'var(--color-accent)' : 'transparent', color: nnView === v ? 'var(--color-on-accent)' : 'var(--color-muted)' }}
            >
              {label}
            </button>
          ))}
        </div>

        {visibleNonNegs.length === 0 ? (
          <p className="text-sm mb-3" style={{ color: 'var(--color-muted)' }}>
            {nnView === 'today'
              ? 'Nothing set for today. Add one below or check the Weekdays / Weekends tabs.'
              : 'None here yet — add one below. They reset each morning.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 mb-3">
            {visibleNonNegs.map((n) => {
              const done = nnDone.includes(n.id)
              return (
                <li key={n.id} className="group flex items-center gap-2.5">
                  <button
                    onClick={() => toggleNonNeg(n.id)}
                    className="h-5 w-5 rounded-md grid place-items-center shrink-0 transition"
                    style={{ border: '2px solid var(--color-accent)', background: done ? 'var(--color-accent)' : 'transparent' }}
                    aria-label={done ? 'Mark not done' : 'Mark done'}
                  >
                    {done && <IconCheck width={12} height={12} style={{ color: 'var(--color-on-accent)' }} />}
                  </button>
                  <span className="flex-1 text-sm" style={{ color: 'var(--color-text)', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.5 : 1 }}>
                    {n.text}
                  </span>
                  {nnView !== 'today' && scopeOf(n) !== (nnView as Scope) && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--color-bg)', color: 'var(--color-muted)' }}>{SCOPE_LABEL[scopeOf(n)]}</span>
                  )}
                  <button onClick={() => confirmDelete({ label: `“${n.text}”`, detail: 'This non-negotiable will be removed.', onConfirm: () => removeNonNeg(n.id) })} className="opacity-0 group-hover:opacity-60 transition" style={{ color: 'var(--color-muted)' }} aria-label="Remove">
                    <IconTrash width={15} height={15} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex gap-2">
          <Input value={nnDraft} onChange={(e) => setNnDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addNonNeg() }} placeholder={`Add to ${nnView === 'today' ? (isWeekend ? 'Weekends' : 'Weekdays') : SCOPE_LABEL[scopeForView[nnView]]}…`} />
          <Button variant="outline" onClick={addNonNeg}><IconPlus width={16} height={16} /> Add</Button>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--color-text)' }}><IconTasks width={18} height={18} /> Today</h2>
            <Link to="/home-tasks" className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>Open week →</Link>
          </div>
          {todayItems.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--color-muted)' }}>Nothing scheduled today. Enjoy! ✨</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {todayItems.map((it, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm">
                  {it.id ? (
                    <button onClick={() => completeTask(it.id!)} className="h-4 w-4 rounded grid place-items-center shrink-0 transition" style={{ border: '2px solid var(--color-accent)' }} aria-label="Complete task" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--color-accent)', opacity: it.done ? 0.4 : 1 }} />
                  )}
                  <span className="flex-1" style={{ color: 'var(--color-text)', textDecoration: it.done ? 'line-through' : 'none', opacity: it.done ? 0.5 : 1 }}>{it.text}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-muted)' }}>{it.tag}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Upcoming bills — date + amount */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--color-text)' }}><IconPayments width={18} height={18} /> Upcoming bills</h2>
            <Link to="/finances" className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>Open →</Link>
          </div>
          {upcomingBills.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--color-muted)' }}>{bills.length === 0 ? 'Add bills in Finances to see them here.' : 'Nothing due this month.'}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {upcomingBills.slice(0, 6).map((b) => (
                <li key={b.id} className="flex items-center gap-2.5 text-sm">
                  <span className="text-xs font-semibold w-14 shrink-0 tnum" style={{ color: 'var(--color-accent)' }}>{b.dueDay ? `${monthShort} ${b.dueDay}` : '—'}</span>
                  <span className="flex-1 truncate" style={{ color: 'var(--color-text)' }}>{b.name}</span>
                  <span className="font-semibold tnum shrink-0" style={{ color: 'var(--color-text)' }}>{money(b.amount)}</span>
                </li>
              ))}
              {upcomingBills.length > 6 && <li className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>+{upcomingBills.length - 6} more</li>}
            </ul>
          )}
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
          {latestWeight || latestBodyFat != null ? (
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
              {latestWeight && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tnum" style={{ color: 'var(--color-accent)' }}>{latestWeight.value}</span>
                  <span className="text-sm" style={{ color: 'var(--color-muted)' }}>lbs · {(() => { const d = parseDate(latestWeight.date); return d ? formatDayShort(d) : latestWeight.date })()}</span>
                </div>
              )}
              {latestBodyFat != null && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tnum" style={{ color: 'var(--color-accent)' }}>{latestBodyFat}%</span>
                  <span className="text-sm" style={{ color: 'var(--color-muted)' }}>body fat</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm py-4" style={{ color: 'var(--color-muted)' }}>Log a weight or upload a DEXA scan to see it here.</p>
          )}
          <Link to="/calendar" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>
            <IconCalendar width={16} height={16} /> Open calendar
          </Link>
        </Card>
      </div>
    </div>
  )
}
