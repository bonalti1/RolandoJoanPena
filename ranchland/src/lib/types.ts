import { type Cents } from './money.ts'

export type LotStatus = 'available' | 'reserved' | 'sold'
export type NoteStatus = 'current' | 'late' | 'paid_off'
export type PaymentMethod = 'ach' | 'card' | 'cash' | 'check'
export type PaymentStatus = 'settled' | 'pending' | 'returned'
export type Lang = 'en' | 'es'

export interface Ranch {
  id: string
  name: string
  county: string
  acres: number
}

export interface Lot {
  id: string
  ranchId: string
  number: string
  acres: number
  priceCents: Cents
  downCents: Cents
  aprBps: number
  termMonths: number
  status: LotStatus
}

export interface Buyer {
  id: string
  name: string
  email: string
  phone: string
  lang: Lang
}

export interface Note {
  id: string
  lotId: string
  buyerId: string
  principalCents: Cents
  aprBps: number
  termMonths: number
  firstDueDate: string
  autopay: boolean
  escrowMonthlyCents: Cents   // pro-rated property taxes folded into the payment
  originatedAt: string
}

export interface Payment {
  id: string
  noteId: string
  date: string
  amountCents: Cents
  method: PaymentMethod
  status: PaymentStatus
}

export interface NoteDocument {
  id: string
  noteId: string
  name: { en: string; es: string }
  kind: 'contract' | 'note' | 'deed_of_trust' | 'disclosure' | 'statement'
}
