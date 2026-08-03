import { useMemo, useState } from 'react'
import { Card, PageHeader, Button, Input } from '../components/ui'
import { IconPlus, IconTrash } from '../components/icons'
import { useStore, uid } from '../lib/store'
import { useToast } from '../lib/toast'
import { COMPANIES, companyById, type CompanyId } from '../lib/companies'

type Dept = { id: string; name: string }
type Status = 'green' | 'yellow' | 'red'
type Review = { status?: Status; broken?: string; fixing?: string }
// Board shapes just enough to append a task to the Work-tasks Master List.
type WorkItem = { id: string; text: string; done: boolean; company?: CompanyId; cat?: string; desc?: string }
type WorkBoard = { backlog: WorkItem[]; weeks: Record<string, unknown> }

const SEED_DEPTS: Dept[] = [
  'Content', 'Ad spend', 'GHL', 'Appt setter', 'Closer', 'Mortgage', 'Drafting',
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

export default function Companies() {
  const { toast } = useToast()
  const [depts, setDepts] = useStore<Dept[]>('companies.depts', SEED_DEPTS)
  const [reviews, setReviews] = useStore<Record<string, Review>>('companies.reviews', {})
  const [quarters, setQuarters] = useStore<string[]>('companies.quarters', [currentQuarter()])
  const [, setWorkBoard] = useStore<WorkBoard>('work.work', { backlog: [], weeks: {} })

  const [selected, setSelected] = useState<CompanyId | null>(null)
  const [quarter, setQuarter] = useState<string>(quarters[0] ?? currentQuarter())
  const [editDepts, setEditDepts] = useState(false)
  const [newDept, setNewDept] = useState('')
  const [presenting, setPresenting] = useState(false)

  const sortedQuarters = useMemo(() => [...quarters].sort((a, b) => b.localeCompare(a)), [quarters])
  const key = (co: CompanyId, q: string, d: string) => `${co}|${q}|${d}`
  const getReview = (co: CompanyId, q: string, d: string): Review => reviews[key(co, q, d)] ?? {}
  const setReview = (co: CompanyId, q: string, d: string, patch: Review) =>
    setReviews((prev) => ({ ...prev, [key(co, q, d)]: { ...prev[key(co, q, d)], ...patch } }))

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

  return (
    <div>
      <button onClick={() => { setSelected(null); setPresenting(false) }} className="text-sm font-semibold mb-4 inline-flex items-center gap-1" style={{ color: 'var(--color-accent)' }}>‹ All companies</button>

      <Card className="p-5 mb-5 flex items-center gap-4 flex-wrap">
        <img src={co.logo} alt={co.name} className="object-contain" style={{ height: 48, width: 'auto', maxWidth: 200 }} draggable={false} />
        <div className="flex-1 min-w-[160px]">
          <h1 className="text-2xl font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>{co.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm">
            {STATUS_ORDER.map((s) => (
              <span key={s} className="flex items-center gap-1.5" style={{ color: 'var(--color-muted)' }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[s].dot }} />{cnt[s]} {STATUS_META[s].label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={quarter} onChange={(e) => setQuarter(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none font-semibold" style={fieldStyle}>
            {sortedQuarters.map((q) => <option key={q} value={q}>{quarterLabel(q)}</option>)}
          </select>
          <Button variant="outline" onClick={addQuarter}><IconPlus width={15} height={15} /> New quarter</Button>
          <Button variant="outline" onClick={() => setPresenting((v) => !v)}>{presenting ? 'Edit' : 'Present'}</Button>
        </div>
      </Card>

      {/* Scorecard */}
      <div className="flex flex-col gap-3">
        {depts.map((d) => {
          const r = getReview(selected, quarter, d.id)
          return (
            <div key={d.id} className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  {r.status && <span className="h-3 w-3 rounded-full shrink-0" style={{ background: STATUS_META[r.status].dot }} />}
                  <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{d.name}</span>
                  {r.status && <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{STATUS_META[r.status].label}</span>}
                </div>
                {!presenting && (
                  <div className="flex items-center gap-1.5">
                    {STATUS_ORDER.map((s) => (
                      <button key={s} onClick={() => setReview(selected, quarter, d.id, { status: r.status === s ? undefined : s })} title={STATUS_META[s].label}
                        className="h-6 w-6 rounded-full grid place-items-center transition"
                        style={{ background: STATUS_META[s].dot, opacity: r.status === s ? 1 : 0.28, outline: r.status === s ? '2px solid var(--color-text)' : 'none', outlineOffset: 1 }} />
                    ))}
                  </div>
                )}
              </div>

              {presenting ? (
                <div className="grid sm:grid-cols-2 gap-3 mt-2">
                  <div><p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#c0504d' }}>Broken</p><p className="text-sm" style={{ color: 'var(--color-text)' }}>{r.broken || '—'}</p></div>
                  <div><p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#2f9266' }}>Fixing</p><p className="text-sm" style={{ color: 'var(--color-text)' }}>{r.fixing || '—'}</p></div>
                </div>
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    <textarea value={r.broken ?? ''} onChange={(e) => setReview(selected, quarter, d.id, { broken: e.target.value })} rows={2} placeholder="What's broken?" className="rounded-xl px-3 py-2 text-sm outline-none resize-y w-full" style={fieldStyle} />
                    <textarea value={r.fixing ?? ''} onChange={(e) => setReview(selected, quarter, d.id, { fixing: e.target.value })} rows={2} placeholder="What we're fixing…" className="rounded-xl px-3 py-2 text-sm outline-none resize-y w-full" style={fieldStyle} />
                  </div>
                  {(r.fixing ?? '').trim() && (
                    <button onClick={() => turnIntoTask(selected, d.name, r.fixing ?? '')} className="mt-2 text-xs font-semibold inline-flex items-center gap-1" style={{ color: 'var(--color-accent)' }}>
                      <IconPlus width={13} height={13} /> Turn into a Work task
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Manage the shared department list */}
      {!presenting && (
        <Card className="p-4 mt-5">
          <button onClick={() => setEditDepts((v) => !v)} className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>{editDepts ? 'Done editing departments' : 'Edit departments'}</button>
          {editDepts && (
            <div className="mt-3">
              <p className="text-xs mb-2" style={{ color: 'var(--color-muted)' }}>Departments are shared across all companies.</p>
              <ul className="flex flex-col gap-1 mb-3">
                {depts.map((d) => (
                  <li key={d.id} className="group flex items-center gap-2 py-1 px-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                    <input value={d.name} onChange={(e) => setDepts((prev) => prev.map((x) => x.id === d.id ? { ...x, name: e.target.value } : x))} className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--color-text)' }} />
                    <button onClick={() => setDepts((prev) => prev.filter((x) => x.id !== d.id))} className="opacity-0 group-hover:opacity-60" style={{ color: 'var(--color-muted)' }}><IconTrash width={14} height={14} /></button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input value={newDept} onChange={(e) => setNewDept(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newDept.trim()) { setDepts((prev) => [...prev, { id: uid('d'), name: newDept.trim() }]); setNewDept('') } }} placeholder="New department…" />
                <Button variant="outline" onClick={() => { if (newDept.trim()) { setDepts((prev) => [...prev, { id: uid('d'), name: newDept.trim() }]); setNewDept('') } }}><IconPlus width={15} height={15} /> Add</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
