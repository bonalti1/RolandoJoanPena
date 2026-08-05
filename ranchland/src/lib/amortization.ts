import { type Cents, roundCents } from './money.ts'

// Fixed-rate, fully amortizing installment schedule in integer cents.
// Interest each period = round(balance * apr/12). The final payment absorbs
// all rounding drift so the schedule retires the balance exactly to zero.

export interface ScheduleRow {
  period: number          // 1-based payment number
  dueDate: string         // ISO yyyy-mm-dd
  payment: Cents
  interest: Cents
  principal: Cents
  balance: Cents          // remaining after this payment
}

export interface NoteTerms {
  principal: Cents
  aprBps: number          // annual rate in basis points, e.g. 995 = 9.95%
  termMonths: number
  firstDueDate: string    // ISO yyyy-mm-dd
}

export function monthlyPayment({ principal, aprBps, termMonths }: Omit<NoteTerms, 'firstDueDate'>): Cents {
  if (aprBps === 0) return Math.ceil(principal / termMonths)
  const r = aprBps / 10000 / 12
  const raw = (principal * r) / (1 - Math.pow(1 + r, -termMonths))
  return roundCents(raw)
}

export function buildSchedule(terms: NoteTerms): ScheduleRow[] {
  const { principal, aprBps, termMonths, firstDueDate } = terms
  const pay = monthlyPayment(terms)
  const r = aprBps / 10000 / 12
  const rows: ScheduleRow[] = []
  let balance = principal

  for (let period = 1; period <= termMonths; period++) {
    const interest = roundCents(balance * r)
    let payment: Cents
    let principalPart: Cents
    if (period === termMonths) {
      principalPart = balance
      payment = balance + interest
    } else {
      payment = pay
      principalPart = Math.min(pay - interest, balance)
    }
    balance -= principalPart
    rows.push({ period, dueDate: addMonths(firstDueDate, period - 1), payment, interest, principal: principalPart, balance })
    if (balance === 0 && period < termMonths) break // paid off early by rounding
  }
  return rows
}

/** Simple-interest payoff: balance + accrued interest since the last paid-through date. */
export function payoffQuote(balance: Cents, aprBps: number, paidThrough: string, asOf: string): Cents {
  const days = Math.max(0, daysBetween(paidThrough, asOf))
  const perDiem = (balance * (aprBps / 10000)) / 365
  return balance + roundCents(perDiem * days)
}

export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const total = (m - 1) + n
  const year = y + Math.floor(total / 12)
  const month = (total % 12) + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const day = Math.min(d, lastDay)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000)
}
