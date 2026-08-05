import { type Buyer, type Lot, type Note, type NoteDocument, type Payment, type Ranch } from './types.ts'

// Sample portfolio: one 500-acre South Texas ranch subdivided into ranchettes.
// Everything here is placeholder data for the demo — real records live in Supabase.

export const RANCHES: Ranch[] = [
  { id: 'r1', name: 'El Venado Ranch', county: 'Duval County, TX', acres: 500 },
]

export const LOTS: Lot[] = [
  { id: 'l1', ranchId: 'r1', number: 'Lot 1', acres: 10.1, priceCents: 5_990_000, downCents: 500_000, aprBps: 995, termMonths: 120, status: 'sold' },
  { id: 'l2', ranchId: 'r1', number: 'Lot 2', acres: 10.0, priceCents: 5_950_000, downCents: 500_000, aprBps: 995, termMonths: 120, status: 'sold' },
  { id: 'l3', ranchId: 'r1', number: 'Lot 3', acres: 12.4, priceCents: 6_990_000, downCents: 600_000, aprBps: 995, termMonths: 120, status: 'sold' },
  { id: 'l4', ranchId: 'r1', number: 'Lot 4', acres: 10.6, priceCents: 6_150_000, downCents: 500_000, aprBps: 995, termMonths: 120, status: 'reserved' },
  { id: 'l5', ranchId: 'r1', number: 'Lot 5', acres: 15.2, priceCents: 8_490_000, downCents: 750_000, aprBps: 995, termMonths: 144, status: 'available' },
  { id: 'l6', ranchId: 'r1', number: 'Lot 6', acres: 10.0, priceCents: 5_950_000, downCents: 500_000, aprBps: 995, termMonths: 120, status: 'available' },
  { id: 'l7', ranchId: 'r1', number: 'Lot 7', acres: 20.5, priceCents: 10_990_000, downCents: 1_000_000, aprBps: 995, termMonths: 180, status: 'available' },
  { id: 'l8', ranchId: 'r1', number: 'Lot 8', acres: 11.3, priceCents: 6_490_000, downCents: 550_000, aprBps: 995, termMonths: 120, status: 'available' },
]

export const BUYERS: Buyer[] = [
  { id: 'b1', name: 'María G. Salinas', email: 'maria@example.com', phone: '(956) 555-0142', lang: 'es' },
  { id: 'b2', name: 'James Whitfield', email: 'james@example.com', phone: '(361) 555-0187', lang: 'en' },
  { id: 'b3', name: 'Rubén y Alma Cantú', email: 'cantu@example.com', phone: '(956) 555-0119', lang: 'es' },
]

// principal = price - down
export const NOTES: Note[] = [
  { id: 'n1', lotId: 'l1', buyerId: 'b1', principalCents: 5_490_000, aprBps: 995, termMonths: 120, firstDueDate: '2025-11-01', autopay: true,  escrowMonthlyCents: 9_500,  originatedAt: '2025-10-04' },
  { id: 'n2', lotId: 'l2', buyerId: 'b2', principalCents: 5_450_000, aprBps: 995, termMonths: 120, firstDueDate: '2026-01-01', autopay: true,  escrowMonthlyCents: 9_500,  originatedAt: '2025-12-08' },
  { id: 'n3', lotId: 'l3', buyerId: 'b3', principalCents: 6_390_000, aprBps: 995, termMonths: 120, firstDueDate: '2026-03-01', autopay: false, escrowMonthlyCents: 11_800, originatedAt: '2026-02-11' },
]

// Payment history: n1 and n2 are current; n3 missed July and is late.
function pays(noteId: string, firstDue: string, count: number, amount: number, method: Payment['method']): Payment[] {
  const out: Payment[] = []
  const [y, m, d] = firstDue.split('-').map(Number)
  for (let i = 0; i < count; i++) {
    const total = (m - 1) + i
    const yy = y + Math.floor(total / 12)
    const mm = (total % 12) + 1
    out.push({
      id: `${noteId}-p${i + 1}`,
      noteId,
      date: `${yy}-${String(mm).padStart(2, '0')}-${String(Math.min(d, 28)).padStart(2, '0')}`,
      amountCents: amount,
      method,
      status: 'settled',
    })
  }
  return out
}

export const PAYMENTS: Payment[] = [
  // n1: 10 on-time autopay ACH payments (Nov 2025 – Aug 2026), P&I 72,399 + 9,500 escrow
  ...pays('n1', '2025-11-01', 10, 81_899, 'ach'),
  // n2: 8 payments (Jan – Aug 2026), P&I 71,871 + 9,500 escrow
  ...pays('n2', '2026-01-01', 8, 81_371, 'ach'),
  // n3: paid Mar–Jun 2026 by cash, missed July → late. P&I 84,267 + 11,800 escrow
  ...pays('n3', '2026-03-01', 4, 96_067, 'cash'),
]

export const DOCUMENTS: NoteDocument[] = NOTES.flatMap((n) => [
  { id: `${n.id}-d1`, noteId: n.id, kind: 'contract' as const, name: { en: 'Purchase contract', es: 'Contrato de compraventa' } },
  { id: `${n.id}-d2`, noteId: n.id, kind: 'note' as const, name: { en: 'Promissory note', es: 'Pagaré' } },
  { id: `${n.id}-d3`, noteId: n.id, kind: 'deed_of_trust' as const, name: { en: 'Deed of trust', es: 'Escritura de fideicomiso' } },
  { id: `${n.id}-d4`, noteId: n.id, kind: 'statement' as const, name: { en: '2025 interest statement', es: 'Estado de intereses 2025' } },
])
