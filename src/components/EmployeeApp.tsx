import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Card } from './ui'
import { IconCheck, IconHome, IconJournal, IconPayments, IconPlus, IconTasks, IconTrash } from './icons'
import { InvoiceView, STATUS_COLOR, STATUS_LABEL } from './EmpInvoice'
import { todayISO, formatDueLabel } from '../lib/dates'
import {
  empApi, empErrorText, empToken, fmtWorked, geoLabel, getGeoStamp, isSessionExpired, localDayISO,
  hoursLabel, invoiceNo, mapsLink, money, timeLabel, weekLabel, workedMinutes,
  type EmpApp, type EmpInvoice, type EmpMe, type EmpTask, type PayWeek, type Payroll,
} from '../lib/employee'

/**
 * Employee OS — the whole app as a field employee sees it, at /employee.
 *
 * Deliberately outside AuthGate: there is no email account. The employee types
 * his PIN once, the phone keeps the session token, and he lands here on every
 * open. What he can reach is decided by the emp_* database functions, not by
 * this screen (see src/lib/employee.ts).
 */

export default function EmployeeApp() {
  const [token, setToken] = useState<string | null>(() => empToken.get())
  if (!token) return <PinGate onIn={(t) => { empToken.set(t); setToken(t) }} />
  return <EmployeeOS token={token} onOut={() => { empToken.clear(); setToken(null) }} />
}

// ── PIN screen ──────────────────────────────────────────────────────────────

function PinGate({ onIn }: { onIn: (token: string) => void }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!pin.trim() || busy) return
    setBusy(true); setError('')
    try {
      const r = await empApi.login(pin)
      onIn(r.token)
    } catch (e) {
      setError(empErrorText(e)); setPin('')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-full grid place-items-center px-5 py-10" style={{ background: 'radial-gradient(120% 80% at 50% 0%, #16294d 0%, #0b1220 70%)' }}>
      <div className="w-full max-w-[360px]">
        <div className="flex flex-col items-center text-center mb-7">
          <div className="rounded-2xl p-2.5" style={{ background: '#fff' }}>
            <img src="/logos/stb.png" alt="South Texas Builders" style={{ height: 52, width: 'auto' }} />
          </div>
          <h1 className="mt-5 text-[22px] font-semibold" style={{ color: '#f4f7fb' }}>Employee OS</h1>
          <p className="text-sm mt-1" style={{ color: '#93a1b5' }}>Enter your employee code</p>
        </div>
        <div className="rounded-[22px] p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <input
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            type="password"
            autoCapitalize="none" autoCorrect="off" autoComplete="off"
            placeholder="Code"
            className="w-full rounded-xl px-4 py-3.5 text-lg text-center tracking-[0.2em] outline-none"
            style={{ background: 'rgba(10,15,26,0.55)', border: '1px solid rgba(255,255,255,0.14)', color: '#f4f7fb' }}
          />
          <button
            onClick={submit}
            disabled={busy || !pin.trim()}
            className="w-full mt-3 rounded-xl px-4 py-3.5 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-50"
            style={{ background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)', color: '#fff' }}
          >
            {busy ? 'Checking…' : 'Enter'}
          </button>
          {error && <p className="text-sm text-center mt-3 font-medium" style={{ color: '#fca5a5' }}>{error}</p>}
        </div>
      </div>
    </div>
  )
}

// ── The OS ──────────────────────────────────────────────────────────────────

type Tab = 'today' | 'tasks' | 'payroll' | 'journal'

/**
 * The OS itself. `viewedBy` is set when Rolando opens it from Team: same
 * screens, same data, but a banner makes clear that whatever he taps counts
 * as the employee, and "Sign out" becomes "Close".
 */
export function EmployeeOS({ token, onOut, viewedBy }: { token: string; onOut: () => void; viewedBy?: string }) {
  const [day, setDay] = useState(todayISO())
  const [me, setMe] = useState<EmpMe | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('today')
  const [openApp, setOpenApp] = useState<EmpApp | null>(null)

  // Apps (the scheduling board) open INSIDE the OS, full screen, instead of in
  // a new tab: going back is one tap — or the phone's own back gesture, which
  // the history entry below turns into "close the app" — and he never lands
  // on the board's password screen wondering which app he is in.
  const showApp = (a: EmpApp) => { window.history.pushState({ empApp: true }, ''); setOpenApp(a) }
  const hideApp = () => { if (window.history.state?.empApp) window.history.back(); else setOpenApp(null) }
  useEffect(() => {
    const onPop = () => setOpenApp(null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const load = useCallback(async () => {
    const d = todayISO()
    setDay(d)
    try { setMe(await empApi.me(token, d)); setError('') }
    catch (e) { if (isSessionExpired(e)) onOut(); else setError(empErrorText(e)) }
  }, [token, onOut])

  useEffect(() => { void load() }, [load])
  // Coming back to the app (unlocking the phone, switching back) refreshes
  // the day, so a new morning never shows yesterday's checklist.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  /** Runs a write; a dead session sends him back to the PIN screen. */
  const run = useCallback(async (fn: () => Promise<unknown>, reload = true) => {
    try { await fn(); if (reload) await load() }
    catch (e) { if (isSessionExpired(e)) onOut(); else setError(empErrorText(e)) }
  }, [load, onOut])

  const signOut = async () => { try { await empApi.logout(token) } catch { /* offline: still sign out here */ } onOut() }

  if (!me) {
    return (
      <div className="h-full grid place-items-center px-6 text-center" style={{ background: 'var(--color-bg)', color: 'var(--color-muted)' }}>
        <div>
          <p className="text-sm">{error || 'Loading…'}</p>
          {error && <button className="mt-3 text-sm font-semibold" style={{ color: 'var(--color-accent)' }} onClick={() => void load()}>Try again</button>}
        </div>
      </div>
    )
  }

  const first = me.employee.name.split(' ')[0]
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-bg)' }}>
      {viewedBy && (
        <div className="px-4 py-2 text-xs font-semibold text-center" style={{ background: '#fef3c7', color: '#92400e' }}>
          {viewedBy} viewing {first}'s OS. Anything you tap counts as {first}.
        </div>
      )}
      <header className="sticky top-0 z-30 glass flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <img src="/logos/stb.png" alt="" style={{ height: 22, width: 'auto' }} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--color-muted)' }}>{first}'s OS</span>
        <button onClick={signOut} className="ml-auto text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>{viewedBy ? 'Close' : 'Sign out'}</button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 pt-5 pb-28">
          {error && (
            <div className="mb-4 rounded-xl px-3.5 py-2.5 text-sm" style={{ background: '#fef2f2', color: '#b91c1c' }}>{error}</div>
          )}
          {tab === 'today' && (
            <>
              <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>{greet}, {first}</h1>
              <p className="text-sm mt-0.5 mb-5" style={{ color: 'var(--color-muted)' }}>
                {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <ClockCard me={me} day={day} token={token} run={run} />
              <AppsCard me={me} onOpen={showApp} />
              <NonNegotiables me={me} day={day} token={token} run={run} />
              <TasksCard me={me} token={token} run={run} todayOnly day={day} onSeeAll={() => setTab('tasks')} />
            </>
          )}
          {tab === 'tasks' && <TasksCard me={me} token={token} run={run} day={day} />}
          {tab === 'payroll' && <PayrollTab me={me} token={token} run={run} />}
          {tab === 'journal' && <JournalCard me={me} day={day} token={token} run={run} />}
        </div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 glass" style={{ borderTop: '1px solid var(--color-border)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex max-w-xl mx-auto">
          {([
            ['today', 'Today', IconHome],
            ['tasks', 'Tasks', IconTasks],
            ['payroll', 'Payroll', IconPayments],
            ['journal', 'Journal', IconJournal],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 min-h-[56px]"
              style={{ color: tab === id ? 'var(--color-accent)' : 'var(--color-muted)' }}>
              <Icon width={22} height={22} />
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {openApp && <AppView app={openApp} owner={first} onBack={hideApp} />}
    </div>
  )
}

type Run = (fn: () => Promise<unknown>, reload?: boolean) => Promise<void>

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>{title}</h2>
        {right}
      </div>
      {children}
    </Card>
  )
}

// ── Clock in / out with a GPS stamp ─────────────────────────────────────────

function ClockCard({ me, day, token, run }: { me: EmpMe; day: string; token: string; run: Run }) {
  const [busy, setBusy] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t) }, [])

  const [undoing, setUndoing] = useState(false)
  const [reason, setReason] = useState('')
  const today = me.clock.filter((c) => localDayISO(c.at) === day)
  const live = today.filter((c) => !c.voided_at)
  const last = live[live.length - 1]
  const clockedIn = last?.kind === 'in'
  const worked = workedMinutes(me.clock, day)

  // Undo takes back only the last punch of today, and only with a reason.
  // Nothing is erased: the punch stays, crossed out, and Rolando sees why.
  const undo = async () => {
    if (!last || reason.trim().length < 3) return
    await run(() => empApi.undo(token, last.id, reason.trim()))
    setUndoing(false); setReason('')
  }

  const punch = async () => {
    setBusy(true)
    const geo = await getGeoStamp()
    await run(() => empApi.punch(token, clockedIn ? 'out' : 'in', geo))
    setBusy(false)
  }

  return (
    <Section title="Time clock" right={today.length > 0 ? <span className="text-sm font-semibold tnum" style={{ color: 'var(--color-text)' }}>{fmtWorked(worked)}</span> : undefined}>
      <button
        onClick={punch}
        disabled={busy}
        className="w-full rounded-2xl py-4 text-[17px] font-semibold transition active:scale-[0.98] disabled:opacity-60"
        style={{ background: clockedIn ? '#dc2626' : '#16a34a', color: '#fff' }}
      >
        {busy ? 'Getting location…' : clockedIn ? 'Clock out' : 'Clock in'}
      </button>
      <p className="text-xs mt-2 text-center" style={{ color: 'var(--color-muted)' }}>
        📍 Your location is saved only at the moment you tap this button.
      </p>
      {today.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {today.map((c) => c.voided_at ? (
            <li key={c.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-muted)' }}>
              <span className="font-semibold w-14 line-through">{c.kind === 'in' ? 'In' : 'Out'}</span>
              <span className="tnum line-through">{timeLabel(c.at)}</span>
              <span className="ml-auto text-xs truncate">Undone: {c.void_reason}</span>
            </li>
          ) : (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <span className="font-semibold w-14" style={{ color: c.kind === 'in' ? '#16a34a' : '#dc2626' }}>{c.kind === 'in' ? 'In' : 'Out'}</span>
              <span className="tnum" style={{ color: 'var(--color-text)' }}>{timeLabel(c.at)}</span>
              {c.id === last?.id && !undoing && (
                <button onClick={() => setUndoing(true)} className="text-xs font-semibold" style={{ color: '#b45309' }}>Undo</button>
              )}
              {c.lat != null && c.lng != null
                ? <a href={mapsLink(c.lat, c.lng)} target="_blank" rel="noopener" className="ml-auto text-xs font-medium" style={{ color: 'var(--color-accent)' }}>{geoLabel(c)}</a>
                : <span className="ml-auto text-xs" style={{ color: 'var(--color-muted)' }}>{geoLabel(c)}</span>}
            </li>
          ))}
        </ul>
      )}
      {undoing && last && (
        <div className="mt-3 rounded-xl p-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
          <p className="text-sm font-semibold" style={{ color: '#92400e' }}>Undo "{last.kind === 'in' ? 'In' : 'Out'} {timeLabel(last.at)}"?</p>
          <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? (e.g. pressed twice)"
            onKeyDown={(e) => { if (e.key === 'Enter') void undo() }}
            className="w-full mt-2 rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: '#fff', border: '1px solid #fde68a', color: '#141a24' }} />
          <div className="flex gap-2 mt-2">
            <button onClick={() => void undo()} disabled={reason.trim().length < 3}
              className="flex-1 rounded-lg py-2 text-sm font-semibold disabled:opacity-50" style={{ background: '#b45309', color: '#fff' }}>Undo punch</button>
            <button onClick={() => { setUndoing(false); setReason('') }}
              className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ color: '#92400e' }}>Cancel</button>
          </div>
          <p className="text-[11px] mt-2" style={{ color: '#92400e' }}>Rolando sees every undo and its reason.</p>
        </div>
      )}
    </Section>
  )
}

// ── Payroll: his weeks, what he earned, his invoices ────────────────────────

const statusChip = (label: string, color: string) => (
  <span className="text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
    style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{label}</span>
)

function weekStatus(w: PayWeek) {
  if (w.invoice) return statusChip(`Invoice ${STATUS_LABEL[w.invoice.status]}`, STATUS_COLOR[w.invoice.status])
  if (!w.ended) return statusChip('This week', '#697488')
  if (w.minutes === 0) return statusChip('No hours', '#697488')
  if (w.open_days.length) return statusChip('Missing clock-out', '#dc2626')
  return statusChip('Ready to invoice', '#16a34a')
}

function PayrollTab({ me, token, run }: { me: EmpMe; token: string; run: Run }) {
  const [pay, setPay] = useState<Payroll | null>(null)
  const [err, setErr] = useState('')
  const [week, setWeek] = useState<PayWeek | null>(null)
  const [inv, setInv] = useState<EmpInvoice | null>(null)

  const load = useCallback(async () => {
    try { setPay(await empApi.payroll(token, 8)); setErr('') } catch (e) { setErr(empErrorText(e)) }
  }, [token])
  useEffect(() => { void load() }, [load])

  const createInvoice = async (w: PayWeek) => {
    if (!confirm(`Send the invoice for ${weekLabel(w.week_start, w.week_end)} (${money(w.amount)}) to Rolando? That week's hours lock once it's sent.`)) return
    let made: EmpInvoice | null = null
    await run(async () => { made = await empApi.invoiceCreate(token, w.week_start) }, false)
    await load()
    setWeek(null)
    if (made) setInv(made)
  }

  if (!pay) return <Section title="Payroll"><p className="text-sm" style={{ color: 'var(--color-muted)' }}>{err || 'Loading…'}</p></Section>
  const current = pay.weeks[0]
  const openInvoice = (id: string) => { const f = pay.invoices.find((i) => i.id === id); if (f) setInv(f) }

  return (
    <>
      <Section title="This week" right={<span className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>{pay.rate != null ? `${money(pay.rate)}/hour` : 'Rate not set'}</span>}>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-semibold tnum" style={{ color: 'var(--color-text)' }}>{money(current.amount)}</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>{hoursLabel(current.minutes)} · {weekLabel(current.week_start, current.week_end)}</p>
          </div>
          <button onClick={() => setWeek(current)} className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>Days ›</button>
        </div>
      </Section>

      <Section title="Weeks">
        <ul>
          {pay.weeks.map((w, i) => (
            <li key={w.week_start} style={i ? { borderTop: '1px solid var(--color-border)' } : undefined}>
              <button onClick={() => (w.invoice ? openInvoice(w.invoice.id) : setWeek(w))} className="w-full flex items-center gap-3 py-3 text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium" style={{ color: 'var(--color-text)' }}>{weekLabel(w.week_start, w.week_end)}</p>
                  <div className="mt-1">{weekStatus(w)}</div>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-semibold tnum" style={{ color: 'var(--color-text)' }}>{money(w.invoice ? w.invoice.total : w.amount)}</p>
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{hoursLabel(w.invoice ? w.invoice.minutes : w.minutes)}</p>
                </div>
                <span style={{ color: 'var(--color-muted)' }}>›</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {pay.invoices.length > 0 && (
        <Section title={`Invoices (${pay.invoices.length})`}>
          <ul>
            {pay.invoices.map((v, i) => (
              <li key={v.id} style={i ? { borderTop: '1px solid var(--color-border)' } : undefined}>
                <button onClick={() => setInv(v)} className="w-full flex items-center gap-3 py-3 text-left">
                  <div className="flex-1">
                    <p className="text-[15px] font-medium" style={{ color: 'var(--color-text)' }}>No. {invoiceNo(v.from_name, v.number)}</p>
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{weekLabel(v.week_start, v.week_end)}</p>
                  </div>
                  {statusChip(STATUS_LABEL[v.status], STATUS_COLOR[v.status])}
                  <span className="text-[15px] font-semibold tnum" style={{ color: 'var(--color-text)' }}>{money(v.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {week && <WeekSheet w={week} first={me.employee.name.split(' ')[0]} onClose={() => setWeek(null)} onInvoice={() => void createInvoice(week)} />}
      {inv && <InvoiceView inv={inv} onClose={() => setInv(null)} />}
    </>
  )
}

function WeekSheet({ w, onClose, onInvoice }: { w: PayWeek; first: string; onClose: () => void; onInvoice: () => void }) {
  const canInvoice = w.ended && !w.invoice && w.minutes > 0 && !w.open_days.length && !w.missing_rate
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div className="w-full max-w-xl rounded-t-3xl sm:rounded-3xl p-5 max-h-[85%] overflow-y-auto" style={{ background: 'var(--color-surface)', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{weekLabel(w.week_start, w.week_end)}</p>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{hoursLabel(w.minutes)} · {money(w.amount)}</p>
          </div>
          <button onClick={onClose} className="text-sm font-semibold" style={{ color: 'var(--color-muted)' }}>Close</button>
        </div>
        <ul className="mt-4">
          {w.days.map((d, i) => (
            <li key={d.day} className="flex items-start gap-3 py-2.5" style={i ? { borderTop: '1px solid var(--color-border)' } : undefined}>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: d.minutes ? 'var(--color-text)' : 'var(--color-muted)' }}>
                  {new Date(d.day + 'T12:00').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
                {d.shifts.map((s) => <p key={s.in} className="text-xs" style={{ color: 'var(--color-muted)' }}>{timeLabel(s.in)} – {timeLabel(s.out)}</p>)}
                {w.open_days.includes(d.day) && <p className="text-xs font-semibold" style={{ color: '#dc2626' }}>Clocked in, never clocked out</p>}
              </div>
              <div className="text-right text-sm tnum">
                <p style={{ color: 'var(--color-text)' }}>{d.minutes ? hoursLabel(d.minutes) : '—'}</p>
                {d.minutes > 0 && <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{money(d.amount)}</p>}
              </div>
            </li>
          ))}
        </ul>
        {canInvoice && (
          <button onClick={onInvoice} className="w-full mt-4 rounded-2xl py-3.5 text-[15px] font-semibold" style={{ background: '#16a34a', color: '#fff' }}>
            Create invoice · {money(w.amount)}
          </button>
        )}
        {!w.ended && <p className="text-xs mt-4 text-center" style={{ color: 'var(--color-muted)' }}>You can create this week's invoice after Sunday.</p>}
        {w.ended && w.missing_rate && <p className="text-xs mt-4 text-center" style={{ color: '#dc2626' }}>No pay rate set yet. Ask Rolando to set it.</p>}
      </div>
    </div>
  )
}

// ── App buttons (Open STB Scheduling, …) ────────────────────────────────────

function AppsCard({ me, onOpen }: { me: EmpMe; onOpen: (a: EmpApp) => void }) {
  const apps = (me.employee.apps || []).filter((a) => a && a.url)
  if (apps.length === 0) return null
  return (
    <div className="mb-4 grid gap-2.5">
      {apps.map((a) => (
        <button key={a.url + a.label} onClick={() => onOpen(a)}
          className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-[15px] font-semibold text-left transition active:scale-[0.98]"
          style={{ background: '#16294d', color: '#fff' }}>
          <span>{a.label || 'Open'}</span>
          <span aria-hidden>›</span>
        </button>
      ))}
    </div>
  )
}

/**
 * Another app (the STB scheduling board) shown full screen inside the OS.
 * It loads fresh on every open, so its link — which carries the view-only
 * code — signs him straight in each time; there is no second password.
 */
function AppView({ app, owner, onBack }: { app: EmpApp; owner: string; onBack: () => void }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0b1220' }}>
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: '#16294d', color: '#fff', paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
        <button onClick={onBack} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[15px] font-semibold active:scale-[0.97]"
          style={{ background: 'rgba(255,255,255,0.12)' }}>
          ‹ Back to {owner}'s OS
        </button>
        <span className="ml-auto text-xs font-medium truncate" style={{ opacity: 0.7 }}>{app.label}</span>
      </div>
      <div className="relative flex-1">
        {!loaded && <div className="absolute inset-0 grid place-items-center text-sm" style={{ color: '#93a1b5' }}>Opening {app.label || 'app'}…</div>}
        <iframe src={app.url} title={app.label || 'App'} onLoad={() => setLoaded(true)}
          className="absolute inset-0 w-full h-full border-0" style={{ background: '#fff', opacity: loaded ? 1 : 0 }} />
      </div>
    </div>
  )
}

// ── Non-negotiables: Rolando's list + his own ───────────────────────────────

function NonNegotiables({ me, day, token, run }: { me: EmpMe; day: string; token: string; run: Run }) {
  const [done, setDone] = useState<string[]>(me.day?.nn_done || [])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  useEffect(() => { setDone(me.day?.nn_done || []) }, [me.day, day])

  const owner = me.employee.nn_owner || []
  const own = me.employee.nn_own || []
  // Ticks are keyed by list so the same wording on both lists stays separate.
  const key = (list: 'r' | 'm', item: string) => `${list}:${item}`

  const toggle = (k: string) => {
    const next = done.includes(k) ? done.filter((x) => x !== k) : [...done, k]
    setDone(next)
    void run(() => empApi.saveDay(token, day, { nn_done: next }), false)
  }
  const saveOwn = (items: string[]) => run(() => empApi.saveOwnNn(token, items))

  const total = owner.length + own.length
  const count = done.filter((k) => owner.some((i) => key('r', i) === k) || own.some((i) => key('m', i) === k)).length

  const Row = ({ k, label, removable }: { k: string; label: string; removable?: () => void }) => {
    const on = done.includes(k)
    return (
      <li className="flex items-center gap-3 py-1.5">
        <button onClick={() => toggle(k)} aria-label={on ? 'Undo' : 'Done'}
          className="w-6 h-6 rounded-lg grid place-items-center shrink-0"
          style={{ background: on ? '#16a34a' : 'transparent', border: on ? 'none' : '2px solid var(--color-border)', color: '#fff' }}>
          {on && <IconCheck width={15} height={15} />}
        </button>
        <span className="text-[15px] flex-1" style={{ color: 'var(--color-text)', textDecoration: on ? 'line-through' : 'none', opacity: on ? 0.6 : 1 }}>{label}</span>
        {editing && removable && (
          <button onClick={removable} aria-label="Remove" style={{ color: 'var(--color-muted)' }}><IconTrash width={16} height={16} /></button>
        )}
      </li>
    )
  }

  return (
    <Section title="Non-negotiables" right={total > 0 ? <span className="text-sm font-semibold tnum" style={{ color: count === total ? '#16a34a' : 'var(--color-text)' }}>{count}/{total}</span> : undefined}>
      {owner.length > 0 && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted)' }}>From Rolando</p>
          <ul className="mb-3">{owner.map((i) => <Row key={key('r', i)} k={key('r', i)} label={i} />)}</ul>
        </>
      )}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Mine</p>
        <button onClick={() => setEditing((v) => !v)} className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>{editing ? 'Done' : 'Edit'}</button>
      </div>
      {own.length === 0 && !editing && <p className="text-sm py-1" style={{ color: 'var(--color-muted)' }}>Add the things you hold yourself to every day.</p>}
      <ul>{own.map((i) => <Row key={key('m', i)} k={key('m', i)} label={i} removable={() => void saveOwn(own.filter((x) => x !== i))} />)}</ul>
      {editing && (
        <div className="flex gap-2 mt-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add one…"
            onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { void saveOwn([...own, draft.trim()]); setDraft('') } }}
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
          <button onClick={() => { if (draft.trim()) { void saveOwn([...own, draft.trim()]); setDraft('') } }}
            className="rounded-xl px-3" style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}><IconPlus width={18} height={18} /></button>
        </div>
      )}
    </Section>
  )
}

// ── Tasks ───────────────────────────────────────────────────────────────────

function TasksCard({ me, token, run, day, todayOnly, onSeeAll }: {
  me: EmpMe; token: string; run: Run; day: string; todayOnly?: boolean; onSeeAll?: () => void
}) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const open = me.tasks.filter((t) => !t.done)
  const shown = todayOnly ? open.filter((t) => !t.due || t.due <= day) : me.tasks

  const add = () => {
    if (!title.trim()) return
    const t = title.trim(); const d = due || null
    setTitle(''); setDue('')
    void run(() => empApi.taskAdd(token, t, d))
  }

  return (
    <Section title={todayOnly ? 'Today’s tasks' : 'Tasks'}
      right={todayOnly && onSeeAll ? <button onClick={onSeeAll} className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>All tasks ({open.length})</button> : undefined}>
      {shown.length === 0 && <p className="text-sm py-1" style={{ color: 'var(--color-muted)' }}>{todayOnly ? 'Nothing due today.' : 'No tasks yet.'}</p>}
      <ul className="divide-y divide-[var(--color-border)]">
        {shown.map((t) => <TaskRow key={t.id} t={t} day={day} token={token} run={run} />)}
      </ul>
      {!todayOnly && (
        <div className="mt-3 flex flex-col gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task for yourself…"
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
            className="rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
          <div className="flex gap-2">
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)}
              className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
            <button onClick={add} disabled={!title.trim()} className="rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}>Add</button>
          </div>
        </div>
      )}
    </Section>
  )
}

function TaskRow({ t, day, token, run }: { t: EmpTask; day: string; token: string; run: Run }) {
  const overdue = !t.done && t.due && t.due < day
  return (
    <li className="flex items-start gap-3 py-2.5">
      <button onClick={() => void run(() => empApi.taskDone(token, t.id, !t.done))} aria-label={t.done ? 'Undo' : 'Done'}
        className="w-6 h-6 mt-0.5 rounded-lg grid place-items-center shrink-0"
        style={{ background: t.done ? '#16a34a' : 'transparent', border: t.done ? 'none' : '2px solid var(--color-border)', color: '#fff' }}>
        {t.done && <IconCheck width={15} height={15} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[15px]" style={{ color: 'var(--color-text)', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.6 : 1 }}>{t.title}</p>
        {t.notes && <p className="text-xs mt-0.5 whitespace-pre-wrap" style={{ color: 'var(--color-muted)' }}>{t.notes}</p>}
        <div className="flex gap-2 mt-0.5 text-[11px] font-medium">
          {t.created_by === 'owner' && <span style={{ color: '#b45309' }}>From Rolando</span>}
          {t.due && <span style={{ color: overdue ? '#dc2626' : 'var(--color-muted)' }}>{overdue ? 'Overdue · ' : ''}{formatDueLabel(t.due)}</span>}
        </div>
      </div>
      {t.created_by === 'employee' && (
        <button onClick={() => void run(() => empApi.taskDelete(token, t.id))} aria-label="Delete" style={{ color: 'var(--color-muted)' }}>
          <IconTrash width={16} height={16} />
        </button>
      )}
    </li>
  )
}

// ── Journal ─────────────────────────────────────────────────────────────────

function JournalCard({ me, day, token, run }: { me: EmpMe; day: string; token: string; run: Run }) {
  const [text, setText] = useState(me.day?.journal || '')
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => { setText(me.day?.journal || '') }, [day]) // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (v: string) => {
    setText(v); setSaved('saving')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      await run(() => empApi.saveDay(token, day, { journal: v }), false)
      setSaved('saved')
    }, 800)
  }

  return (
    <Section title={`Journal · ${new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
      right={<span className="text-xs" style={{ color: 'var(--color-muted)' }}>{saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Saved' : ''}</span>}>
      <p className="text-sm mb-2" style={{ color: 'var(--color-muted)' }}>What got done today, what's blocked, what Rolando should know.</p>
      <textarea value={text} onChange={(e) => onChange(e.target.value)} rows={12}
        className="w-full rounded-xl px-3 py-2.5 text-[15px] leading-relaxed outline-none resize-y"
        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
    </Section>
  )
}
