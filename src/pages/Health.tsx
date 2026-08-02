import { useMemo, useState } from 'react'
import { Card, PageHeader, Button, Input, EmptyState } from '../components/ui'
import { IconPlus, IconTrash, IconHealth, IconSearch } from '../components/icons'
import { useStore, uid } from '../lib/store'
import { useToast } from '../lib/toast'

type Weigh = { id: string; date: string; value: number }
type Record_ = { id: string; date: string; kind: string; title: string; notes: string; file?: { name: string; data: string } }
type Goals = { goalWeight?: number; heightIn?: number }

const RECORD_KINDS = ['Doctor visit', 'Lab result', 'Prescription', 'Vaccine', 'Other']
const fieldStyle = { background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }

function WeightChart({ data, goal }: { data: Weigh[]; goal?: number }) {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length < 1) return <div className="h-40 grid place-items-center text-sm" style={{ color: 'var(--color-muted)' }}>Log a weight to see your trend.</div>
  const w = 560, h = 180, padL = 36, padB = 20, padT = 12, padR = 10
  const vals = sorted.map((d) => d.value).concat(goal != null ? [goal] : [])
  let min = Math.min(...vals), max = Math.max(...vals)
  if (min === max) { min -= 5; max += 5 }
  const pad = (max - min) * 0.15; min -= pad; max += pad
  const x = (i: number) => padL + (sorted.length === 1 ? (w - padL - padR) / 2 : (i / (sorted.length - 1)) * (w - padL - padR))
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (h - padT - padB)
  const line = sorted.map((d, i) => `${x(i)},${y(d.value)}`).join(' ')
  const area = `${padL},${h - padB} ${line} ${x(sorted.length - 1)},${h - padB}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 180 }}>
      <defs>
        <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[max, (max + min) / 2, min].map((v, i) => (
        <g key={i}>
          <line x1={padL} y1={y(v)} x2={w - padR} y2={y(v)} stroke="var(--color-border)" strokeWidth="1" />
          <text x={4} y={y(v) + 3} fontSize="9" fill="var(--color-muted)">{Math.round(v)}</text>
        </g>
      ))}
      {goal != null && (
        <g>
          <line x1={padL} y1={y(goal)} x2={w - padR} y2={y(goal)} stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7" />
          <text x={w - padR} y={y(goal) - 4} fontSize="9" fill="var(--color-accent)" textAnchor="end">goal {goal}</text>
        </g>
      )}
      <polygon points={area} fill="url(#wg)" />
      <polyline points={line} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {sorted.map((d, i) => <circle key={d.id} cx={x(i)} cy={y(d.value)} r={i === sorted.length - 1 ? 4 : 2.5} fill="var(--color-accent)" />)}
    </svg>
  )
}

export default function Health() {
  const [weights, setWeights] = useStore<Weigh[]>('health.weights', [])
  const [records, setRecords] = useStore<Record_[]>('health.records', [])
  const [goals, setGoals] = useStore<Goals>('health.goals', {})
  const { removeWithUndo } = useToast()

  const [wDate, setWDate] = useState(new Date().toISOString().slice(0, 10))
  const [wVal, setWVal] = useState('')
  const [rKind, setRKind] = useState(RECORD_KINDS[0])
  const [rTitle, setRTitle] = useState('')
  const [rNotes, setRNotes] = useState('')
  const [rFile, setRFile] = useState<{ name: string; data: string } | undefined>()
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState('All')

  const sortedDesc = useMemo(() => [...weights].sort((a, b) => b.date.localeCompare(a.date)), [weights])
  const latest = sortedDesc[0] ?? null
  const prev = sortedDesc[1] ?? null
  const change = latest && prev ? +(latest.value - prev.value).toFixed(1) : null
  const toGoal = latest && goals.goalWeight != null ? +(latest.value - goals.goalWeight).toFixed(1) : null
  const bmi = latest && goals.heightIn ? +((latest.value / (goals.heightIn * goals.heightIn)) * 703).toFixed(1) : null

  const addWeight = () => {
    const v = parseFloat(wVal); if (isNaN(v)) return
    setWeights((prev) => [...prev, { id: uid('w'), date: wDate, value: v }]); setWVal('')
  }
  const addRecord = () => {
    if (!rTitle.trim()) return
    setRecords((prev) => [{ id: uid('r'), date: new Date().toISOString().slice(0, 10), kind: rKind, title: rTitle.trim(), notes: rNotes.trim(), file: rFile }, ...prev])
    setRTitle(''); setRNotes(''); setRFile(undefined)
  }
  const filteredRecords = records.filter((r) =>
    (kindFilter === 'All' || r.kind === kindFilter) &&
    (!query.trim() || (r.title + ' ' + r.notes + ' ' + r.kind).toLowerCase().includes(query.toLowerCase())))

  return (
    <div>
      <PageHeader title="Health" subtitle="Track weight toward a goal and keep every doctor visit & lab in one place." />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="p-4"><p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Current</p><p className="text-2xl font-semibold tnum mt-1" style={{ color: 'var(--color-text)' }}>{latest ? latest.value : '—'}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Change</p><p className="text-2xl font-semibold tnum mt-1" style={{ color: change == null ? 'var(--color-muted)' : change <= 0 ? 'var(--color-accent)' : '#d97a7a' }}>{change == null ? '—' : `${change > 0 ? '+' : ''}${change}`}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>To goal</p><p className="text-2xl font-semibold tnum mt-1" style={{ color: 'var(--color-text)' }}>{toGoal == null ? '—' : `${Math.abs(toGoal)}`}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>BMI</p><p className="text-2xl font-semibold tnum mt-1" style={{ color: 'var(--color-text)' }}>{bmi ?? '—'}</p></Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart + add */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>Weight trend</h2>
            {latest && <span className="text-sm" style={{ color: 'var(--color-muted)' }}>latest {latest.date}</span>}
          </div>
          <WeightChart data={weights} goal={goals.goalWeight} />
          <form onSubmit={(e) => { e.preventDefault(); addWeight() }} className="flex gap-2 mt-4">
            <Input type="date" value={wDate} onChange={(e) => setWDate(e.target.value)} className="max-w-[160px]" />
            <Input type="number" step="0.1" value={wVal} onChange={(e) => setWVal(e.target.value)} placeholder="Weight (lb)" />
            <Button type="submit"><IconPlus width={16} height={16} /></Button>
          </form>
          {weights.length > 0 && (
            <ul className="flex flex-col gap-1 mt-4 max-h-40 overflow-y-auto">
              {sortedDesc.map((w) => (
                <li key={w.id} className="group flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-black/5">
                  <span style={{ color: 'var(--color-muted)' }}>{w.date}</span>
                  <span className="flex-1 font-semibold" style={{ color: 'var(--color-text)' }}>{w.value}</span>
                  <button onClick={() => setWeights((p) => p.filter((x) => x.id !== w.id))} className="opacity-0 group-hover:opacity-60" style={{ color: 'var(--color-muted)' }}><IconTrash width={14} height={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Goals */}
        <Card className="p-5">
          <h2 className="font-bold text-lg mb-3" style={{ color: 'var(--color-text)' }}>Goals</h2>
          <label className="text-sm block mb-1" style={{ color: 'var(--color-muted)' }}>Goal weight (lb)</label>
          <Input type="number" value={goals.goalWeight ?? ''} onChange={(e) => setGoals({ ...goals, goalWeight: e.target.value === '' ? undefined : parseFloat(e.target.value) })} placeholder="e.g. 135" />
          <label className="text-sm block mb-1 mt-4" style={{ color: 'var(--color-muted)' }}>Height (inches, for BMI)</label>
          <Input type="number" value={goals.heightIn ?? ''} onChange={(e) => setGoals({ ...goals, heightIn: e.target.value === '' ? undefined : parseFloat(e.target.value) })} placeholder="e.g. 65" />
          {toGoal != null && (
            <p className="text-sm mt-4" style={{ color: 'var(--color-text)' }}>
              {toGoal === 0 ? '🎯 At your goal!' : toGoal > 0 ? `${toGoal} lb to go.` : `${Math.abs(toGoal)} lb under goal.`}
            </p>
          )}
        </Card>
      </div>

      {/* Add record */}
      <Card className="p-5 mt-6">
        <h2 className="font-bold text-lg mb-3" style={{ color: 'var(--color-text)' }}>Add a record</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={rKind} onChange={(e) => setRKind(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none" style={fieldStyle}>
            {RECORD_KINDS.map((k) => <option key={k}>{k}</option>)}
          </select>
          <input value={rTitle} onChange={(e) => setRTitle(e.target.value)} placeholder="Title (e.g. Annual physical)" className="rounded-xl px-3 py-2 text-sm outline-none flex-1 min-w-[160px]" style={fieldStyle} />
          <input value={rNotes} onChange={(e) => setRNotes(e.target.value)} placeholder="Notes / results" className="rounded-xl px-3 py-2 text-sm outline-none flex-1 min-w-[140px]" style={fieldStyle} />
          <label className="text-xs cursor-pointer px-3 py-2 rounded-xl" style={fieldStyle}>{rFile ? '✓ File' : '📎 Attach'}
            <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setRFile({ name: f.name, data: r.result as string }); r.readAsDataURL(f) }} />
          </label>
          <Button onClick={addRecord}><IconPlus width={16} height={16} /> Save</Button>
        </div>
      </Card>

      {/* Records */}
      <Card className="p-5 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>Records</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <IconSearch width={15} height={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted)' }} />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search records…" className="!pl-8 w-44" />
            </div>
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className="rounded-xl px-2 py-2 text-sm outline-none" style={fieldStyle}>
              {['All', ...RECORD_KINDS].map((k) => <option key={k}>{k}</option>)}
            </select>
          </div>
        </div>
        {filteredRecords.length === 0 ? (
          <EmptyState icon={<IconHealth width={40} height={40} />} title={records.length ? 'No matches' : 'No records yet'} hint={records.length ? 'Try a different search.' : 'Add doctor visits, labs and prescriptions above.'} />
        ) : (
          <ul className="flex flex-col gap-2">
            {filteredRecords.map((r) => (
              <li key={r.id} className="group flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--color-bg)' }}>
                <span className="text-xs font-semibold px-2 py-1 rounded-md shrink-0" style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}>{r.kind}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="font-semibold" style={{ color: 'var(--color-text)' }}>{r.title}</span><span className="text-xs" style={{ color: 'var(--color-muted)' }}>{r.date}</span></div>
                  {r.notes && <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>{r.notes}</p>}
                  {r.file && <a href={r.file.data} download={r.file.name} className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>📎 {r.file.name}</a>}
                </div>
                <button onClick={() => { const rec = r; removeWithUndo('Record deleted', () => setRecords((p) => p.filter((x) => x.id !== rec.id)), () => setRecords((p) => [rec, ...p])) }} className="opacity-0 group-hover:opacity-60" style={{ color: 'var(--color-muted)' }}><IconTrash width={16} height={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
