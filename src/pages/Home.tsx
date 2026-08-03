import { useMemo, useState, type SVGProps } from 'react'
import { Link } from 'react-router-dom'
import { Card, Button, Input } from '../components/ui'
import { IconCheck, IconPayments, IconHome, IconPlus, IconTrash, IconBell } from '../components/icons'
import { useStore, uid } from '../lib/store'
import { useConfirmDelete } from '../lib/confirmDelete'
import { todayISO, startOfWeek, toISO } from '../lib/dates'
import { money } from '../lib/format'

type Task = { id: string; text: string; done: boolean; created: number; due?: string }
type Scope = 'week' | 'weekend' | 'all'
type NonNeg = { id: string; text: string; scope?: Scope }
type Bill = { id: string; name: string; amount: number; dueDay?: number }
type WItem = { id: string; text: string; done: boolean; completedAt?: number }
type WBoard = { backlog: WItem[]; weeks: Record<string, Record<string, WItem[]>> }

const SCOPE_LABEL: Record<Scope, string> = { week: 'Weekdays', weekend: 'Weekends', all: 'Every day' }
const WDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const normBoard = (b: unknown): WBoard => {
  const x = (b ?? {}) as WBoard
  return Array.isArray(x.backlog) && x.weeks ? x : { backlog: Array.isArray(x.backlog) ? x.backlog : [], weeks: {} }
}
// Only today's scheduled tasks — the focus cards show what's for *this* day,
// not the whole week, so tomorrow's items don't clutter today.
const openBoardItems = (b: WBoard, weekKey: string, dayName: string, limit: number): WItem[] => {
  const week = b.weeks[weekKey] ?? {}
  return (week[dayName] ?? []).filter((i) => !i.done).slice(0, limit)
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
const IconSlider = (p: SVGProps<SVGSVGElement>) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" {...p}>
    <path d="M4 6h11M18 6h2M4 12h2M9 12h11M4 18h11M18 18h2" /><circle cx="16" cy="6" r="2" /><circle cx="7" cy="12" r="2" /><circle cx="16" cy="18" r="2" />
  </svg>
)

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

/** Shell for a Today's-Focus card: coloured icon + title, a "View all" link, body, and a footer link. */
function FocusCard({ accent, icon, title, viewAllLabel = 'View all', onViewAll, viewAllTo, footerLabel, footerTo, onFooter, children }: {
  accent: string; icon: React.ReactNode; title: string
  viewAllLabel?: string; onViewAll?: () => void; viewAllTo?: string
  footerLabel: string; footerTo?: string; onFooter?: () => void
  children: React.ReactNode
}) {
  const viewAll = viewAllTo
    ? <Link to={viewAllTo} className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>{viewAllLabel} →</Link>
    : <button onClick={onViewAll} className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>{viewAllLabel} →</button>
  return (
    <div className="rounded-[20px] p-5 flex flex-col" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span style={{ color: accent }}>{icon}</span>
          <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>{title}</h3>
        </div>
        {viewAll}
      </div>
      <div className="flex-1">{children}</div>
      <div className="mt-4 pt-3 text-center" style={{ borderTop: '1px solid var(--color-border)' }}>
        {footerTo
          ? <Link to={footerTo} className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>{footerLabel} →</Link>
          : <button onClick={onFooter} className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>{footerLabel} →</button>}
      </div>
    </div>
  )
}

/** A single open task row inside a Business/Home priorities card. Checking it completes the task. */
function BoardRow({ item, accent, onComplete }: { item: WItem; accent: string; onComplete: () => void }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <button onClick={onComplete} className="h-5 w-5 rounded-md shrink-0 transition" style={{ border: `2px solid ${accent}`, background: 'transparent' }} aria-label="Complete task" />
      <span className="flex-1" style={{ color: 'var(--color-text)' }}>{item.text}</span>
    </li>
  )
}

/** Inline "+ Add a … task" input that drops a task into a board's backlog. */
function AddRow({ accent, placeholder, onAdd }: { accent: string; placeholder: string; onAdd: (text: string) => void }) {
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
  const [profile] = useStore<{ name: string; photo?: string }>('profile', { name: 'Rolando Joan' })
  const [, setTasks] = useStore<Task[]>('tasks.master', [])
  const [bills] = useStore<Bill[]>('pay.bills', [])
  const [cells] = useStore<Record<string, number>>('pay.cells', {})
  const [workBoard, setWorkBoard] = useStore<WBoard>('work.work', { backlog: [], weeks: {} })
  const [homeBoard, setHomeBoard] = useStore<WBoard>('work.home', { backlog: [], weeks: {} })
  const [quick, setQuick] = useState('')
  const confirmDelete = useConfirmDelete()

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
  const [nnDraft, setNnDraft] = useState('')
  const [nnView, setNnView] = useState<Scope>('week')
  const [nnEdit, setNnEdit] = useState(false)

  const nnDone = nnToday.date === today ? nnToday.done : []
  const isWeekend = [0, 6].includes(now.getDay())
  const scopeOf = (n: NonNeg): Scope => n.scope ?? 'all'
  const appliesToday = (n: NonNeg) => scopeOf(n) === 'all' || scopeOf(n) === (isWeekend ? 'weekend' : 'week')
  const todayList = nonNegs.filter(appliesToday)
  const nnCompleted = todayList.filter((n) => nnDone.includes(n.id)).length
  const nnPct = todayList.length ? Math.round((nnCompleted / todayList.length) * 100) : 0
  const nnAllDone = todayList.length > 0 && nnCompleted === todayList.length
  const nnOrdered = [...todayList.filter((n) => nnDone.includes(n.id)), ...todayList.filter((n) => !nnDone.includes(n.id))]
  const firstOpenId = todayList.find((n) => !nnDone.includes(n.id))?.id
  const toggleNonNeg = (id: string) => {
    const done = nnDone.includes(id) ? nnDone.filter((x) => x !== id) : [...nnDone, id]
    setNnToday({ date: today, done })
  }
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
  const bizItems = openBoardItems(normBoard(workBoard), weekKey, todayName, 6)
  const homeTaskItems = openBoardItems(normBoard(homeBoard), weekKey, todayName, 6)
  const completeBoardItem = (setB: (fn: (p: WBoard) => WBoard) => void, id: string) => setB((prev) => {
    const b = normBoard(prev)
    const mark = (arr?: WItem[]) => (arr ?? []).map((i) => i.id === id ? { ...i, done: true, completedAt: Date.now() } : i)
    const weeks: WBoard['weeks'] = {}
    for (const [wk, days] of Object.entries(b.weeks)) { const nd: Record<string, WItem[]> = {}; for (const [d, items] of Object.entries(days)) nd[d] = mark(items); weeks[wk] = nd }
    return { backlog: mark(b.backlog), weeks }
  })
  // New focus tasks land on today's column, so they show here and on today in the planner.
  const addBoardTask = (setB: (fn: (p: WBoard) => WBoard) => void, text: string) => setB((prev) => {
    const b = normBoard(prev)
    const weeks = { ...b.weeks }
    const wk = { ...(weeks[weekKey] ?? {}) }
    wk[todayName] = [...(wk[todayName] ?? []), { id: uid('w'), text: text.trim(), done: false }]
    weeks[weekKey] = wk
    return { ...b, weeks }
  })

  // ---- Upcoming bills (pay.bills / pay.cells) ----
  const upcomingBills = useMemo(
    () => bills
      .filter((b) => cells[`${year}:${b.id}:${month}`] === undefined)
      .sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99)),
    [bills, cells, year, month],
  )

  const initials = (profile.name || 'R').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="fade-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{dateLabel}</p>
          <h1 className="text-[32px] font-semibold leading-tight mt-1" style={{ color: 'var(--color-text)' }}>
            {greeting()}, {(profile.name || 'Rolando').split(' ')[0]} 👋
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
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{(profile.name || 'Rolando').split(' ')[0]}</span>
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
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Your top priorities across the 3 areas that drive your day.</p>
          </div>
        </div>
        <button onClick={() => setNnEdit(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl shrink-0" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
          <IconSlider /> Customize
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        {/* Non-negotiables */}
        <FocusCard accent="var(--color-accent)" icon={<IconCheck width={22} height={22} />} title="Non-negotiables" onViewAll={() => setNnEdit(true)} footerLabel="Manage non-negotiables" onFooter={() => setNnEdit(true)}>
          {todayList.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--color-muted)' }}>None set for today. Tap Customize to add your daily non-negotiables.</p>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4 p-3 rounded-xl" style={{ background: nnAllDone ? 'color-mix(in srgb, #16a34a 12%, var(--color-bg))' : 'var(--color-bg)' }}>
                <ProgressRing pct={nnPct} done={nnAllDone} size={54} />
                <div>
                  <p className="font-semibold text-sm" style={{ color: nnAllDone ? '#16a34a' : 'var(--color-text)' }}>{nnAllDone ? 'All done — game strong! 💪' : `${nnCompleted} of ${todayList.length} done today`}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{nnAllDone ? 'Every non-negotiable checked.' : 'Keep going — check them off below.'}</p>
                </div>
              </div>
              <ul className="flex flex-col gap-2.5">
                {nnOrdered.map((n) => {
                  const done = nnDone.includes(n.id)
                  return (
                    <li key={n.id} className="flex items-center gap-3 text-sm">
                      <button onClick={() => toggleNonNeg(n.id)} className="h-5 w-5 rounded-md grid place-items-center shrink-0" style={{ border: '2px solid var(--color-accent)', background: done ? 'var(--color-accent)' : 'transparent' }} aria-label={done ? 'Mark not done' : 'Mark done'}>
                        {done && <IconCheck width={12} height={12} style={{ color: 'var(--color-on-accent)' }} />}
                      </button>
                      <span className="flex-1" style={{ color: 'var(--color-text)', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.5 : 1 }}>{n.text}</span>
                      {!done && n.id === firstOpenId && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ color: 'var(--color-accent)', background: 'var(--color-surface)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>Next up</span>}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </FocusCard>

        {/* Business priorities → Work tasks */}
        <FocusCard accent="#ea580c" icon={<IconBriefcase />} title="Business priorities" viewAllTo="/work-tasks" footerLabel="Open full tab" footerTo="/work-tasks">
          {bizItems.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--color-muted)' }}>Nothing set for today. Add a task below or schedule one in Work tasks.</p>
          ) : (
            <ul className="flex flex-col gap-3 mb-3">
              {bizItems.map((it) => <BoardRow key={it.id} item={it} accent="#ea580c" onComplete={() => completeBoardItem(setWorkBoard, it.id)} />)}
            </ul>
          )}
          <div className="pt-2" style={{ borderTop: bizItems.length ? '1px solid var(--color-border)' : 'none' }}>
            <AddRow accent="#ea580c" placeholder="Add a business task" onAdd={(t) => addBoardTask(setWorkBoard, t)} />
          </div>
        </FocusCard>

        {/* Home priorities → Home tasks */}
        <FocusCard accent="#16a34a" icon={<IconHome width={22} height={22} />} title="Home priorities" viewAllTo="/home-tasks" footerLabel="Open full tab" footerTo="/home-tasks">
          {homeTaskItems.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--color-muted)' }}>Nothing set for today. Add a task below or schedule one in Home tasks.</p>
          ) : (
            <ul className="flex flex-col gap-3 mb-3">
              {homeTaskItems.map((it) => <BoardRow key={it.id} item={it} accent="#16a34a" onComplete={() => completeBoardItem(setHomeBoard, it.id)} />)}
            </ul>
          )}
          <div className="pt-2" style={{ borderTop: homeTaskItems.length ? '1px solid var(--color-border)' : 'none' }}>
            <AddRow accent="#16a34a" placeholder="Add a home task" onAdd={(t) => addBoardTask(setHomeBoard, t)} />
          </div>
        </FocusCard>
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
