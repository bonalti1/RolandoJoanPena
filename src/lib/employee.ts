import { supabase } from './supabase'

/**
 * Employee OS data layer — the PIN-login side.
 *
 * Field employees (Roberto first) have no Supabase account. They type a PIN,
 * `emp_login` checks it inside the database and returns a session token, and
 * every call after that goes through an `emp_*` function that takes the token.
 * The emp_* tables themselves are owner-only under Row Level Security, so the
 * phone can only ever reach what those functions hand it.
 * See supabase/09_employee_os.sql.
 */

export type EmpApp = { label: string; url: string }

export type EmpClock = {
  id: string
  kind: 'in' | 'out'
  at: string
  lat: number | null
  lng: number | null
  accuracy_m: number | null
  geo_note: string
  /** Set when the employee undid this punch; it then counts for nothing. */
  voided_at?: string | null
  void_reason?: string
}

export type PayShift = { in: string; out: string; minutes: number }
export type PayDay = { day: string; minutes: number; rate: number | null; amount: number; shifts: PayShift[] }
export type EmpInvoice = {
  id: string; employee_id?: string; number: number; week_start: string; week_end: string
  lines: PayDay[]; minutes: number; total: number; from_name: string; bill_to: string
  status: 'sent' | 'approved' | 'paid'; sent_at: string; approved_at: string | null; paid_at: string | null
}
export type PayWeek = {
  week_start: string; week_end: string; days: PayDay[]; minutes: number; amount: number
  open_days: string[]; missing_rate: boolean; ended: boolean
  invoice: Pick<EmpInvoice, 'id' | 'number' | 'status' | 'total' | 'minutes' | 'sent_at' | 'approved_at' | 'paid_at'> | null
}
export type Payroll = { rate: number | null; weeks: PayWeek[]; invoices: EmpInvoice[] }

export type EmpTask = {
  id: string
  title: string
  notes: string
  due: string | null
  done: boolean
  done_at: string | null
  created_by: 'owner' | 'employee'
}

export type EmpMe = {
  employee: {
    id: string; name: string; title: string; company: string
    apps: EmpApp[]; nn_owner: string[]; nn_own: string[]
  }
  day: { nn_done: string[]; journal: string } | null
  clock: EmpClock[]
  tasks: EmpTask[]
}

const TOKEN_KEY = 'emp.session.v1'

export const empToken = {
  get: (): string | null => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t) } catch { /* private mode */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY) } catch { /* private mode */ } },
}

/** Database error codes raised by the emp_* functions, as plain words. */
export function empErrorText(e: unknown): string {
  const msg = String((e as { message?: string })?.message || e || '')
  if (msg.includes('wrong_pin')) return 'That code didn’t match. Try again.'
  if (msg.includes('too_many_attempts')) return 'Too many tries. Wait 15 minutes and try again.'
  if (msg.includes('reason_required')) return 'Write a short reason for the undo.'
  if (msg.includes('only_last_punch')) return 'Only your last punch can be undone.'
  if (msg.includes('only_today')) return 'Only today’s punch can be undone. Ask Rolando to fix older ones.'
  if (msg.includes('week_invoiced')) return 'That week is already invoiced, so its hours are locked.'
  if (msg.includes('week_not_finished')) return 'You can invoice a week once it ends (after Sunday).'
  if (msg.includes('already_invoiced')) return 'That week already has an invoice.'
  if (msg.includes('missing_clock_out')) return 'A day that week has a clock-in with no clock-out. Ask Rolando to fix it first.'
  if (msg.includes('no_pay_rate')) return 'No pay rate is set yet. Ask Rolando to set it.'
  if (msg.includes('no_hours')) return 'No hours that week, so there is nothing to invoice.'
  if (msg.includes('session_expired')) return 'You’ve been signed out. Enter your code again.'
  if (msg.includes('Could not find the function')) return 'The Employee OS isn’t set up yet (run supabase/09_employee_os.sql).'
  if (/fetch|network/i.test(msg)) return 'No connection. Check your signal and try again.'
  return msg || 'Something went wrong.'
}

export const isSessionExpired = (e: unknown) =>
  String((e as { message?: string })?.message || '').includes('session_expired')

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Cloud isn’t configured on this site.')
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data as T
}

export const empApi = {
  login: async (pin: string) => {
    const r = await rpc<{ token?: string; name?: string; error?: string }>('emp_login', { p_pin: pin })
    if (r.error || !r.token) throw new Error(r.error || 'wrong_pin')
    return { token: r.token, name: r.name || '' }
  },
  logout: (token: string) => rpc<void>('emp_logout', { p_token: token }),
  me: (token: string, day: string) => rpc<EmpMe>('emp_me', { p_token: token, p_day: day }),
  punch: (token: string, kind: 'in' | 'out', geo: GeoStamp) =>
    rpc<EmpClock>('emp_clock_punch', {
      p_token: token, p_kind: kind,
      p_lat: geo.lat, p_lng: geo.lng, p_accuracy: geo.accuracy, p_geo_note: geo.note,
    }),
  taskDone: (token: string, id: string, done: boolean) =>
    rpc<void>('emp_task_done', { p_token: token, p_task: id, p_done: done }),
  taskAdd: (token: string, title: string, due: string | null) =>
    rpc<void>('emp_task_add', { p_token: token, p_title: title, p_due: due }),
  taskDelete: (token: string, id: string) =>
    rpc<void>('emp_task_delete', { p_token: token, p_task: id }),
  saveDay: (token: string, day: string, patch: { nn_done?: string[]; journal?: string }) =>
    rpc<void>('emp_day_save', {
      p_token: token, p_day: day,
      p_nn_done: patch.nn_done ?? null, p_journal: patch.journal ?? null,
    }),
  undo: (token: string, punch: string, reason: string) =>
    rpc<void>('emp_clock_undo', { p_token: token, p_punch: punch, p_reason: reason }),
  payroll: (token: string, weeks = 8) => rpc<Payroll>('emp_payroll', { p_token: token, p_weeks: weeks }),
  invoiceCreate: (token: string, week: string) =>
    rpc<EmpInvoice>('emp_invoice_create', { p_token: token, p_week: week }),
  saveOwnNn: (token: string, items: string[]) =>
    rpc<void>('emp_nn_own_save', { p_token: token, p_items: items }),
}

export type GeoStamp = { lat: number | null; lng: number | null; accuracy: number | null; note: string }

/**
 * One location fix, taken only at the moment of a punch. Never throws: if the
 * phone refuses or can't get a fix within 15s, the punch still goes through
 * and records why there is no location.
 */
export function getGeoStamp(): Promise<GeoStamp> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ lat: null, lng: null, accuracy: null, note: 'unsupported' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude, lng: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy), note: '',
      }),
      (err) => resolve({
        lat: null, lng: null, accuracy: null,
        note: err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable',
      }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

export const mapsLink = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`

export function geoLabel(c: Pick<EmpClock, 'lat' | 'accuracy_m' | 'geo_note'>): string {
  if (c.lat != null) return c.accuracy_m != null ? `Location saved (±${Math.round(c.accuracy_m)} m)` : 'Location saved'
  if (c.geo_note === 'denied') return 'No location — permission denied'
  if (c.geo_note === 'timeout') return 'No location — phone took too long'
  return 'No location'
}

export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/** Hours and minutes worked from today's punches (an open shift counts up to now). */
export function workedMinutes(punches: EmpClock[], dayISO: string): number {
  const today = punches
    .filter((c) => !c.voided_at && localDayISO(c.at) === dayISO)
    .sort((a, b) => a.at.localeCompare(b.at))
  let total = 0
  let start: number | null = null
  for (const c of today) {
    const t = new Date(c.at).getTime()
    if (c.kind === 'in') { if (start == null) start = t }
    else if (start != null) { total += t - start; start = null }
  }
  if (start != null) total += Date.now() - start
  return Math.round(total / 60000)
}

export const fmtWorked = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`

export function localDayISO(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const money = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export const hoursLabel = (minutes: number) => (minutes / 60).toFixed(2).replace(/\.00$/, '') + ' h'

/** "Oct 6 – Oct 12" from ISO dates (read as calendar days, not instants). */
export function weekLabel(start: string, end: string) {
  const f = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric' })
  return `${f(start)} – ${f(end)}`
}

export const invoiceNo = (name: string, n: number) =>
  `${(name || 'E').trim().charAt(0).toUpperCase()}-${String(n).padStart(4, '0')}`
