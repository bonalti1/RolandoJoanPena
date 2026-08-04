import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, PageHeader, Button, Input } from '../components/ui'
import { IconPlus, IconTrash, IconSearch } from '../components/icons'
import { useStore, uid } from '../lib/store'
import { useToast } from '../lib/toast'
import { useConfirmDelete } from '../lib/confirmDelete'
import { COMPANIES, companyById, type CompanyId } from '../lib/companies'

type Dept = { id: string; name: string }
type Status = 'green' | 'yellow' | 'red'
type Level = 'High' | 'Med' | 'Low'
type Rating = 'good' | 'needs' | 'bad'
type Member = { id: string; name: string; role: string; status?: Status }
type ListItem = { id: string; text: string; level?: Level }
type Metrics = { goal?: number; onTime?: number; quality?: number; satisfaction?: number }
type Review = {
  status?: Status
  broken?: string; fixing?: string; owner?: string; due?: string; notes?: string
  description?: string
  leadName?: string; leadRole?: string
  feedback?: Rating; leadNotes?: string
  cost?: number; headcount?: number
  metrics?: Metrics
  summary?: string
  bottlenecks?: ListItem[]
  problems?: ListItem[]
  team?: Member[]
  hiring?: 'no' | 'maybe' | 'yes'
  sop?: string; costsNotes?: string; goals?: string
}
type WorkItem = { id: string; text: string; done: boolean; company?: CompanyId; cat?: string; desc?: string }
type WorkBoard = { backlog: WorkItem[]; weeks: Record<string, unknown> }

const SEED_DEPTS: Dept[] = [
  'Content', 'Ad spend', 'GHL', 'Appointment setter', 'Closer', 'Mortgage', 'Drafting',
  'Construction loans', 'T/C', 'Client communication', 'Permits, draws & payroll',
  'Scheduling / selections', 'QC / Runner', 'Accountant',
].map((name, i) => ({ id: `d${i}`, name }))

const STATUS_META: Record<Status, { dot: string; label: string }> = {
  green: { dot: '#22c55e', label: 'On track' },
  yellow: { dot: '#eab308', label: 'Needs work' },
  red: { dot: '#ef4444', label: 'Broken' },
}
const STATUS_ORDER: Status[] = ['green', 'yellow', 'red']
const LEVELS: Level[] = ['High', 'Med', 'Low']
const levelColor: Record<Level, string> = { High: '#dc2626', Med: '#f59e0b', Low: '#ca8a04' }
const TABS = ['Overview', 'SOP', 'Costs', 'Bottlenecks', 'Problems', 'Goals', 'Notes'] as const
type Tab = typeof TABS[number]

const currentQuarter = () => { const d = new Date(); return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}` }
const quarterLabel = (q: string) => q.replace('-', ' ')
const nextQuarter = (q: string) => { const [y, qq] = q.split('-Q').map(Number); return qq === 4 ? `${y + 1}-Q1` : `${y}-Q${qq + 1}` }
const fieldStyle = { background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }
const metricColor = (pct: number) => (pct >= 70 ? '#22c55e' : pct >= 40 ? '#eab308' : '#ef4444')
function fmtAgo(ts: number): string {
  if (!ts) return ''
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60); if (h < 24) return `${h} hr ago`
  return new Date(ts).toLocaleDateString()
}

/** Compact single status dropdown: dot + label + arrow. */
function StatusSelect({ value, onChange, compact }: { value?: Status; onChange: (s?: Status) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const cur = value ? STATUS_META[value] : null
  const openMenu = () => {
    const el = btnRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      const width = Math.max(r.width, 160)
      const menuH = 8 + STATUS_ORDER.length * 34
      const below = window.innerHeight - r.bottom
      const top = below < menuH + 12 ? r.top - menuH - 4 : r.bottom + 4
      setPos({ left: Math.min(r.left, window.innerWidth - width - 8), top, width })
    }
    setOpen(true)
  }
  return (
    <>
      <button ref={btnRef} onClick={() => (open ? setOpen(false) : openMenu())} className={`inline-flex items-center justify-between gap-1.5 rounded-lg text-sm ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5 w-full'}`} style={fieldStyle}>
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cur ? cur.dot : 'var(--color-border)' }} />
          <span className="truncate" style={{ color: cur ? 'var(--color-text)' : 'var(--color-muted)' }}>{cur ? cur.label : 'Set status'}</span>
        </span>
        <span className="text-xs shrink-0" style={{ color: 'var(--color-muted)' }}>▾</span>
      </button>
      {open && pos && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="fixed z-[70] rounded-lg p-1" style={{ left: pos.left, top: pos.top, width: pos.width, background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}>
            {STATUS_ORDER.map((s) => (
              <button key={s} onClick={() => { onChange(value === s ? undefined : s); setOpen(false) }} className="w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2" style={{ background: value === s ? 'var(--color-bg)' : 'transparent', color: 'var(--color-text)' }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[s].dot }} /> {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function MetricBar({ label, value, max, suffix, onChange }: { label: string; value: number; max: number; suffix: string; onChange: (v: number) => void }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="rounded-xl p-3" style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{label}</p>
      <div className="flex items-baseline gap-1 mt-0.5">
        <input type="number" value={value || ''} placeholder="0" onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-14 bg-transparent outline-none text-xl font-bold tnum" style={{ color: 'var(--color-text)' }} />
        <span className="text-sm" style={{ color: 'var(--color-muted)' }}>{suffix}</span>
      </div>
      <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--color-surface)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: metricColor(pct), transition: 'width .3s' }} />
      </div>
    </div>
  )
}

function ListEditor({ items, onChange }: { items?: ListItem[]; onChange: (items: ListItem[]) => void }) {
  const list = items ?? []
  const upd = (id: string, patch: Partial<ListItem>) => onChange(list.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  return (
    <div className="flex flex-col gap-2">
      {list.map((it, i) => (
        <div key={it.id} className="group flex items-center gap-2">
          <span className="text-sm tnum w-4 shrink-0" style={{ color: 'var(--color-muted)' }}>{i + 1}</span>
          <input value={it.text} onChange={(e) => upd(it.id, { text: e.target.value })} placeholder="Describe it…" className="flex-1 rounded-lg px-2.5 py-1.5 text-sm outline-none" style={fieldStyle} />
          <div className="flex gap-1 shrink-0">
            {LEVELS.map((lv) => (
              <button key={lv} onClick={() => upd(it.id, { level: lv })} className="text-[11px] font-semibold px-2 py-1 rounded-md" style={it.level === lv ? { background: `color-mix(in srgb, ${levelColor[lv]} 16%, var(--color-surface))`, color: levelColor[lv], border: `1px solid ${levelColor[lv]}` } : { background: 'var(--color-bg)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>{lv}</button>
            ))}
          </div>
          <button onClick={() => onChange(list.filter((x) => x.id !== it.id))} className="opacity-0 group-hover:opacity-60 shrink-0" style={{ color: 'var(--color-muted)' }}><IconTrash width={14} height={14} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...list, { id: uid('li'), text: '', level: 'Med' }])} className="text-sm font-semibold self-start inline-flex items-center gap-1 mt-1" style={{ color: 'var(--color-accent)' }}><IconPlus width={14} height={14} /> Add</button>
    </div>
  )
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-5">
    <h3 className="text-xs font-bold uppercase tracking-[0.1em] mb-2" style={{ color: 'var(--color-muted)' }}>{title}</h3>
    {children}
  </div>
)
const TextArea = (p: { value?: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) => (
  <textarea value={p.value ?? ''} onChange={(e) => p.onChange(e.target.value)} rows={p.rows ?? 5} placeholder={p.placeholder} className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-y" style={fieldStyle} />
)

export default function Companies() {
  const { toast } = useToast()
  const confirmDelete = useConfirmDelete()
  const [depts, setDepts] = useStore<Dept[]>('companies.depts', SEED_DEPTS)
  const [reviews, setReviews] = useStore<Record<string, Review>>('companies.reviews', {})
  const [quarters, setQuarters] = useStore<string[]>('companies.quarters', [currentQuarter()])
  const [savedAt, setSavedAt] = useStore<number>('companies.savedAt', 0)
  const [, setWorkBoard] = useStore<WorkBoard>('work.work', { backlog: [], weeks: {} })

  const [selected, setSelected] = useState<CompanyId | null>(null)
  const [quarter, setQuarter] = useState<string>(quarters[0] ?? currentQuarter())
  const [deptSel, setDeptSel] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('Overview')
  const [search, setSearch] = useState('')
  const [editDepts, setEditDepts] = useState(false)
  const [newDept, setNewDept] = useState('')
  const [, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 30000); return () => clearInterval(t) }, [])

  const sortedQuarters = useMemo(() => [...quarters].sort((a, b) => b.localeCompare(a)), [quarters])
  const key = (co: CompanyId, q: string, d: string) => `${co}|${q}|${d}`
  const getReview = (co: CompanyId, q: string, d: string): Review => reviews[key(co, q, d)] ?? {}
  const setReview = (d: string, patch: Review) => {
    if (!selected) return
    setReviews((prev) => ({ ...prev, [key(selected, quarter, d)]: { ...prev[key(selected, quarter, d)], ...patch } }))
    setSavedAt(Date.now())
  }
  const counts = (co: CompanyId, q: string) => {
    const c = { green: 0, yellow: 0, red: 0 }
    for (const d of depts) { const s = getReview(co, q, d.id).status; if (s) c[s]++ }
    return c
  }
  const addQuarter = () => {
    const latest = sortedQuarters[0] ?? currentQuarter()
    const q = nextQuarter(latest)
    if (!quarters.includes(q)) setQuarters((prev) => [...prev, q])
    setQuarter(q)
  }
  const addDept = () => { const n = newDept.trim(); if (!n) return; const id = uid('d'); setDepts((prev) => [...prev, { id, name: n }]); setNewDept(''); setDeptSel(id); setSavedAt(Date.now()) }

  const turnIntoTask = (deptName: string, text: string) => {
    if (!selected) return
    const item: WorkItem = { id: uid('w'), text: text.trim() || `Fix: ${deptName}`, done: false, company: selected, cat: 'Task', desc: `${deptName} · ${quarterLabel(quarter)}` }
    setWorkBoard((prev) => {
      const b = prev && Array.isArray(prev.backlog) ? prev : { backlog: [], weeks: {} }
      return { ...b, backlog: [...b.backlog, item] }
    })
    toast(`Added to ${companyById(selected)?.name} Work tasks`)
  }

  // ---------- Company picker ----------
  if (!selected) {
    return (
      <div>
        <PageHeader title="Companies" subtitle="A quarterly operating review for each company — evaluate every department and leader, then decide what to fix, staff, or grow." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COMPANIES.map((c) => {
            const cnt = counts(c.id, quarter)
            return (
              <Card key={c.id} className="p-5 cursor-pointer transition hover:scale-[1.01]">
                <button onClick={() => { setSelected(c.id); setDeptSel(depts[0]?.id ?? null); setTab('Overview') }} className="w-full text-left">
                  <img src={c.logo} alt={c.name} className="object-contain mb-3" style={{ height: 40, width: 'auto', maxWidth: 160 }} draggable={false} />
                  <div className="font-bold" style={{ color: 'var(--color-text)' }}>{c.name}</div>
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    {STATUS_ORDER.map((s) => (
                      <span key={s} className="flex items-center gap-1 tnum" style={{ color: 'var(--color-muted)' }}>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[s].dot }} />{cnt[s]}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs mt-2" style={{ color: 'var(--color-accent)' }}>{quarterLabel(quarter)} · open review →</div>
                </button>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  // ---------- Company operating review ----------
  const co = companyById(selected)!
  const cnt = counts(selected, quarter)
  const visibleDepts = depts.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
  const activeId = deptSel ?? depts[0]?.id ?? null
  const dept = depts.find((d) => d.id === activeId) ?? null
  const r: Review = dept ? getReview(selected, quarter, dept.id) : {}
  const set = (patch: Review) => { if (dept) setReview(dept.id, patch) }
  const leadFirst = (r.leadName || '').split(' ')[0]

  const topBottlenecks = (r.bottlenecks ?? []).filter((b) => b.text.trim()).slice(0, 3)
  const topProblems = (r.problems ?? []).filter((b) => b.text.trim()).slice(0, 3)

  return (
    <div>
      {/* Header */}
      <Card className="px-5 py-4 mb-4 flex items-center gap-4 flex-wrap">
        <button onClick={() => setSelected(null)} className="text-sm font-semibold inline-flex items-center gap-1 shrink-0" style={{ color: 'var(--color-accent)' }}>‹</button>
        <img src={co.logo} alt={co.name} className="object-contain" style={{ height: 30, width: 'auto', maxWidth: 120 }} draggable={false} />
        <h1 className="text-xl font-semibold leading-tight flex-1 min-w-[120px]" style={{ color: 'var(--color-text)' }}>{co.name}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={quarter} onChange={(e) => setQuarter(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none font-semibold" style={fieldStyle}>
            {sortedQuarters.map((q) => <option key={q} value={q}>{quarterLabel(q)}</option>)}
          </select>
          <Button variant="outline" onClick={addQuarter}><IconPlus width={15} height={15} /> New quarter</Button>
        </div>
      </Card>

      {/* Summary */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3 px-1">
        <div className="flex items-center gap-4 text-sm">
          {STATUS_ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--color-text)' }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[s].dot }} />{cnt[s]} <span className="font-normal" style={{ color: 'var(--color-muted)' }}>{STATUS_META[s].label}</span>
            </span>
          ))}
        </div>
        {savedAt > 0 && <span className="text-xs" style={{ color: 'var(--color-muted)' }}>Last saved {fmtAgo(savedAt)}</span>}
      </div>

      <div className="grid lg:grid-cols-[230px_1fr] xl:grid-cols-[230px_1fr_290px] gap-4 items-start">
        {/* Department sidebar */}
        <Card className="p-2 lg:sticky lg:top-3">
          <div className="relative mb-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted)' }}><IconSearch width={14} height={14} /></span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search departments…" className="w-full rounded-lg pl-8 pr-2 py-2 text-sm outline-none" style={fieldStyle} />
          </div>
          <ul className="flex flex-col gap-0.5 max-h-[60vh] overflow-y-auto">
            {visibleDepts.map((d) => {
              const st = getReview(selected, quarter, d.id).status
              const active = d.id === activeId
              return (
                <li key={d.id}>
                  <button onClick={() => { setDeptSel(d.id); setTab('Overview') }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm" style={{ background: active ? 'color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))' : 'transparent', color: 'var(--color-text)', fontWeight: active ? 600 : 450 }}>
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: st ? STATUS_META[st].dot : 'var(--color-border)' }} />
                    <span className="flex-1 truncate">{d.name}</span>
                    <span className="text-xs shrink-0" style={{ color: 'var(--color-muted)' }}>›</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="mt-2 pt-2 flex flex-col gap-1.5" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div className="flex gap-1.5">
              <input value={newDept} onChange={(e) => setNewDept(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addDept() }} placeholder="Add department…" className="flex-1 min-w-0 rounded-lg px-2 py-1.5 text-sm outline-none" style={fieldStyle} />
              <button onClick={addDept} className="shrink-0 rounded-lg px-2" style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}><IconPlus width={15} height={15} /></button>
            </div>
            <button onClick={() => setEditDepts((v) => !v)} className="text-xs font-semibold text-left px-1" style={{ color: 'var(--color-accent)' }}>{editDepts ? 'Done' : 'Rename / remove'}</button>
            {editDepts && (
              <ul className="flex flex-col gap-1 mt-1">
                {depts.map((d) => (
                  <li key={d.id} className="group flex items-center gap-1.5 px-1.5 py-1 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                    <input value={d.name} onChange={(e) => { setDepts((prev) => prev.map((x) => x.id === d.id ? { ...x, name: e.target.value } : x)); setSavedAt(Date.now()) }} className="flex-1 min-w-0 bg-transparent text-xs outline-none" style={{ color: 'var(--color-text)' }} />
                    <button onClick={() => confirmDelete({ label: d.name ? `the “${d.name}” department` : 'this department', detail: 'This department and its review will be removed.', onConfirm: () => { setDepts((prev) => prev.filter((x) => x.id !== d.id)); if (activeId === d.id) setDeptSel(null); setSavedAt(Date.now()) } })} className="opacity-0 group-hover:opacity-60 shrink-0" style={{ color: 'var(--color-muted)' }}><IconTrash width={13} height={13} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Main detail */}
        {!dept ? (
          <Card className="p-8 text-center" style={{ color: 'var(--color-muted)' }}>Add a department to start the review.</Card>
        ) : (
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{dept.name}</h2>
              <div className="w-[160px]"><StatusSelect value={r.status} onChange={(s) => set({ status: s })} /></div>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-2 mb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)} className="px-3 py-1.5 text-sm font-semibold shrink-0 rounded-t-lg" style={{ color: tab === t ? 'var(--color-accent)' : 'var(--color-muted)', borderBottom: tab === t ? '2px solid var(--color-accent)' : '2px solid transparent' }}>{t}</button>
              ))}
            </div>

            {tab === 'Overview' && (
              <div>
                <Section title="Overview">
                  <TextArea value={r.description} onChange={(v) => set({ description: v })} rows={2} placeholder="What this department owns…" />
                </Section>
                <div className="grid sm:grid-cols-3 gap-3 mb-5">
                  <div className="rounded-xl p-3" style={{ border: '1px solid var(--color-border)' }}>
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Status</p>
                    <div className="mt-1.5"><StatusSelect value={r.status} onChange={(s) => set({ status: s })} compact /></div>
                  </div>
                  <div className="rounded-xl p-3" style={{ border: '1px solid var(--color-border)' }}>
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Quarterly cost</p>
                    <div className="flex items-baseline gap-1 mt-1"><span className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>$</span><input type="number" value={r.cost || ''} placeholder="0" onChange={(e) => set({ cost: parseFloat(e.target.value) || 0 })} className="w-24 bg-transparent outline-none text-xl font-bold tnum" style={{ color: 'var(--color-text)' }} /></div>
                  </div>
                  <div className="rounded-xl p-3" style={{ border: '1px solid var(--color-border)' }}>
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Headcount</p>
                    <input type="number" value={r.headcount || ''} placeholder="0" onChange={(e) => set({ headcount: parseFloat(e.target.value) || 0 })} className="w-16 bg-transparent outline-none text-xl font-bold tnum mt-1" style={{ color: 'var(--color-text)' }} />
                  </div>
                </div>
                <Section title="Performance snapshot">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MetricBar label="Goal progress" value={r.metrics?.goal ?? 0} max={100} suffix="%" onChange={(v) => set({ metrics: { ...r.metrics, goal: v } })} />
                    <MetricBar label="On-time tasks" value={r.metrics?.onTime ?? 0} max={100} suffix="%" onChange={(v) => set({ metrics: { ...r.metrics, onTime: v } })} />
                    <MetricBar label="Quality score" value={r.metrics?.quality ?? 0} max={5} suffix="/5" onChange={(v) => set({ metrics: { ...r.metrics, quality: v } })} />
                    <MetricBar label="Satisfaction" value={r.metrics?.satisfaction ?? 0} max={5} suffix="/5" onChange={(v) => set({ metrics: { ...r.metrics, satisfaction: v } })} />
                  </div>
                </Section>
                <Section title="Quick summary">
                  <TextArea value={r.summary} onChange={(v) => set({ summary: v })} rows={3} placeholder="Key takeaways this quarter…" />
                </Section>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="rounded-xl p-3" style={{ border: '1px solid var(--color-border)' }}>
                    <div className="flex items-center justify-between mb-2"><h4 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Top bottlenecks</h4><button onClick={() => setTab('Bottlenecks')} className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>Edit →</button></div>
                    {topBottlenecks.length === 0 ? <p className="text-sm" style={{ color: 'var(--color-muted)' }}>None logged.</p> : topBottlenecks.map((b, i) => (
                      <div key={b.id} className="flex items-center gap-2 text-sm py-1"><span className="tnum w-4" style={{ color: 'var(--color-muted)' }}>{i + 1}</span><span className="flex-1 truncate" style={{ color: 'var(--color-text)' }}>{b.text}</span>{b.level && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: `color-mix(in srgb, ${levelColor[b.level]} 16%, var(--color-surface))`, color: levelColor[b.level] }}>{b.level}</span>}</div>
                    ))}
                  </div>
                  <div className="rounded-xl p-3" style={{ border: '1px solid var(--color-border)' }}>
                    <div className="flex items-center justify-between mb-2"><h4 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Top problems</h4><button onClick={() => setTab('Problems')} className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>Edit →</button></div>
                    {topProblems.length === 0 ? <p className="text-sm" style={{ color: 'var(--color-muted)' }}>None logged.</p> : topProblems.map((b, i) => (
                      <div key={b.id} className="flex items-center gap-2 text-sm py-1"><span className="tnum w-4" style={{ color: 'var(--color-muted)' }}>{i + 1}</span><span className="flex-1 truncate" style={{ color: 'var(--color-text)' }}>{b.text}</span>{b.level && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: `color-mix(in srgb, ${levelColor[b.level]} 16%, var(--color-surface))`, color: levelColor[b.level] }}>{b.level}</span>}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'SOP' && <Section title="Standard operating procedure"><TextArea value={r.sop} onChange={(v) => set({ sop: v })} rows={12} placeholder="How this department runs — step by step…" /></Section>}
            {tab === 'Costs' && (
              <div>
                <Section title="Quarterly cost"><div className="flex items-baseline gap-1"><span className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>$</span><input type="number" value={r.cost || ''} placeholder="0" onChange={(e) => set({ cost: parseFloat(e.target.value) || 0 })} className="w-32 bg-transparent outline-none text-2xl font-bold tnum" style={{ color: 'var(--color-text)' }} /></div></Section>
                <Section title="Cost notes"><TextArea value={r.costsNotes} onChange={(v) => set({ costsNotes: v })} rows={8} placeholder="Tools, salaries, ad spend, vendors…" /></Section>
              </div>
            )}
            {tab === 'Bottlenecks' && <Section title="Bottlenecks"><ListEditor items={r.bottlenecks} onChange={(items) => set({ bottlenecks: items })} /></Section>}
            {tab === 'Problems' && <Section title="Problems"><ListEditor items={r.problems} onChange={(items) => set({ problems: items })} /></Section>}
            {tab === 'Goals' && (
              <div>
                <Section title="Goals for the quarter"><TextArea value={r.goals} onChange={(v) => set({ goals: v })} rows={8} placeholder="What this department must achieve…" /></Section>
                <Section title="What we're fixing">
                  <TextArea value={r.fixing} onChange={(v) => set({ fixing: v })} rows={3} placeholder="The plan to fix what's broken…" />
                  {(r.fixing ?? '').trim() && <Button className="mt-2" onClick={() => turnIntoTask(dept.name, r.fixing ?? '')}><IconPlus width={15} height={15} /> Turn into a Work task</Button>}
                </Section>
              </div>
            )}
            {tab === 'Notes' && <Section title="Notes"><TextArea value={r.notes} onChange={(v) => set({ notes: v })} rows={12} placeholder="Anything else about this department…" /></Section>}
          </Card>
        )}

        {/* Right rail: leader, team, hiring */}
        {dept && (
          <div className="flex flex-col gap-4 xl:sticky xl:top-3">
            <Card className="p-4">
              <h3 className="font-bold mb-3" style={{ color: 'var(--color-text)' }}>Department lead</h3>
              <Input value={r.leadName ?? ''} onChange={(e) => set({ leadName: e.target.value })} placeholder="Lead name" className="mb-2" />
              <Input value={r.leadRole ?? ''} onChange={(e) => set({ leadRole: e.target.value })} placeholder="Role (e.g. Content Lead)" />
              <div className="mt-4">
                <p className="text-sm mb-2" style={{ color: 'var(--color-muted)' }}>How is {leadFirst || 'the lead'} doing?</p>
                <div className="grid grid-cols-3 gap-2">
                  {([['good', '👍', 'Good', '#16a34a'], ['needs', '😐', 'Needs work', '#d97706'], ['bad', '👎', 'Bad', '#dc2626']] as const).map(([val, emoji, label, color]) => (
                    <button key={val} onClick={() => set({ feedback: r.feedback === val ? undefined : val })} className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition" style={r.feedback === val ? { background: `color-mix(in srgb, ${color} 14%, var(--color-surface))`, border: `1px solid ${color}`, color } : { background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
                      <span className="text-lg leading-none">{emoji}</span><span className="text-[11px] font-semibold">{label}</span>
                    </button>
                  ))}
                </div>
                <textarea value={r.leadNotes ?? ''} onChange={(e) => set({ leadNotes: e.target.value })} rows={3} placeholder={`Notes about ${leadFirst || 'the lead'}…`} className="w-full mt-3 rounded-xl px-3 py-2 text-sm outline-none resize-y" style={fieldStyle} />
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-bold mb-3" style={{ color: 'var(--color-text)' }}>Team ({(r.team ?? []).length})</h3>
              <ul className="flex flex-col gap-2">
                {(r.team ?? []).map((m) => (
                  <li key={m.id} className="group flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <input value={m.name} onChange={(e) => set({ team: (r.team ?? []).map((x) => x.id === m.id ? { ...x, name: e.target.value } : x) })} placeholder="Name" className="w-full bg-transparent text-sm font-medium outline-none" style={{ color: 'var(--color-text)' }} />
                      <input value={m.role} onChange={(e) => set({ team: (r.team ?? []).map((x) => x.id === m.id ? { ...x, role: e.target.value } : x) })} placeholder="Role" className="w-full bg-transparent text-xs outline-none" style={{ color: 'var(--color-muted)' }} />
                    </div>
                    <div className="w-[130px] shrink-0"><StatusSelect value={m.status} onChange={(s) => set({ team: (r.team ?? []).map((x) => x.id === m.id ? { ...x, status: s } : x) })} compact /></div>
                    <button onClick={() => set({ team: (r.team ?? []).filter((x) => x.id !== m.id) })} className="opacity-0 group-hover:opacity-60 shrink-0" style={{ color: 'var(--color-muted)' }}><IconTrash width={13} height={13} /></button>
                  </li>
                ))}
              </ul>
              <button onClick={() => set({ team: [...(r.team ?? []), { id: uid('m'), name: '', role: '' }] })} className="text-sm font-semibold inline-flex items-center gap-1 mt-3" style={{ color: 'var(--color-accent)' }}><IconPlus width={14} height={14} /> Add team member</button>
            </Card>

            <Card className="p-4">
              <h3 className="font-bold mb-1" style={{ color: 'var(--color-text)' }}>Hiring need</h3>
              <p className="text-sm mb-3" style={{ color: 'var(--color-muted)' }}>Do you need to hire for this department?</p>
              <div className="grid grid-cols-3 gap-2">
                {([['no', 'No need'], ['maybe', 'Maybe'], ['yes', 'Yes, hire']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => set({ hiring: r.hiring === val ? undefined : val })} className="py-2 rounded-xl text-sm font-semibold transition" style={r.hiring === val ? (val === 'yes' ? { background: 'var(--color-accent)', color: 'var(--color-on-accent)' } : { background: 'color-mix(in srgb, var(--color-accent) 14%, var(--color-surface))', border: '1px solid var(--color-accent)', color: 'var(--color-accent)' }) : { background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>{label}</button>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
