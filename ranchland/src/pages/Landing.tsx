import { Link } from 'react-router-dom'
import { LangToggle, useI18n } from '../lib/i18n.tsx'
import { lots, ranches } from '../lib/store.ts'
import { monthlyPayment } from '../lib/amortization.ts'
import { usd } from '../lib/money.ts'

export default function Landing() {
  const { t } = useI18n()
  const ranch = ranches[0]

  return (
    <div>
      <header className="landing-hero">
        <div style={{ display: 'flex', justifyContent: 'flex-end', maxWidth: '62rem', margin: '0 auto' }}>
          <LangToggle />
        </div>
        <img src="/brand/stag.png" alt="" />
        <div className="tag">{t('tagline')}</div>
        <h1>RANCH LAND GROUP</h1>
        <p className="lead">{t('heroLead')}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a className="btn big" href="#lots">{t('viewLots')}</a>
          <Link className="btn big ghost" style={{ color: '#EFE9DF', borderColor: 'rgba(255,255,255,0.35)' }} to="/portal">
            {t('clientLogin')}
          </Link>
        </div>
      </header>

      <section className="landing-section" id="lots">
        <h2>{t('availableLots')} — {ranch.name}, {ranch.county}</h2>
        <div className="lot-grid">
          {lots.map((lot) => {
            const principal = lot.priceCents - lot.downCents
            const pay = monthlyPayment({ principal, aprBps: lot.aprBps, termMonths: lot.termMonths })
            const badge = lot.status === 'available' ? 'good' : lot.status === 'reserved' ? 'warn' : 'neutral'
            return (
              <div className="card lot-card" key={lot.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{lot.number}</strong>
                  <span className={`badge ${badge}`}>{t(lot.status)}</span>
                </div>
                <div className="acres">{lot.acres} {t('acres')}</div>
                <div className="price">{usd(lot.priceCents, { compact: true })}</div>
                <div className="terms">
                  {usd(lot.downCents, { compact: true })} {t('down')} · {usd(pay)}{t('perMonth')} · {(lot.aprBps / 100).toFixed(2)}% · {lot.termMonths / 12} yr
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="landing-section">
        <h2>{t('howItWorks')}</h2>
        <div className="grid cols-4">
          {([['how1t', 'how1b'], ['how2t', 'how2b'], ['how3t', 'how3b'], ['how4t', 'how4b']] as const).map(([tt, bb]) => (
            <div className="card" key={tt}>
              <h3>{t(tt)}</h3>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>{t(bb)}</p>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--line)', padding: '1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
        Ranch Land Group · {ranch.county} · <Link to="/portal">{t('clientLogin')}</Link> · <Link to="/admin">{t('adminLogin')}</Link>
      </footer>
    </div>
  )
}
