import { useEffect, useMemo, useState } from 'react'
import { Card, PageHeader, Button, Input } from '../components/ui'
import { IconPlus, IconTrash } from '../components/icons'
import { useStore, uid } from '../lib/store'
import { useToast } from '../lib/toast'
import { COMPANIES, companyById, type CompanyId } from '../lib/companies'

type Dept = { id: string; name: string }
type Status = 'green' | 'yellow' | 'red'
type Review = { status?: Status; broken?: string; fixing?: string; owner?: string; due?: string; notes?: string }
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

const currentQuarter = () => { const d = new Date(); return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}` }
const quarterLabel = (q: string) => q.replace('-', ' ')
const nextQuarter = (q: string) => { const [y, qq] = q.split('-Q').map(Number); return qq === 4 ? `${y + 1}-Q1` : `${y}-Q${qq + 1}` }
const fieldStyle = { background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }
function fmtAgo(ts: number): string {
  if (!ts) return ''
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60); if (h < 24) return `${h} hr ago`
  return new Date(ts).toLocaleDateString()
}

/** Compact single status dropdown: dot + label + arrow. */
function StatusSelect({ value, onChange, readOnly }: { value?: Status; onChange: (s?: Status) => void; readOnly?: boolean }) {
  const [open, setOpen] = useState(false)
  const cur = value ? STATUS_META[value] : null
  if (readOnly) return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: cur ? cur.dot : 'var(--color-border)' }} />
      <span style={{ color: cur ? 'var(--color-text)' : 'var(--color-muted)' }}>{cur ? cur.label : '—'}</span>
    </span>
  )
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-sm w-full" style={fieldStyle}>
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cur ? cur.dot : 'var(--color-border)' }} />
          <span className="truncate" style={{ color: cur ? 'var(--color-text)' : 'var(--color-muted)' }}>{cur ? cur.label : 'Set status'}</span>
        </span>
        <span className="text-xs shrink-0" style={{ color: 'var(--color-muted)' }}>▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 z-30 rounded-lg p-1 w-full min-w-[150px]" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}>
            {STATUS_ORDER.map((s) => (
              <button key={s} onClick={() => { onChange(value === s ? undefined : s); setOpen(false) }} className="w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2" style={{ background: value === s ? 'var(--color-bg)' : 'transparent', color: 'var(--color-text)' }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[s].dot }} /> {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function Companies() {
  const { toast } = useToast()
  const [depts, setDepts] = useStore<Dept[]>('companies.depts', SEED_DEPTS)
  const [reviews, setReviews] = useStore<Record<string, Review>>('companies.reviews', {})
  const [quarters, setQuarters] = useStore<string[]>('companies.quarters', [currentQuarter()])
  const [savedAt, setSavedAt] = useStore<number>('companies.savedAt', 0)
  const [, setWorkBoard] = useStore<WorkBoard>('work.work', { backlog: [], weeks: {} })

  const [selected, setSelected] = useState<CompanyId | null>(null)
  const [quarter, setQuarter] = useState<string>(quarters[0] ?? currentQuarter())
  const [editDepts, setEditDepts] = useState(false)
  const [newDept, setNewDept] = useState('')
  const [presenting, setPresenting] = useState(false)
  const [drawerDept, setDrawerDept] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null) // mobile expand
  const [, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 30000); return () => clearInterval(t) }, [])

  const sortedQuarters = useMemo(() => [...quarters].sort((a, b) => b.localeCompare(a)), [quarters])
  const key = (co: CompanyId, q: string, d: string) => `${co}|${q}|${d}`
  const getReview = (co: CompanyId, q: string, d: string): Review => reviews[key(co, q, d)] ?? {}
  const setReview = (co: CompanyId, q: string, d: string, patch: Review) => {
    setReviews((prev) => ({ ...prev, [key(co, q, d)]: { ...prev[key(co, q, d)], ...patch } }))
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
  const addDept = () => { const n = newDept.trim(); if (!n) return; setDepts((prev) => [...prev, { id: uid('d'), name: n }]); setNewDept(''); setSavedAt(Date.now()) }

  const turnIntoTask = (co: CompanyId, deptName: string, fixing: string) => {
    const text = fixing.trim() || `Fix: ${deptName}`
    const item: WorkItem = { id: uid('w'), text, done: false, company: co, cat: 'Work', desc: `${deptName} · ${quarterLabel(quarter)}` }
    setWorkBoard((prev) => {
      const b = prev && Array.isArray(prev.backlog) ? prev : { backlog: [], weeks: {} }
      return { ...b, backlog: [...b.backlog, item] }
    })
    toast(`Added to ${companyById(co)?.name} Work tasks`)
  }

  // ---------- Overview ----------
  if (!selected) {
    return (
      <div>
        <PageHeader title="Companies" subtitle="Quarterly scorecard for each company — what's working, what's broken, and what you're fixing." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COMPANIES.map((c) => {
            const cnt = counts(c.id, quarter)
            return (
              <Card key={c.id} className="p-5 cursor-pointer transition hover:scale-[1.01]">
                <button onClick={() => setSelected(c.id)} className="w-full text-left">
                  <img src={c.logo} alt={c.name} className="object-contain mb-3" style={{ height: 40, width: 'auto', maxWidth: 160 }} draggable={false} />
                  <div className="font-bold" style={{ color: 'var(--color-text)' }}>{c.name}</div>
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    {STATUS_ORDER.map((s) => (
                      <span key={s} className="flex items-center gap-1 tnum" style={{ color: 'var(--color-muted)' }}>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[s].dot }} />{cnt[s]}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs mt-2" style={{ color: 'var(--color-accent)' }}>{quarterLabel(quarter)} · open scorecard →</div>
                </button>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  // ---------- Company scorecard ----------
  const co = companyById(selected)!
  const cnt = counts(selected, quarter)
  const drawerReview = drawerDept ? getReview(selected, quarter, drawerDept) : null
  const drawerName = drawerDept ? depts.find((d) => d.id === drawerDept)?.name : ''

  const gridCols = 'grid-cols-[180px_170px_1fr_1fr]'

  return (
    <div>
      <button onClick={() => { setSelected(null); setPresenting(false) }} className="text-sm font-semibold mb-3 inline-flex items-center gap-1" style={{ color: 'var(--color-accent)' }}>‹ All companies</button>

      {/* Compact company header */}
      <Card className="px-5 py-4 mb-3 flex items-center gap-4 flex-wrap">
        <img src={co.logo} alt={co.name} className="object-contain" style={{ height: 34, width: 'auto', maxWidth: 150 }} draggable={false} />
        <h1 className="text-xl font-semibold leading-tight flex-1 min-w-[140px]" style={{ color: 'var(--color-text)' }}>{co.name}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={quarter} onChange={(e) => setQuarter(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none font-semibold" style={fieldStyle}>
            {sortedQuarters.map((q) => <option key={q} value={q}>{quarterLabel(q)}</option>)}
          </select>
          <Button variant="outline" onClick={addQuarter}><IconPlus width={15} height={15} /> New quarter</Button>
          <Button variant="outline" onClick={() => setPresenting((v) => !v)}>{presenting ? 'Edit' : 'Present'}</Button>
        </div>
      </Card>

      {/* Summary bar */}
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

      {/* Desktop table */}
      <div className="hidden lg:block rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }}>
        <div className={`grid ${gridCols} px-4 py-3 text-xs font-semibold uppercase tracking-wide sticky top-0 z-10`} style={{ color: 'var(--color-muted)', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
          <div>Department</div><div>Status</div><div>What's broken?</div><div>What we're fixing</div>
        </div>
        {depts.map((d, i) => {
          const r = getReview(selected, quarter, d.id)
          return (
            <div key={d.id} className={`grid ${gridCols} items-center gap-3 px-4 py-3`} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--color-border)', minHeight: 64 }}>
              <button onClick={() => setDrawerDept(d.id)} className="text-left font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>{d.name}</button>
              {presenting
                ? <StatusSelect value={r.status} onChange={() => {}} readOnly />
                : <StatusSelect value={r.status} onChange={(s) => setReview(selected, quarter, d.id, { status: s })} />}
              <button onClick={() => setDrawerDept(d.id)} className="text-left text-sm truncate" style={{ color: r.broken ? 'var(--color-text)' : 'var(--color-muted)' }}>{r.broken || 'Add a brief note…'}</button>
              <button onClick={() => setDrawerDept(d.id)} className="text-left text-sm truncate" style={{ color: r.fixing ? 'var(--color-text)' : 'var(--color-muted)' }}>{r.fixing || 'Add the current plan…'}</button>
            </div>
          )
        })}
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden flex flex-col gap-2">
        {depts.map((d) => {
          const r = getReview(selected, quarter, d.id)
          const open = expanded === d.id
          return (
            <div key={d.id} className="rounded-xl p-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => setExpanded(open ? null : d.id)} className="font-semibold text-sm text-left flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                  {r.status && <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[r.status].dot }} />}{d.name}
                  <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{open ? '▾' : '›'}</span>
                </button>
                <div className="w-[150px] shrink-0"><StatusSelect value={r.status} onChange={(s) => setReview(selected, quarter, d.id, { status: s })} readOnly={presenting} /></div>
              </div>
              {open && (
                <div className="mt-2 flex flex-col gap-2">
                  <div><p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--color-muted)' }}>What's broken?</p><textarea value={r.broken ?? ''} onChange={(e) => setReview(selected, quarter, d.id, { broken: e.target.value })} rows={2} placeholder="Add a brief note…" className="w-full mt-1 rounded-lg px-2 py-1.5 text-sm outline-none resize-y" style={fieldStyle} /></div>
                  <div><p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--color-muted)' }}>What we're fixing</p><textarea value={r.fixing ?? ''} onChange={(e) => setReview(selected, quarter, d.id, { fixing: e.target.value })} rows={2} placeholder="Add the current plan…" className="w-full mt-1 rounded-lg px-2 py-1.5 text-sm outline-none resize-y" style={fieldStyle} /></div>
                  <button onClick={() => setDrawerDept(d.id)} className="text-xs font-semibold self-start" style={{ color: 'var(--color-accent)' }}>More details →</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add / edit departments */}
      {!presenting && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Input value={newDept} onChange={(e) => setNewDept(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addDept() }} placeholder="Add department…" className="max-w-xs" />
          <Button variant="outline" onClick={addDept}><IconPlus width={15} height={15} /> Add department</Button>
          <button onClick={() => setEditDepts((v) => !v)} className="text-sm font-semibold ml-1" style={{ color: 'var(--color-accent)' }}>{editDepts ? 'Done' : 'Rename / remove'}</button>
        </div>
      )}
      {editDepts && !presenting && (
        <Card className="p-3 mt-3">
          <ul className="flex flex-col gap-1">
            {depts.map((d) => (
              <li key={d.id} className="group flex items-center gap-2 py-1 px-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                <input value={d.name} onChange={(e) => { setDepts((prev) => prev.map((x) => x.id === d.id ? { ...x, name: e.target.value } : x)); setSavedAt(Date.now()) }} className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--color-text)' }} />
                <button onClick={() => setDepts((prev) => prev.filter((x) => x.id !== d.id))} className="opacity-0 group-hover:opacity-60" style={{ color: 'var(--color-muted)' }}><IconTrash width={14} height={14} /></button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Detail drawer */}
      {drawerDept && drawerReview && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setDrawerDept(null)} />
          <div className="fixed right-0 top-0 z-50 h-full w-full sm:w-[420px] p-5 overflow-y-auto" style={{ background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <img src={co.logo} alt="" className="object-contain" style={{ height: 22, width: 'auto', maxWidth: 90 }} />
                <h3 className="font-bold truncate" style={{ color: 'var(--color-text)' }}>{drawerName}</h3>
              </div>
              <button onClick={() => setDrawerDept(null)} className="text-lg" style={{ color: 'var(--color-muted)' }} aria-label="Close">✕</button>
            </div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Status</label>
            <div className="mt-1 mb-3 max-w-[200px]"><StatusSelect value={drawerReview.status} onChange={(s) => setReview(selected, quarter, drawerDept, { status: s })} /></div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#c0504d' }}>What's broken?</label>
            <textarea value={drawerReview.broken ?? ''} onChange={(e) => setReview(selected, quarter, drawerDept, { broken: e.target.value })} rows={4} placeholder="Describe what's not working…" className="w-full mb-3 mt-1 rounded-xl px-3 py-2 text-sm outline-none resize-y" style={fieldStyle} />
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#2f9266' }}>What we're fixing</label>
            <textarea value={drawerReview.fixing ?? ''} onChange={(e) => setReview(selected, quarter, drawerDept, { fixing: e.target.value })} rows={4} placeholder="The plan to fix it…" className="w-full mb-3 mt-1 rounded-xl px-3 py-2 text-sm outline-none resize-y" style={fieldStyle} />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Owner</label><Input value={drawerReview.owner ?? ''} onChange={(e) => setReview(selected, quarter, drawerDept, { owner: e.target.value })} placeholder="Who's on it" className="mt-1" /></div>
              <div><label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Due date</label><input type="date" value={drawerReview.due ?? ''} onChange={(e) => setReview(selected, quarter, drawerDept, { due: e.target.value || undefined })} className="w-full mt-1 rounded-xl px-3 py-2 text-sm outline-none" style={fieldStyle} /></div>
            </div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Notes</label>
            <textarea value={drawerReview.notes ?? ''} onChange={(e) => setReview(selected, quarter, drawerDept, { notes: e.target.value })} rows={3} placeholder="Anything else…" className="w-full mb-4 mt-1 rounded-xl px-3 py-2 text-sm outline-none resize-y" style={fieldStyle} />
            {(drawerReview.fixing ?? '').trim() && (
              <Button onClick={() => turnIntoTask(selected, drawerName || '', drawerReview.fixing ?? '')}><IconPlus width={15} height={15} /> Turn fixing into a Work task</Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
