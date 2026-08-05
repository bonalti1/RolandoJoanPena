import { Outlet, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { Shell, Stat, StatusBadge } from '../../components/Shell.tsx'
import { usd } from '../../lib/money.ts'
import {
  buyers, currentSession, getNoteState, lots, notes, ranches, recordPayment,
  resetDemo, signIn, useStoreVersion,
} from '../../lib/store.ts'

// Admin is Rolando's operating dashboard: portfolio health at a glance,
// then drill into any note's ledger. English-only by design (internal tool).

export default function Admin() {
  useStoreVersion()
  const session = currentSession()
  if (session !== 'admin') return <AdminLogin />
  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route index element={<Overview />} />
        <Route path="ranches" element={<Ranches />} />
        <Route path="notes" element={<NotesList />} />
        <Route path="notes/:id" element={<NoteDetail />} />
        <Route path="delinquency" element={<Delinquency />} />
      </Route>
    </Routes>
  )
}

function AdminLogin() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
      <div className="card" style={{ maxWidth: '24rem', width: '100%', textAlign: 'center', padding: '2rem' }}>
        <img src="/brand/stag.png" alt="" width={56} />
        <h1 style={{ margin: '0.75rem 0 1.25rem' }}>Ranch Land Admin</h1>
        <button className="btn big" onClick={() => { signIn('admin'); navigate('/admin') }}>
          Enter (demo)
        </button>
      </div>
    </div>
  )
}

function AdminShell() {
  return (
    <Shell
      nav={[
        { to: '/admin', label: 'Overview', end: true },
        { to: '/admin/ranches', label: 'Ranches & lots' },
        { to: '/admin/notes', label: 'Notes' },
        { to: '/admin/delinquency', label: 'Delinquency' },
      ]}
      title="Portfolio"
      sub="Ranch Land Group — servicing dashboard"
      actions={<button className="btn ghost" onClick={resetDemo}>Reset demo data</button>}
    >
      <Outlet />
    </Shell>
  )
}

function Overview() {
  const states = notes.map((n) => getNoteState(n.id))
  const active = states.filter((s) => s.status !== 'paid_off')
  const late = states.filter((s) => s.status === 'late')
  const portfolioBalance = states.reduce((s, x) => s + x.balance, 0)
  const monthlyRoll = active.reduce((s, x) => s + x.monthlyTotal, 0)
  const collected = states.flatMap((s) => s.settled).reduce((s, p) => s + p.amountCents, 0)
  const recent = states.flatMap((s) => s.settled.map((p) => ({ p, s }))).sort((a, b) => b.p.date.localeCompare(a.p.date)).slice(0, 8)

  return (
    <div className="grid" style={{ gap: '1.25rem' }}>
      <div className="grid cols-4">
        <Stat label="Active notes" value={String(active.length)} hint={`${late.length} late`} />
        <Stat label="Portfolio balance" value={usd(portfolioBalance, { compact: true })} />
        <Stat label="Expected monthly" value={usd(monthlyRoll, { compact: true })} hint="P&I + escrow" />
        <Stat label="Collected all-time" value={usd(collected, { compact: true })} />
      </div>
      <div className="card">
        <h2>Recent payments</h2>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Date</th><th>Buyer</th><th>Note</th><th className="num">Amount</th><th>Method</th></tr></thead>
            <tbody>
              {recent.map(({ p, s }) => (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td>{buyers.find((b) => b.id === s.note.buyerId)?.name}</td>
                  <td>{s.note.id.toUpperCase()}</td>
                  <td className="num">{usd(p.amountCents)}</td>
                  <td style={{ textTransform: 'uppercase', fontSize: '0.78rem', fontWeight: 600 }}>{p.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Ranches() {
  return (
    <div className="grid" style={{ gap: '1.25rem' }}>
      {ranches.map((r) => {
        const rl = lots.filter((l) => l.ranchId === r.id)
        const soldPct = Math.round((rl.filter((l) => l.status === 'sold').length / rl.length) * 100)
        return (
          <div key={r.id}>
            <div className="page-head" style={{ marginBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>{r.name}</h2>
                <p className="sub">{r.county} · {r.acres} acres · {soldPct}% sold</p>
              </div>
            </div>
            <div className="lot-grid">
              {rl.map((lot) => {
                const badge = lot.status === 'available' ? 'good' : lot.status === 'reserved' ? 'warn' : 'neutral'
                return (
                  <div className="card lot-card" key={lot.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{lot.number}</strong>
                      <span className={`badge ${badge}`}>{lot.status}</span>
                    </div>
                    <div className="acres">{lot.acres} acres</div>
                    <div className="price">{usd(lot.priceCents, { compact: true })}</div>
                    <div className="terms">{usd(lot.downCents, { compact: true })} down · {(lot.aprBps / 100).toFixed(2)}% · {lot.termMonths} mo</div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function NotesList() {
  const navigate = useNavigate()
  const states = notes.map((n) => getNoteState(n.id))
  return (
    <div className="card">
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Note</th><th>Buyer</th><th>Lot</th>
              <th className="num">Balance</th><th className="num">Monthly</th>
              <th>Paid</th><th>Autopay</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {states.map((s) => {
              const buyer = buyers.find((b) => b.id === s.note.buyerId)!
              const lot = lots.find((l) => l.id === s.note.lotId)!
              return (
                <tr key={s.note.id} className="clickable" onClick={() => navigate(`/admin/notes/${s.note.id}`)}>
                  <td><strong>{s.note.id.toUpperCase()}</strong></td>
                  <td>{buyer.name}</td>
                  <td>{lot.number} · {lot.acres} ac</td>
                  <td className="num">{usd(s.balance)}</td>
                  <td className="num">{usd(s.monthlyTotal)}</td>
                  <td>{s.periodsPaid}/{s.note.termMonths}</td>
                  <td>{s.note.autopay ? <span className="badge good">ACH</span> : <span className="badge warn">Manual</span>}</td>
                  <td><StatusBadge status={s.status} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NoteDetail() {
  const { id } = useParams()
  const note = notes.find((n) => n.id === id)
  if (!note) return <div className="empty">Note not found.</div>
  const s = getNoteState(note.id)
  const buyer = buyers.find((b) => b.id === note.buyerId)!
  const lot = lots.find((l) => l.id === note.lotId)!

  return (
    <div className="grid" style={{ gap: '1.25rem' }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h2 style={{ margin: 0 }}>{note.id.toUpperCase()} — {buyer.name}</h2>
          <p className="sub">{lot.number}, {lot.acres} acres · {buyer.phone} · {buyer.email} · prefers {buyer.lang === 'es' ? 'Español' : 'English'}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <StatusBadge status={s.status} />
          <button className="btn" onClick={() => recordPayment(note.id, s.monthlyTotal, 'check')}>
            Record payment · {usd(s.monthlyTotal)}
          </button>
        </div>
      </div>

      <div className="grid cols-4">
        <Stat label="Balance" value={usd(s.balance)} />
        <Stat label="Monthly (P&I + escrow)" value={usd(s.monthlyTotal)} />
        <Stat label="Paid through" value={s.paidThrough} hint={`${s.periodsPaid} of ${note.termMonths}`} />
        <Stat label="Days late" value={String(s.daysLate)} hint={s.nextDue ? `next due ${s.nextDue.dueDate}` : 'paid off'} />
      </div>

      <div className="card">
        <h2>Ledger — settled payments</h2>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Date</th><th className="num">Amount</th><th>Method</th><th>Status</th></tr></thead>
            <tbody>
              {[...s.settled].reverse().map((p) => (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td className="num">{usd(p.amountCents)}</td>
                  <td style={{ textTransform: 'uppercase', fontSize: '0.78rem', fontWeight: 600 }}>{p.method}</td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Amortization schedule</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>#</th><th>Due</th><th className="num">Payment</th><th className="num">Interest</th><th className="num">Principal</th><th className="num">Balance</th></tr>
            </thead>
            <tbody>
              {s.schedule.map((r) => (
                <tr key={r.period} style={r.period <= s.periodsPaid ? { color: 'var(--muted)' } : undefined}>
                  <td>{r.period}</td><td>{r.dueDate}</td>
                  <td className="num">{usd(r.payment)}</td>
                  <td className="num">{usd(r.interest)}</td>
                  <td className="num">{usd(r.principal)}</td>
                  <td className="num">{usd(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Delinquency() {
  const navigate = useNavigate()
  const states = notes.map((n) => getNoteState(n.id)).filter((s) => s.daysLate > 0)
  const buckets: [string, (d: number) => boolean][] = [
    ['1–10 days', (d) => d <= 10],
    ['11–30 days', (d) => d > 10 && d <= 30],
    ['31–60 days', (d) => d > 30 && d <= 60],
    ['60+ days', (d) => d > 60],
  ]
  return (
    <div className="grid" style={{ gap: '1.25rem' }}>
      <div className="grid cols-4">
        {buckets.map(([label, fn]) => {
          const inBucket = states.filter((s) => fn(s.daysLate))
          return <Stat key={label} label={label} value={String(inBucket.length)} hint={usd(inBucket.reduce((s, x) => s + x.monthlyTotal, 0)) + ' due'} />
        })}
      </div>
      {states.length === 0 ? (
        <div className="card empty">No late notes. Every payment is current.</div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Note</th><th>Buyer</th><th>Phone</th><th className="num">Days late</th><th className="num">Amount due</th><th>Language</th></tr></thead>
              <tbody>
                {states.sort((a, b) => b.daysLate - a.daysLate).map((s) => {
                  const buyer = buyers.find((b) => b.id === s.note.buyerId)!
                  return (
                    <tr key={s.note.id} className="clickable" onClick={() => navigate(`/admin/notes/${s.note.id}`)}>
                      <td><strong>{s.note.id.toUpperCase()}</strong></td>
                      <td>{buyer.name}</td>
                      <td>{buyer.phone}</td>
                      <td className="num">{s.daysLate}</td>
                      <td className="num">{usd(s.monthlyTotal)}</td>
                      <td>{buyer.lang === 'es' ? 'Español' : 'English'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
