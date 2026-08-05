// All money in this codebase is integer CENTS. Floats never touch a balance —
// they appear only transiently inside rounding helpers here and in the
// amortization engine.

export type Cents = number

export function usd(cents: Cents, opts: { compact?: boolean } = {}): string {
  const d = cents / 100
  return d.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts.compact && cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export function parseUsd(input: string): Cents | null {
  const cleaned = input.replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  return Math.round(parseFloat(cleaned) * 100)
}

/** Round half away from zero — the convention loan servicers use. */
export function roundCents(x: number): Cents {
  return Math.sign(x) * Math.round(Math.abs(x))
}

export function pct(n: number, of: number): number {
  return of === 0 ? 0 : Math.min(100, Math.max(0, (n / of) * 100))
}
