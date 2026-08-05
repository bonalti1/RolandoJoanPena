import { useSyncExternalStore } from 'react'
import { storage } from './storage.ts'
import { BUYERS, DOCUMENTS, LOTS, NOTES, PAYMENTS, RANCHES } from './demo.ts'
import { buildSchedule, type ScheduleRow } from './amortization.ts'
import { type Cents } from './money.ts'
import { type Note, type Payment } from './types.ts'

// Demo data layer. The read API here (getNoteState, listNotes, …) is the same
// shape the Supabase-backed layer will expose, so pages won't change when the
// backend goes live — only this file's internals will.

const LS_PAYMENTS = 'rl:extraPayments'
const LS_SESSION = 'rl:session'

let extraPayments: Payment[] = JSON.parse(storage.get(LS_PAYMENTS) ?? '[]')
let session: string | null = storage.get(LS_SESSION)
let version = 0
const listeners = new Set<() => void>()

function bump() {
  version++
  listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
export function useStoreVersion() {
  return useSyncExternalStore(subscribe, () => version)
}

// ---------- session ----------
export function currentSession(): string | null { return session }
export function signIn(id: string) { session = id; storage.set(LS_SESSION, id); bump() }
export function signOut() { session = null; storage.del(LS_SESSION); bump() }

// ---------- reads ----------
export const ranches = RANCHES
export const lots = LOTS
export const buyers = BUYERS
export const notes = NOTES
export const documents = DOCUMENTS

export function allPayments(): Payment[] {
  return [...PAYMENTS, ...extraPayments]
}

export interface NoteState {
  note: Note
  schedule: ScheduleRow[]
  settled: Payment[]
  periodsPaid: number
  balance: Cents
  paidThrough: string       // due date covered by the last settled payment (or day before first due)
  nextDue: ScheduleRow | null
  monthlyTotal: Cents       // P&I + escrow
  daysLate: number
  status: 'current' | 'late' | 'paid_off'
}

const TODAY = new Date().toISOString().slice(0, 10)

export function getNoteState(noteId: string, asOf: string = TODAY): NoteState {
  const note = NOTES.find((n) => n.id === noteId)!
  const schedule = buildSchedule({
    principal: note.principalCents,
    aprBps: note.aprBps,
    termMonths: note.termMonths,
    firstDueDate: note.firstDueDate,
  })
  const settled = allPayments()
    .filter((p) => p.noteId === noteId && p.status === 'settled')
    .sort((a, b) => a.date.localeCompare(b.date))

  const periodsPaid = Math.min(settled.length, schedule.length)
  const balance = periodsPaid === 0 ? note.principalCents : schedule[periodsPaid - 1].balance
  const paidThrough = periodsPaid === 0 ? note.firstDueDate : schedule[periodsPaid - 1].dueDate
  const nextDue = periodsPaid >= schedule.length ? null : schedule[periodsPaid]
  const monthlyTotal = (nextDue?.payment ?? 0) + note.escrowMonthlyCents

  let daysLate = 0
  if (nextDue && nextDue.dueDate < asOf) {
    daysLate = Math.round((Date.parse(asOf) - Date.parse(nextDue.dueDate)) / 86400000)
  }
  const status = balance === 0 ? 'paid_off' : daysLate > 10 ? 'late' : 'current'

  return { note, schedule, settled, periodsPaid, balance, paidThrough, nextDue, monthlyTotal, daysLate, status }
}

export function notesForBuyer(buyerId: string): Note[] {
  return NOTES.filter((n) => n.buyerId === buyerId)
}

// ---------- writes (demo only — go to localStorage) ----------
export function recordPayment(noteId: string, amountCents: Cents, method: Payment['method']) {
  extraPayments = [...extraPayments, {
    id: `x-${noteId}-${Date.now()}`,
    noteId,
    date: TODAY,
    amountCents,
    method,
    status: 'settled',
  }]
  storage.set(LS_PAYMENTS, JSON.stringify(extraPayments))
  bump()
}

export function resetDemo() {
  extraPayments = []
  storage.del(LS_PAYMENTS)
  bump()
}
