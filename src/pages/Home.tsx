import { useEffect, useMemo, useState, type SVGProps } from 'react'
import { Link } from 'react-router-dom'
import { Card, Button, Input } from '../components/ui'
import { IconCheck, IconPayments, IconHome, IconPlus, IconTrash, IconBell } from '../components/icons'
import { useStore, uid } from '../lib/store'
import { useConfirmDelete } from '../lib/confirmDelete'
import { todayISO, startOfWeek, toISO, addDays } from '../lib/dates'
import { money } from '../lib/format'
import { OWNER_NAME, OWNER_FIRST } from '../lib/brand'
import { useToast } from '../lib/toast'
import { useBotEvents, useBotMarks } from '../lib/bots'
import { appliesOn as appliesOnDay, dayScore, mondayOf, prioritiesFor, streaks, type Priorities } from '../lib/osCore'
import {
  BOT_ACCENT, WAITING_ACCENT, EVENT_ACCENT, IconBot, IconWaiting, IconEvent,
  BotTaskList, BotStatusNote, BotEventList, useBotTasks,
} from '../components/BotItems'
import DayScore from '../components/DayScore'
import WeekReview, { PrioritiesEditor, PriorityList } from '../components/WeekReview'

type Task = { id: string; text: string; done: boolean; created: number; due?: string }
type Scope = 'week' | 'weekend' | 'all'
type NonNeg = { id: string; text: string; scope?: Scope }
type Bill = { id: string; name: string; amount: number; dueDay?: number }
type WItem = { id: string; text: string; done: boolean; completedAt?: number; urgent?: boolean }
const URGENT = '#dc2626'
type WBoard = { backlog: WItem[]; weeks: Record<string, Record<string, WItem[]>> }

const SCOPE_LABEL: Record<Scope, string> = { week: 'Weekdays', weekend: 'Weekends', all: 'Every day' }
const WDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const normBoard = (b: unknown): WBoard => {
  const x = (b ?? {}) as WBoard
  return Array.isArray(x.backlog) && x.weeks ? x : { backlog: Array.isArray(x.backlog) ? x.backlog : [], weeks: {} }
}
// Only today's scheduled tasks — the focus cards show what's for *this* day,
// not the whole week. Completed tasks stay (checked off) so you can see what
// you did; open items sit on top (urgent first), done ones sink to the bottom.
const todaysItems = (b: WBoard, weekKey: string, dayName: string): WItem[] => {
  const week = b.weeks[weekKey] ?? {}
  return (week[dayName] ?? []).slice().sort((a, b) =>
    (a.done ? 1 : 0) - (b.done ? 1 : 0) || (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0))
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const IconTarget = (p: SVGProps<SVGSVGElement>) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" fill="currentColor" />
  </svg>
)
const IconBriefcase = (p: SVGProps<SVGSVGElement>) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12h18" />
  </svg>
)
const IconGauge = (p: SVGProps<SVGSVGElement>) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 18a8 8 0 1 1 16 0" /><path d="M12 18l4-6" /><circle cx="12" cy="18" r="1.4" fill="currentColor" />
  </svg>
)
const IconStar = (p: SVGProps<SVGSVGElement>) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z" />
  </svg>
)
const IconSlider = (p: SVGProps<SVGSVGElement>) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" {...p}>
    <path d="M4 6h11M18 6h2M4 12h2M9 12h11M4 18h11M18 18h2" /><circle cx="16" cy="6" r="2" /><circle cx="7" cy="12" r="2" /><circle cx="16" cy="18" r="2" />
  </svg>
)

/** Shell for a Today's-Focus card: coloured icon + title, a "View all" link, body, and a footer link (both optional). */
function FocusCard({ accent, icon, title, note, viewAllLabel = 'View all', onViewAll, viewAllTo, footerLabel, footerTo, onFooter, className = '', children }: {
  accent: string; icon: React.ReactNode; title: string; note?: string
  viewAllLabel?: string; onViewAll?: () => void; viewAllTo?: string
  footerLabel?: string; footerTo?: string; onFooter?: () => void
  className?: string
  children: React.ReactNode
}) {
  const viewAll = viewAllTo
    ? <Link to={viewAllTo} className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>{viewAllLabel} →</Link>
    : onViewAll ? <button onClick={onViewAll} className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>{viewAllLabel} →</button>
    : null
  return (
    <div className={`rounded-[20px] p-5 flex flex-col ${className}`} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0" style={{ color: accent }}>{icon}</span>
          <div className="min-w-0">
            <h3 className="font-bold text-lg leading-tight" style={{ color: 'var(--color-text)' }}>{title}</h3>
            {note && <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{note}</p>}
          </div>
        </div>
        {viewAll}
      </div>
      <div className="flex-1">{children}</div>
      {footerLabel && (
        <div className="mt-4 pt-3 text-center" style={{ borderTop: '1px solid var(--color-border)' }}>
          {footerTo
            ? <Link to={footerTo} className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>{footerLabel} →</Link>
            : <button onClick={onFooter} className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>{footerLabel} →</button>}
        </div>
      )}
    </div>
  )
}

const IconFlag = ({ filled }: { filled?: boolean }) => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 21V4M4 4h11l-1.5 3L15 10H4" />
  </svg>
)

/** A task row inside a Business/Home priorities card. Check it off (it stays,
 * shown done), and flag it urgent. Completed tasks dim but don't disappear. */
function BoardRow({ item, accent, onToggleDone, onToggleUrgent }: { item: WItem; accent: string; onToggleDone: () => void; onToggleUrgent: () => void }) {
  const done = !!item.done
  const urgent = !!item.urgent && !done
  return (
    <li className="group flex items-center gap-3 text-sm">
      <button onClick={onToggleDone} className="h-5 w-5 rounded-md grid place-items-center shrink-0 transition" style={{ border: `2px solid ${urgent ? URGENT : accent}`, background: done ? accent : 'transparent' }} aria-label={done ? 'Mark not done' : 'Complete task'}>
        {done && <IconCheck width={12} height={12} style={{ color: '#fff' }} />}
      </button>
      <span className="flex-1" style={{ color: done ? 'var(--color-muted)' : urgent ? URGENT : 'var(--color-text)', fontWeight: urgent ? 600 : 400 }}>{item.text}</span>
      {!done && (
        <button onClick={onToggleUrgent} title={urgent ? 'Remove urgent' : 'Mark urgent'} aria-label={urgent ? 'Remove urgent' : 'Mark urgent'}
          className={`shrink-0 transition ${urgent ? '' : 'opacity-0 group-hover:opacity-60'}`} style={{ color: urgent ? URGENT : 'var(--color-muted)' }}>
          <IconFlag filled={urgent} />
        </button>
      )}
    </li>
  )
}

/**
 * Today's list for one board. Only what is still open shows as tasks — the
 * card is meant to answer "what am I doing today", and a finished task is no
 * longer an answer. Anything already done folds into a single line you can
 * open if something needs unchecking.
 */
function TodayList({ items, accent, empty, onToggleDone, onToggleUrgent }: {
  items: WItem[]; accent: string; empty: string
  onToggleDone: (id: string) => void; onToggleUrgent: (id: string) => void
}) {
  const [showDone, setShowDone] = useState(false)
  const open = items.filter((i) => !i.done)
  const done = items.filter((i) => i.done)

  return (
    <>
      {open.length === 0 ? (
        <p className="text-sm py-4" style={{ color: 'var(--color-muted)' }}>
          {done.length > 0 ? `All ${done.length} done for today. 🎉` : empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3 mb-3">
          {open.map((it) => (
            <BoardRow key={it.id} item={it} accent={accent}
              onToggleDone={() => onToggleDone(it.id)} onToggleUrgent={() => onToggleUrgent(it.id)} />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <>
          <button onClick={() => setShowDone((v) => !v)} className="text-xs font-semibold flex items-center gap-1.5 mb-2" style={{ color: 'var(--color-muted)' }}>
            <IconCheck width={13} height={13} style={{ color: accent }} />
            {done.length} done today
            <span style={{ opacity: 0.7 }}>{showDone ? '▴' : '▾'}</span>
          </button>
          {showDone && (
            <ul className="flex flex-col gap-3 mb-3">
              {done.map((it) => (
                <BoardRow key={it.id} item={it} accent={accent}
                  onToggleDone={() => onToggleDone(it.id)} onToggleUrgent={() => onToggleUrgent(it.id)} />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}

/** Inline "+ Add a … task" input that drops a task into a board's backlog. */function AddRow({ accent, placeholder, onAdd }: { accent: string; placeholder: string; onAdd: (text: string) => void }) {
  const [text, setText] = useState('')
  const submit = () => { if (text.trim()) { onAdd(text); setText('') } }
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid place-items-center h-5 w-5 rounded-full shrink-0" style={{ color: accent }}><IconPlus width={15} height={15} /></span>
      <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} onBlur={submit}
        placeholder={placeholder} className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'var(--color-text)' }} />
    </div>
  )
}

export default function Home() {
  const [profile] = useStore<{ name: string; photo?: string }>('profile', { name: OWNER_NAME })
  const [, setTasks] = useStore<Task[]>('tasks.master', [])
  const [bills] = useStore<Bill[]>('pay.bills', [])
  const [cells] = useStore<Record<string, number>>('pay.cells', {})
  const [workBoard, setWorkBoard] = useStore<WBoard>('work.work', { backlog: [], weeks: {} })
  const [homeBoard, setHomeBoard] = useStore<WBoard>('work.home', { backlog: [], weeks: {} })
  const [quick, setQuick] = useState('')
  const confirmDelete = useConfirmDelete()
  const { toast } = useToast()

  const today = todayISO()
  const now = new Date()
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  const monthShort = now.toLocaleDateString(undefined, { month: 'short' })
  const month = now.getMonth(), year = now.getFullYear()
  const weekKey = toISO(startOfWeek(now))

  const addQuick = () => {
    const t = quick.trim()
    if (!t) return
    setTasks((prev) => [{ id: uid('t'), text: t, done: false, created: Date.now(), due: today }, ...prev])
    setQuick('')
  }

  // ---- Non-negotiables (home.nonneg) ----
  const [nonNegs, setNonNegs] = useStore<NonNeg[]>('home.nonneg', [])
  const [nnToday, setNnToday] = useStore<{ date: string; done: string[] }>('home.nonneg.today', { date: '', done: [] })
  // Daily scorecard the weekly report reads — which non-negotiables were hit
  // on which date, and how many applied that day. Without this, yesterday's
  // checkmarks vanish at midnight and there is nothing to report on.
  const [nnHistory, setNnHistory] = useStore<Record<string, { done: string[]; total: number }>>('home.nonneg.history', {})
  const [nnDraft, setNnDraft] = useState('')
  const [nnView, setNnView] = useState<Scope>('week')
  const [nnEdit, setNnEdit] = useState(false)

  const nnDone = nnToday.date === today ? nnToday.done : []
  const scopeOf = (n: NonNeg): Scope => n.scope ?? 'all'
  const appliesOn = (n: NonNeg, iso: string) => appliesOnDay(n, iso)
  const appliesToday = (n: NonNeg) => appliesOn(n, today)
  const todayList = nonNegs.filter(appliesToday)
  const nnOrdered = [...todayList.filter((n) => nnDone.includes(n.id)), ...todayList.filter((n) => !nnDone.includes(n.id))]
  const firstOpenId = todayList.find((n) => !nnDone.includes(n.id))?.id

  // Bot ticks ("hice gym"). A bot never writes your checklist itself: its tick
  // waits in Supabase and is folded in here through the same setters a tap
  // uses, so it syncs like any other check. Past days (the app wasn't opened)
  // go into the history the weekly report reads.
  const { marks: botMarks, clear: clearBotMark } = useBotMarks(toISO(addDays(now, -13)))
  const botTickToday = (id: string) => botMarks.find((m) => m.day === today && m.nonneg_id === id)
  useEffect(() => {
    const patch: Record<string, { done: string[]; total: number }> = {}
    for (const m of botMarks) {
      const n = nonNegs.find((x) => x.id === m.nonneg_id)
      if (!n || !appliesOn(n, m.day) || m.day > today) continue
      const base = patch[m.day] ?? (m.day === today
        ? { done: nnDone, total: todayList.length }
        : nnHistory[m.day] ?? { done: [], total: nonNegs.filter((x) => appliesOn(x, m.day)).length })
      if (!base.done.includes(n.id)) patch[m.day] = { ...base, done: [...base.done, n.id] }
    }
    if (Object.keys(patch).length === 0) return
    if (patch[today]) setNnToday({ date: today, done: patch[today].done })
    setNnHistory((prev) => ({ ...prev, ...patch }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botMarks, nonNegs, nnToday, nnHistory, today])

  const toggleNonNeg = (id: string) => {
    const unticking = nnDone.includes(id)
    const done = unticking ? nnDone.filter((x) => x !== id) : [...nnDone, id]
    setNnToday({ date: today, done })
    setNnHistory((prev) => ({ ...prev, [today]: { done, total: todayList.length } }))
    // Taking back a bot's tick clears it at the source too, or it would fold straight back in.
    if (unticking && botTickToday(id)) {
      void clearBotMark(today, id).then((ok) => { if (!ok) toast("Couldn't reach the cloud — your bot's check stays on for now.") })
    }
  }
  // ---- Marcador del día: today's % and days in a row at 100% ----
  const score = dayScore(nonNegs, today, nnDone)
  const streak = streaks(nnHistory, today, score)

  // ---- The week: 3 priorities (week.priorities) and, on Sunday, the review ----
  const [priorities, setPriorities] = useStore<Priorities>('week.priorities', {})
  const thisWeek = mondayOf(today)
  const weekPriorities = prioritiesFor(priorities, thisWeek)
  const [editPriorities, setEditPriorities] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const isSunday = now.getDay() === 0
  const isPlanWeek = (n: NonNeg) => n.id === 'nn_wend_plan' || /plan (the|my|next) week/i.test(n.text)
  const openReview = () => {
    if (isSunday) document.getElementById('week-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else setReviewOpen(true)
  }

  // ---- Events bots sent for today (os_events) ----
  const { events: botEvents } = useBotEvents(today)
  const eventsToday = botEvents.filter((e) => e.day === today)

  const editList = nonNegs.filter((n) => scopeOf(n) === nnView)
  const addNonNeg = () => {
    const t = nnDraft.trim()
    if (!t) return
    setNonNegs((prev) => [...prev, { id: uid('nn'), text: t, scope: nnView }])
    setNnDraft('')
  }
  const removeNonNeg = (id: string) => {
    setNonNegs((prev) => prev.filter((n) => n.id !== id))
    if (nnDone.includes(id)) setNnToday({ date: today, done: nnDone.filter((x) => x !== id) })
  }

  // ---- Business (work.work) & Home (work.home) priorities ----
  const todayName = WDAYS[(now.getDay() + 6) % 7]
  const bizItems = todaysItems(normBoard(workBoard), weekKey, todayName)
  const homeTaskItems = todaysItems(normBoard(homeBoard), weekKey, todayName)
  const patchBoardItem = (setB: (fn: (p: WBoard) => WBoard) => void, id: string, fn: (i: WItem) => WItem) => setB((prev) => {
    const b = normBoard(prev)
    const patch = (arr?: WItem[]) => (arr ?? []).map((i) => i.id === id ? fn(i) : i)
    const weeks: WBoard['weeks'] = {}
    for (const [wk, days] of Object.entries(b.weeks)) { const nd: Record<string, WItem[]> = {}; for (const [d, items] of Object.entries(days)) nd[d] = patch(items); weeks[wk] = nd }
    return { backlog: patch(b.backlog), weeks }
  })
  const toggleBoardDone = (setB: (fn: (p: WBoard) => WBoard) => void, id: string) => patchBoardItem(setB, id, (i) => ({ ...i, done: !i.done, completedAt: !i.done ? Date.now() : undefined }))
  const toggleUrgentItem = (setB: (fn: (p: WBoard) => WBoard) => void, id: string) => patchBoardItem(setB, id, (i) => ({ ...i, urgent: !i.urgent }))
  // New focus tasks land on today's column, so they show here and on today in the planner.
  const addBoardTask = (setB: (fn: (p: WBoard) => WBoard) => void, text: string) => setB((prev) => {
    const b = normBoard(prev)
    const weeks = { ...b.weeks }
    const wk = { ...(weeks[weekKey] ?? {}) }
    wk[todayName] = [...(wk[todayName] ?? []), { id: uid('w'), text: text.trim(), done: false }]
    weeks[weekKey] = wk
    return { ...b, weeks }
  })

  // ---- From my bots (os_items): waiting for you, and the rest ----
  const bots = useBotTasks()

  // ---- Upcoming bills (pay.bills / pay.cells) ----
  const upcomingBills = useMemo(
    () => bills
      .filter((b) => cells[`${year}:${b.id}:${month}`] === undefined)
      .sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99)),
    [bills, cells, year, month],
  )

  const initials = (profile.name || OWNER_FIRST || 'B').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="fade-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{dateLabel}</p>
          <h1 className="text-[32px] font-semibold leading-tight mt-1" style={{ color: 'var(--color-text)' }}>
            {greeting()}{(profile.name || OWNER_FIRST) ? `, ${(profile.name || OWNER_FIRST).split(' ')[0]}` : ''} 👋
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          <Link to="/notifications" className="h-10 w-10 rounded-full grid place-items-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }} aria-label="Notifications">
            <IconBell width={19} height={19} />
          </Link>
          <Link to="/settings" className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            {profile.photo
              ? <img src={profile.photo} alt="" className="h-8 w-8 rounded-full object-cover" />
              : <span className="h-8 w-8 rounded-full grid place-items-center text-xs font-bold" style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}>{initials}</span>}
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{(profile.name || OWNER_FIRST).split(' ')[0] || 'Profile'}</span>
          </Link>
        </div>
      </div>

      {/* Quick add */}
      <Card className="p-3 mb-8 flex gap-2">
        <Input value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addQuick() }} placeholder="Quick add a task for today…" />
        <Button onClick={addQuick}><IconPlus width={16} height={16} /> Add</Button>
      </Card>

      {/* Today's Main Focus */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span style={{ color: 'var(--color-accent)' }}><IconTarget /></span>
          <div>
            <h2 className="font-bold text-lg leading-tight" style={{ color: 'var(--color-text)' }}>Today's Main Focus</h2>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Only what's on today — your score, the week's priorities, non-negotiables, business, home and your bots.</p>
          </div>
        </div>
        <button onClick={() => setNnEdit(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl shrink-0" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
          <IconSlider /> Customize
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        {/* Marcador del día */}
        <FocusCard accent="var(--color-accent)" icon={<IconGauge />} title="Marcador del día" note="Today's non-negotiables">
          <DayScore score={score} streak={streak} />
        </FocusCard>

        {/* This week's 3 priorities (week.priorities) */}
        <FocusCard accent="#ca8a04" icon={<IconStar />} title="Prioridades de la semana" className="lg:col-span-2"
          note={`Week of ${new Date(thisWeek + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
          viewAllLabel={weekPriorities.length && !editPriorities ? 'Edit' : undefined} onViewAll={weekPriorities.length && !editPriorities ? () => setEditPriorities(true) : undefined}
          footerLabel="Resumen de la semana" onFooter={openReview}>
          {weekPriorities.length && !editPriorities ? (
            <PriorityList items={weekPriorities} />
          ) : (
            <>
              {weekPriorities.length === 0 && <p className="text-sm mb-3" style={{ color: 'var(--color-muted)' }}>Pick the 3 things that would make this week a win.</p>}
              <PrioritiesEditor key={thisWeek} initial={weekPriorities} saveLabel="Save priorities"
                onCancel={weekPriorities.length ? () => setEditPriorities(false) : undefined}
                onSave={(items) => { setPriorities((prev) => ({ ...prev, [thisWeek]: items })); setEditPriorities(false) }} />
            </>
          )}
        </FocusCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        {/* Non-negotiables */}
        <FocusCard accent="var(--color-accent)" icon={<IconCheck width={22} height={22} />} title="Non-negotiables" onViewAll={() => setNnEdit(true)} footerLabel="Manage non-negotiables" onFooter={() => setNnEdit(true)}>
          {todayList.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--color-muted)' }}>None set for today. Tap Customize to add your daily non-negotiables.</p>
          ) : (
              <ul className="flex flex-col gap-2.5">
                {nnOrdered.map((n) => {
                  const done = nnDone.includes(n.id)
                  return (
                    <li key={n.id} className="flex items-center gap-3 text-sm">
                      <button onClick={() => toggleNonNeg(n.id)} className="h-5 w-5 rounded-md grid place-items-center shrink-0" style={{ border: '2px solid var(--color-accent)', background: done ? 'var(--color-accent)' : 'transparent' }} aria-label={done ? 'Mark not done' : 'Mark done'}>
                        {done && <IconCheck width={12} height={12} style={{ color: 'var(--color-on-accent)' }} />}
                      </button>
                      <span className="flex-1" style={{ color: done ? 'var(--color-muted)' : 'var(--color-text)' }}>{n.text}</span>
                      {done && botTickToday(n.id) && <span className="text-[10px] shrink-0" style={{ color: 'var(--color-muted)' }}>via {botTickToday(n.id)!.bot}</span>}
                      {isPlanWeek(n) && <button onClick={openReview} className="text-[11px] font-semibold shrink-0" style={{ color: 'var(--color-accent)' }}>Review {isSunday ? '↓' : '→'}</button>}
                      {!done && n.id === firstOpenId && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ color: 'var(--color-accent)', background: 'var(--color-surface)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>Next up</span>}
                    </li>
                  )
                })}
              </ul>
          )}
        </FocusCard>

        {/* Today's business tasks → Work tasks */}
        <FocusCard accent="#ea580c" icon={<IconBriefcase />} title="Today's business tasks" note={todayName} viewAllTo="/work-tasks" footerLabel="Open full tab" footerTo="/work-tasks">
          <TodayList items={bizItems} accent="#ea580c"
            empty="Nothing scheduled for today. Add one below, or put a task on today in Work tasks."
            onToggleDone={(id) => toggleBoardDone(setWorkBoard, id)}
            onToggleUrgent={(id) => toggleUrgentItem(setWorkBoard, id)} />
          <div className="pt-2" style={{ borderTop: bizItems.length ? '1px solid var(--color-border)' : 'none' }}>
            <AddRow accent="#ea580c" placeholder="Add a task for today" onAdd={(t) => addBoardTask(setWorkBoard, t)} />
          </div>
        </FocusCard>

        {/* Today's home tasks → Home tasks */}
        <FocusCard accent="#16a34a" icon={<IconHome width={22} height={22} />} title="Today's home tasks" note={todayName} viewAllTo="/home-tasks" footerLabel="Open full tab" footerTo="/home-tasks">
          <TodayList items={homeTaskItems} accent="#16a34a"
            empty="Nothing scheduled for today. Add one below, or put a task on today in Home tasks."
            onToggleDone={(id) => toggleBoardDone(setHomeBoard, id)}
            onToggleUrgent={(id) => toggleUrgentItem(setHomeBoard, id)} />
          <div className="pt-2" style={{ borderTop: homeTaskItems.length ? '1px solid var(--color-border)' : 'none' }}>
            <AddRow accent="#16a34a" placeholder="Add a task for today" onAdd={(t) => addBoardTask(setHomeBoard, t)} />
          </div>
        </FocusCard>

        {/* Sunday: the week in review, next to "Plan the week ahead" */}
        {isSunday && (
          <div id="week-review" className="lg:col-span-3 scroll-mt-20">
            <FocusCard accent="var(--color-accent)" icon={<IconStar />} title="Resumen de la semana" note="How the week went — and next week's 3 priorities">
              <WeekReview today={today} nonNegs={nonNegs} history={nnHistory} todayDone={nnDone}
                homeBoard={homeBoard} workBoard={workBoard} priorities={priorities} setPriorities={setPriorities} />
            </FocusCard>
          </div>
        )}

        {/* Events a bot sent for today (os_events) — school, the kids' activities */}
        {eventsToday.length > 0 && (
          <FocusCard accent={EVENT_ACCENT} icon={<IconEvent />} title="Eventos de hoy" className="lg:col-span-3"
            note={todayName} viewAllLabel="Calendar" viewAllTo="/calendar">
            <BotEventList events={eventsToday} />
          </FocusCard>
        )}

        {/* Only you can do or approve these (os_items, needs_me) */}
        {bots.status === 'ready' && bots.waiting.length > 0 && (
          <FocusCard accent={WAITING_ACCENT} icon={<IconWaiting />} title="Esperando por ti" className="lg:col-span-3"
            note={bots.waitingCount ? `${bots.waitingCount} need${bots.waitingCount === 1 ? 's' : ''} you — PRs, scripts, purchases, decisions` : 'All handled'}>
            <BotTaskList items={bots.waiting} accent={WAITING_ACCENT} showArea empty="Nothing waiting on you." onToggle={bots.toggle} />
          </FocusCard>
        )}

        {/* What your AI bots left you → os_items (hidden when there's no cloud) */}
        {bots.status !== 'off' && (
          <FocusCard accent={BOT_ACCENT} icon={<IconBot />} title="De mis bots" className="lg:col-span-3"
            note={bots.status === 'ready' ? (bots.openCount ? `${bots.openCount} open` : 'All clear') : undefined}>
            {bots.status === 'ready'
              ? <BotTaskList items={bots.tasks} showArea empty="Nothing from your bots right now. Tasks they add show up here." onToggle={bots.toggle} />
              : <BotStatusNote status={bots.status} />}
          </FocusCard>
        )}
      </div>

      {/* Upcoming bills */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--color-text)' }}><IconPayments width={20} height={20} /> Upcoming bills</h2>
          <Link to="/finances" className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>View all →</Link>
        </div>
        {upcomingBills.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--color-muted)' }}>{bills.length === 0 ? 'Add bills in Finances to see them here.' : 'All bills handled this month. 🎉'}</p>
        ) : (
          <ul className="flex flex-col">
            {upcomingBills.slice(0, 6).map((b, i) => (
              <li key={b.id} className="flex items-center gap-3 py-2.5 text-sm" style={{ borderTop: i === 0 ? 'none' : '1px solid var(--color-border)' }}>
                <span className="text-sm font-semibold w-16 shrink-0 tnum" style={{ color: 'var(--color-accent)' }}>{b.dueDay ? `${monthShort} ${b.dueDay}` : '—'}</span>
                <span className="flex-1 truncate" style={{ color: 'var(--color-text)' }}>{b.name}</span>
                <span className="font-semibold tnum shrink-0" style={{ color: 'var(--color-text)' }}>{money(b.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/finances" className="mt-4 block text-center py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>Manage bills &amp; finances →</Link>
      </Card>

      {/* Weekly review, any day of the week */}
      {reviewOpen && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setReviewOpen(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92%] max-w-2xl max-h-[90vh] overflow-y-auto p-5 rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>Resumen de la semana</h3>
              <button onClick={() => setReviewOpen(false)} className="text-lg" style={{ color: 'var(--color-muted)' }} aria-label="Close">✕</button>
            </div>
            <WeekReview today={today} nonNegs={nonNegs} history={nnHistory} todayDone={nnDone}
              homeBoard={homeBoard} workBoard={workBoard} priorities={priorities} setPriorities={setPriorities} />
          </div>
        </>
      )}

      {/* Customize non-negotiables modal */}
      {nnEdit && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setNnEdit(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92%] max-w-lg max-h-[90vh] overflow-y-auto p-5 rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>Non-negotiables</h3>
              <button onClick={() => setNnEdit(false)} className="text-lg" style={{ color: 'var(--color-muted)' }} aria-label="Close">✕</button>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>Set the must-dos for each kind of day. They reset every morning.</p>
            <div className="inline-flex rounded-xl p-1 mb-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              {(['week', 'weekend', 'all'] as Scope[]).map((v) => (
                <button key={v} onClick={() => setNnView(v)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition" style={{ background: nnView === v ? 'var(--color-accent)' : 'transparent', color: nnView === v ? 'var(--color-on-accent)' : 'var(--color-muted)' }}>{SCOPE_LABEL[v]}</button>
              ))}
            </div>
            {editList.length === 0 ? (
              <p className="text-sm mb-3 py-2" style={{ color: 'var(--color-muted)' }}>None in {SCOPE_LABEL[nnView]} yet — add one below.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 mb-3">
                {editList.map((n) => (
                  <li key={n.id} className="group flex items-center gap-2.5 py-1.5 px-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                    <span className="flex-1 text-sm" style={{ color: 'var(--color-text)' }}>{n.text}</span>
                    <button onClick={() => confirmDelete({ label: `“${n.text}”`, detail: 'This non-negotiable will be removed.', onConfirm: () => removeNonNeg(n.id) })} className="opacity-0 group-hover:opacity-60 transition" style={{ color: 'var(--color-muted)' }} aria-label="Remove"><IconTrash width={15} height={15} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input value={nnDraft} onChange={(e) => setNnDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addNonNeg() }} placeholder={`Add to ${SCOPE_LABEL[nnView]}…`} />
              <Button onClick={addNonNeg}><IconPlus width={16} height={16} /> Add</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
