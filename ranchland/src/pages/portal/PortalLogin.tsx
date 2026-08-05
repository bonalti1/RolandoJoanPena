import { useNavigate } from 'react-router-dom'
import { LangToggle, useI18n } from '../../lib/i18n.tsx'
import { buyers, signIn } from '../../lib/store.ts'

// Demo sign-in: pick a sample buyer. Live version swaps this for Supabase
// magic-link / SMS OTP auth — the session shape stays the same.
export default function PortalLogin() {
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
      <div className="card" style={{ maxWidth: '26rem', width: '100%', textAlign: 'center', padding: '2rem' }}>
        <img src="/brand/stag.png" alt="" width={56} />
        <h1 style={{ margin: '0.75rem 0 0.25rem' }}>{t('loginTitle')}</h1>
        <p style={{ color: 'var(--muted)' }}>{t('loginLead')}</p>
        <div style={{ display: 'grid', gap: '0.5rem', margin: '1.25rem 0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t('loginAs')}
          </div>
          {buyers.map((b) => (
            <button key={b.id} className="btn ghost" onClick={() => { signIn(b.id); navigate('/portal') }}>
              {b.name}
            </button>
          ))}
        </div>
        <LangToggle />
      </div>
    </div>
  )
}
