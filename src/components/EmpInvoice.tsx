import { useRef, type ReactNode } from 'react'
import { hoursLabel, invoiceNo, money, weekLabel, type EmpInvoice } from '../lib/employee'

/**
 * One invoice, exactly as both sides see it — the employee from his Payroll
 * tab, Rolando from Team. It renders as its own small HTML document inside an
 * iframe, so "Save / Print" prints only the invoice (and on a phone, "Save as
 * PDF" from the print sheet gives a file he can send anywhere).
 */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const day = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const dateLong = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

export const STATUS_LABEL: Record<EmpInvoice['status'], string> = { sent: 'Sent', approved: 'Approved', paid: 'Paid' }
export const STATUS_COLOR: Record<EmpInvoice['status'], string> = { sent: '#2563eb', approved: '#b45309', paid: '#16a34a' }

export function invoiceHtml(inv: EmpInvoice): string {
  const rows = inv.lines.filter((l) => l.minutes > 0).map((l) => `
    <tr>
      <td>${esc(day(l.day))}<div class="sub">${l.shifts.map((s) => `${time(s.in)} – ${time(s.out)}`).join(', ')}</div></td>
      <td class="r">${hoursLabel(l.minutes)}</td>
      <td class="r">${money(l.rate)}/h</td>
      <td class="r">${money(l.amount)}</td>
    </tr>`).join('')
  const status = STATUS_LABEL[inv.status]
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(invoiceNo(inv.from_name, inv.number))}</title><style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#141a24;margin:0;padding:28px 22px;background:#fff}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
h1{font-size:26px;margin:0;letter-spacing:-.01em}.muted{color:#697488;font-size:13px}.sub{color:#697488;font-size:11.5px;margin-top:2px}
.badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 9px;border-radius:999px;color:#fff;background:${STATUS_COLOR[inv.status]}}
.parties{display:flex;gap:28px;margin:22px 0 18px}.parties b{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#697488;margin-bottom:3px}
table{width:100%;border-collapse:collapse;font-size:13.5px}th{text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#697488;border-bottom:1.5px solid #141a24;padding:8px 6px}
td{padding:9px 6px;border-bottom:1px solid #e6eaf1;vertical-align:top}.r{text-align:right;white-space:nowrap}
.total{display:flex;justify-content:flex-end;gap:28px;margin-top:14px;font-size:15px}.total b{font-size:22px}
.foot{margin-top:28px;font-size:11.5px;color:#697488}
</style></head><body>
<div class="top"><div><h1>Invoice</h1><div class="muted">No. ${esc(invoiceNo(inv.from_name, inv.number))} · ${esc(dateLong(inv.sent_at))}</div></div><span class="badge">${status}</span></div>
<div class="parties"><div><b>From</b>${esc(inv.from_name)}</div><div><b>Bill to</b>${esc(inv.bill_to)}</div><div><b>Week</b>${esc(weekLabel(inv.week_start, inv.week_end))}</div></div>
<table><thead><tr><th>Day</th><th class="r">Hours</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="total"><span class="muted">${hoursLabel(inv.minutes)} total</span><span>Total due <b>${money(inv.total)}</b></span></div>
<div class="foot">Hours come from the Employee OS time clock (clock-in and clock-out with location).${inv.paid_at ? ` Paid ${esc(dateLong(inv.paid_at))}.` : inv.approved_at ? ` Approved ${esc(dateLong(inv.approved_at))}.` : ''}</div>
</body></html>`
}

export function InvoiceView({ inv, onClose, actions }: { inv: EmpInvoice; onClose: () => void; actions?: ReactNode }) {
  const frame = useRef<HTMLIFrameElement>(null)
  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#0b1220' }}>
      <div className="flex items-center gap-2 px-3 py-2.5 flex-wrap" style={{ background: '#16294d', color: '#fff', paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
        <button onClick={onClose} className="rounded-xl px-3 py-2 text-[15px] font-semibold" style={{ background: 'rgba(255,255,255,0.12)' }}>‹ Back</button>
        <div className="ml-auto flex items-center gap-2">
          {actions}
          <button onClick={() => frame.current?.contentWindow?.print()} className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: '#fff', color: '#16294d' }}>
            Save / Print
          </button>
        </div>
      </div>
      <iframe ref={frame} title="Invoice" srcDoc={invoiceHtml(inv)} className="flex-1 w-full border-0" style={{ background: '#fff' }} />
    </div>
  )
}
