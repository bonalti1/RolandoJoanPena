import { useEffect, useState, type ReactNode } from 'react'
import { supabase, cloudConfigured } from '../lib/supabase'
import { startCloudSync } from '../lib/cloud'
import { Logo } from './Logo'

/**
 * Wraps the whole app. With no Supabase configured it's a pass-through (the app
 * stays local-only). With Supabase configured it requires a magic-link sign-in,
 * then boots cloud sync before revealing the dashboard so every device converges
 * to the same data.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'signed-out' | 'syncing' | 'ready'>('loading')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

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
    const { error } = await supabase!.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="h-full grid place-items-center px-6" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-5"><Logo height={72} /></div>

        {status === 'loading' || status === 'syncing' ? (
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            {status === 'syncing' ? 'Syncing your data…' : 'Loading…'}
          </p>
        ) : sent ? (
          <>
            <h1 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>Check your email</h1>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              We sent a sign-in link to <b style={{ color: 'var(--color-text)' }}>{email}</b>. Open it on this device to continue.
            </p>
            <button onClick={() => setSent(false)} className="text-sm font-semibold mt-4" style={{ color: 'var(--color-accent)' }}>Use a different email</button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--color-text)' }}>Sign in</h1>
            <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>Enter your email and we'll send you a one-tap sign-in link.</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendLink() }}
              placeholder="you@email.com"
              autoFocus
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mb-3"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
            {error && <p className="text-sm mb-3" style={{ color: '#c0504d' }}>{error}</p>}
            <button onClick={sendLink} className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}>
              Email me a sign-in link
            </button>
          </>
        )}
      </div>
    </div>
  )
}
