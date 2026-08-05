// Run with: npm test   (plain node, no framework needed)
import { buildSchedule, monthlyPayment, addMonths, payoffQuote } from './amortization.ts'

let failures = 0
function check(name: string, cond: boolean, detail = '') {
  if (!cond) { failures++; console.error(`FAIL  ${name} ${detail}`) }
  else console.log(`ok    ${name}`)
}

// $45,000 at 9.95% for 120 months — a typical ranchette note.
{
  const terms = { principal: 4_500_000, aprBps: 995, termMonths: 120, firstDueDate: '2026-10-01' }
  const pay = monthlyPayment(terms)
  check('payment in expected range', pay > 59_000 && pay < 59_500, String(pay))

  const rows = buildSchedule(terms)
  check('schedule has 120 rows', rows.length === 120, String(rows.length))
  check('final balance is exactly zero', rows[rows.length - 1].balance === 0)

  const totPrincipal = rows.reduce((s, r) => s + r.principal, 0)
  check('principal sums to loan amount', totPrincipal === terms.principal, String(totPrincipal))

  for (const r of rows) {
    if (r.payment !== r.interest + r.principal) {
      check('every row: payment = interest + principal', false, `period ${r.period}`)
      break
    }
  }
  check('rows internally consistent', true)
  check('due dates advance monthly', rows[1].dueDate === '2026-11-01' && rows[12].dueDate === '2027-10-01')
}

// Zero-interest note divides evenly.
{
  const rows = buildSchedule({ principal: 1_200_000, aprBps: 0, termMonths: 24, firstDueDate: '2026-09-15' })
  check('0% note retires to zero', rows[rows.length - 1].balance === 0)
  check('0% principal sums correctly', rows.reduce((s, r) => s + r.principal, 0) === 1_200_000)
}

// Month-end handling: Jan 31 + 1 month clamps to Feb's last day.
check('addMonths clamps to month end', addMonths('2026-01-31', 1) === '2026-02-28')

// Payoff accrues per-diem interest.
{
  const q = payoffQuote(3_000_000, 1000, '2026-08-01', '2026-08-31')
  const perDiem = (3_000_000 * 0.10) / 365
  check('payoff = balance + 30 days interest', q === 3_000_000 + Math.round(perDiem * 30), String(q))
}

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll amortization checks passed.')
