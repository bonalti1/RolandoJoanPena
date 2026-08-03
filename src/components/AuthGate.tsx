import { useEffect, useState, type ReactNode } from 'react'
import { supabase, cloudConfigured } from '../lib/supabase'
import { startCloudSync } from '../lib/cloud'
import { Logo } from './Logo'

/**
 * Wraps the whole app. With no Supabase configured it's a pass-through (the app
 * stays local-only). With Supabase configured it requires a magic-link sign-in,
 * then boots cloud sync before revealing the dashboard so every device converges
 * to the same data.
 *
 * The sign-in screen commits to a dark, premium look regardless of the app
 * theme — the white RJP monogram needs a dark canvas to shine.
 */

// Fixed dark palette for the auth screen (independent of the app theme).
const C = {
  text: '#f4f7fb',
  muted: '#93a1b5',
  accent: '#3b82f6',
  accent2: '#2563eb',
  panel: 'rgba(255,255,255,0.045)',
  panelBorder: 'rgba(255,255,255,0.10)',
  field: 'rgba(10,15,26,0.55)',
  fieldBorder: 'rgba(255,255,255,0.14)',
}

function IconMail({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3 6 9 6 9-6" />
    </svg>
  )
}

function Spinner() {
  return (
    <span
      className="inline-block rounded-full animate-spin"
      style={{ width: 22, height: 22, border: `2.5px solid ${C.panelBorder}`, borderTopColor: C.accent }}
    />
  )
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'signed-out' | 'syncing' | 'ready'>('loading')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!cloudConfigured || !supabase) { setStatus('ready'); return }
    let done = false

    const boot = async (uid: string) => {
      setStatus('syncing')
      try { await startCloudSync(uid) } catch { /* offline — local copy still shows */ }
      if (!done) setStatus('ready')
    }

    supabase.auth.getSession().then(({ data }) => {
      if (done) return
      if (data.session) boot(data.session.user.id)
      else setStatus('signed-out')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) boot(session.user.id)
      else setStatus('signed-out')
    })
    return () => { done = true; sub.subscription.unsubscribe() }
  }, [])

  if (status === 'ready') return <>{children}</>

  const sendLink = async () => {
    setError('')
    const addr = email.trim()
    if (!addr) { setError('Enter your email.'); return }
    setBusy(true)
    const { error } = await supabase!.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  const busyState = status === 'loading' || status === 'syncing'

  return (
    <div
      className="h-full w-full grid place-items-center px-6 relative overflow-hidden"
      style={{ background: 'radial-gradient(120% 90% at 50% -10%, #16233d 0%, #0b1220 45%, #070b13 100%)', color: C.text }}
    >
      {/* Soft glow behind the mark */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{ top: '18%', left: '50%', width: 520, height: 520, transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0) 68%)', filter: 'blur(6px)' }}
      />
      {/* Fine grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '46px 46px' }}
      />

      <div className="relative w-full max-w-[400px] fade-up">
        {/* Brand */}
        <div className="flex flex-col items-center mb-7">
          <Logo height={78} />
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.32em]" style={{ color: C.muted }}>
            Personal Operating System
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-[26px] px-7 py-8 backdrop-blur-xl"
          style={{ background: C.panel, border: `1px solid ${C.panelBorder}`, boxShadow: '0 30px 80px -30px rgba(0,0,0,0.8)' }}
        >
          {busyState ? (
            <div className="flex flex-col items-center py-6 gap-4">
              <Spinner />
              <p className="text-sm" style={{ color: C.muted }}>
                {status === 'syncing' ? 'Syncing your data…' : 'Loading…'}
              </p>
            </div>
          ) : sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 grid place-items-center rounded-full" style={{ width: 52, height: 52, background: 'rgba(59,130,246,0.14)', color: C.accent, border: `1px solid rgba(59,130,246,0.3)` }}>
                <IconMail size={22} />
              </div>
              <h1 className="text-xl font-semibold mb-1.5">Check your email</h1>
              <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
                We sent a one-tap sign-in link to<br />
                <b style={{ color: C.text }}>{email}</b>
              </p>
              <button onClick={() => setSent(false)} className="text-sm font-semibold mt-5 transition hover:opacity-80" style={{ color: C.accent }}>
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-center">Welcome back</h1>
              <p className="text-sm text-center mt-1.5 mb-6" style={{ color: C.muted }}>
                Sign in to your private dashboard
              </p>

              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendLink() }}
                placeholder="you@email.com"
                autoFocus
                className="w-full rounded-xl px-3.5 py-3 text-sm outline-none mt-1.5 mb-4 transition"
                style={{ background: C.field, border: `1px solid ${C.fieldBorder}`, color: C.text }}
                onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={(e) => (e.currentTarget.style.borderColor = C.fieldBorder)}
              />

              {error && <p className="text-sm mb-3 -mt-1" style={{ color: '#f0787a' }}>{error}</p>}

              <button
                onClick={sendLink}
                disabled={busy}
                className="w-full rounded-xl px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-60"
                style={{ background: `linear-gradient(180deg, ${C.accent} 0%, ${C.accent2} 100%)`, color: '#fff', boxShadow: '0 10px 26px -10px rgba(37,99,235,0.7)' }}
              >
                {busy ? <Spinner /> : <><IconMail size={16} /> Email me a sign-in link</>}
              </button>

              <p className="text-[11px] text-center mt-5 leading-relaxed" style={{ color: C.muted, opacity: 0.8 }}>
                No password needed. We'll email you a secure link that signs you in with one tap.
              </p>
            </>
          )}
        </div>

        <p className="text-center text-[11px] mt-6" style={{ color: C.muted, opacity: 0.65 }}>
          🔒 Private &amp; encrypted · Your data, yours only
        </p>
      </div>
    </div>
  )
}
