import { Navigate, Route, Routes } from 'react-router-dom'
import { Shell, Stat, StatusBadge } from '../../components/Shell.tsx'
import { useI18n } from '../../lib/i18n.tsx'
import { usd, pct } from '../../lib/money.ts'
import { payoffQuote } from '../../lib/amortization.ts'
import {
  buyers, currentSession, documents, getNoteState, lots, notesForBuyer,
  recordPayment, useStoreVersion,
} from '../../lib/store.ts'
import PortalLogin from './PortalLogin.tsx'

const TODAY = new Date().toISOString().slice(0, 10)

function fmtDate(iso: string, lang: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function Portal() {
  useStoreVersion()
  const session = currentSession()
  const buyer = buyers.find((b) => b.id === session)
  if (!buyer) return <PortalLogin />

  const myNotes = notesForBuyer(buyer.id)
  if (myNotes.length === 0) return <Navigate to="/" />
  const state = getNoteState(myNotes[0].id)
  const lot = lots.find((l) => l.id === state.note.lotId)!

  return (
    <Routes>
      <Route element={<PortalShell buyerName={buyer.name} lotLabel={`${lot.number} · ${lot.acres}`} />}>
        <Route index element={<Home state={state} lotAcres={lot.acres} buyerName={buyer.name} />} />
        <Route path="payments" element={<Payments state={state} />} />
        <Route path="documents" element={<Documents noteId={state.note.id} />} />
        <Route path="payoff" element={<Payoff state={state} />} />
      </Route>
    </Routes>
  )
}

import { Outlet } from 'react-router-dom'
import { type NoteState } from '../../lib/store.ts'

function PortalShell({ buyerName, lotLabel }: { buyerName: string; lotLabel: string }) {
  const { t } = useI18n()
  return (
    <Shell
      nav={[
        { to: '/portal', label: t('overview'), end: true },
        { to: '/portal/payments', label: t('payments') },
        { to: '/portal/documents', label: t('documents') },
        { to: '/portal/payoff', label: t('payoff') },
      ]}
      title={`${t('welcome')}, ${buyerName.split(' ')[0]}`}
      sub={`${t('yourLand')}: ${lotLabel} ${t('acres')}`}
    >
      <Outlet />
    </Shell>
  )
}

function Home({ state, lotAcres, buyerName }: { state: NoteState; lotAcres: number; buyerName: string }) {
  const { t, lang } = useI18n()
  const paidPrincipal = state.note.principalCents - state.balance
  const progress = pct(paidPrincipal, state.note.principalCents)

  return (
    <div className="grid" style={{ gap: '1.25rem' }}>
      <div className="grid cols-3">
        <Stat label={t('balance')} value={usd(state.balance)} hint={`${(state.note.aprBps / 100).toFixed(2)}% APR`} />
        <Stat
          label={t('nextPayment')}
          value={state.nextDue ? usd(state.monthlyTotal) : '—'}
          hint={state.nextDue ? `${t('dueOn')} ${fmtDate(state.nextDue.dueDate, lang)}` : ''}
        />
        <Stat label={t('paidToDate')} value={usd(state.settled.reduce((s, p) => s + p.amountCents, 0))} hint={`${state.periodsPaid} / ${state.note.termMonths}`} />
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <strong>{t('progress')}</strong>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{progress.toFixed(1)}% · {lotAcres} {t('acres')}</span>
        </div>
        <div className="progress"><div style={{ width: `${progress}%` }} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span className={`badge ${state.note.autopay ? 'good' : 'warn'}`}>
            {state.note.autopay ? t('autopayOn') : t('autopayOff')}
          </span>
          <StatusBadge status={state.status} />
          <button
            className="btn"
            onClick={() => recordPayment(state.note.id, state.monthlyTotal, 'ach')}
            title={`${buyerName} — demo`}
          >
            {t('payNow')} · {usd(state.monthlyTotal)}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>{t('recentActivity')}</h2>
        <ActivityTable rows={state.settled.slice(-5).reverse()} />
      </div>
    </div>
  )
}

function ActivityTable({ rows }: { rows: NoteState['settled'] }) {
  const { t, lang } = useI18n()
  if (rows.length === 0) return <div className="empty">—</div>
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr><th>{t('date')}</th><th className="num">{t('amount')}</th><th>{t('method')}</th><th>{t('status')}</th></tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{fmtDate(p.date, lang)}</td>
              <td className="num">{usd(p.amountCents)}</td>
              <td style={{ textTransform: 'uppercase', fontSize: '0.78rem', fontWeight: 600 }}>{p.method}</td>
              <td><StatusBadge status={p.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Payments({ state }: { state: NoteState }) {
  const { t, lang } = useI18n()
  return (
    <div className="grid" style={{ gap: '1.25rem' }}>
      <div className="card">
        <h2>{t('payments')}</h2>
        <ActivityTable rows={[...state.settled].reverse()} />
      </div>
      <div className="card">
        <h2>{t('schedule')}</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>#</th><th>{t('date')}</th>
                <th className="num">{t('payment')}</th>
                <th className="num">{t('interest')}</th>
                <th className="num">{t('principal')}</th>
                <th className="num">{t('balanceAfter')}</th>
              </tr>
            </thead>
            <tbody>
              {state.schedule.map((r) => (
                <tr key={r.period} style={r.period <= state.periodsPaid ? { color: 'var(--muted)' } : undefined}>
                  <td>{r.period}</td>
                  <td>{fmtDate(r.dueDate, lang)}</td>
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

function Documents({ noteId }: { noteId: string }) {
  const { t, lang } = useI18n()
  const docs = documents.filter((d) => d.noteId === noteId)
  return (
    <div className="card">
      <h2>{t('documents')}</h2>
      <div className="table-wrap">
        <table className="data">
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{d.name[lang]}</td>
                <td style={{ textAlign: 'right' }}><span className="badge neutral">PDF</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Payoff({ state }: { state: NoteState }) {
  const { t, lang } = useI18n()
  const quote = payoffQuote(state.balance, state.note.aprBps, state.paidThrough, TODAY)
  return (
    <div className="card" style={{ maxWidth: '30rem' }}>
      <h2>{t('payoff')}</h2>
      <div className="stat">
        <div className="label">{t('payoffAsOf')} {fmtDate(TODAY, lang)}</div>
        <div className="value" style={{ fontSize: '2rem' }}>{usd(quote)}</div>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: '0.75rem' }}>{t('payoffNote')}</p>
    </div>
  )
}
