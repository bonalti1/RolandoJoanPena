# RANCH LAND — owner-finance land platform

The client portal + servicing dashboard for **Ranch Land Group**: owner-financed
ranchettes in South Texas. Built to beat GeekPay — bilingual (EN/ES), penny-accurate,
and designed to grow from our own portfolio into a multi-tenant SaaS.

## Run it

```bash
cd ranchland
npm install
npm run dev      # http://localhost:5173
npm test         # amortization engine checks (pure node, no framework)
npm run build    # typecheck + production build
```

The app boots in **demo mode** with a sample 500-acre ranch (El Venado Ranch),
8 lots, 3 buyers and their payment histories — no backend needed. Demo actions
("Make a payment", "Record payment") persist to localStorage; the admin
dashboard has a "Reset demo data" button.

## What's inside

| Area | Route | What it does |
| --- | --- | --- |
| Landing | `/` | Bilingual marketing page: available lots with live monthly-payment math, how owner finance works. |
| Client portal | `/portal` | Buyer signs in, sees balance, next payment, progress-to-ownership, full history + amortization schedule, documents, payoff quote. Every string in English and Spanish. |
| Admin | `/admin` | Portfolio KPIs, ranches & lot inventory, notes list, per-note ledger + schedule, delinquency aging with buyer contact info and preferred language. |

## Architecture decisions (the ones that matter)

- **All money is integer cents.** Floats never touch a balance. The engine in
  `src/lib/amortization.ts` builds fully-amortizing schedules where the final
  payment absorbs rounding so every note retires to exactly $0. `npm test`
  proves it.
- **The read API in `src/lib/store.ts` is the contract.** Pages call
  `getNoteState()`, `notesForBuyer()`, etc. When Supabase goes live, only the
  internals of the store change — no page rewrites.
- **Spanish is first-class** (`src/lib/i18n.tsx`): every buyer-facing string
  ships in both languages, and each buyer has a preferred language that
  delinquency workflows surface (call them in their language).
- **Append-only ledger** (see `supabase/schema.sql`): payments are never
  edited; ACH returns post reversing rows. This is the audit trail that
  protects us in a dispute or foreclosure.

## Going live — the cutover checklist

1. **Supabase**: create a project, run `supabase/schema.sql`, set
   `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Buyer auth = magic link or
   SMS OTP. Staff get `app_metadata.role = 'staff'`.
2. **Stripe ACH**: Netlify functions (service role) create SetupIntents for
   bank accounts and PaymentIntents on each due date; the Stripe webhook posts
   `payments` rows (`pending` → `settled`/`returned`) and explodes settled
   payments into `ledger_entries`. Never mark settled until the webhook says so —
   ACH can bounce days later.
3. **Messaging**: Twilio SMS receipts + reminders in the buyer's language.
4. **Documents**: upload executed PDFs to Supabase Storage; rows in
   `note_documents` drive the portal's Documents page.
5. Deploy on Netlify with **base directory `ranchland`** (own site, own domain).

## Compliance guardrails already encoded

- APR is capped below 18% (Texas usury) at the database level.
- Deed + note + deed-of-trust document structure (not contract-for-deed).
- Buyer language preference stored — Spanish paperwork when the deal is
  negotiated in Spanish.
- Ledger designed append-only for auditability.

> Everything legal here is directional — Texas counsel signs off on documents,
> notices, and the sales process before real notes are serviced on this platform.

## Roadmap

Phase 1 (this code): core servicing + portal, demo mode → Supabase cutover.
Phase 2: Stripe ACH autopay + SMS/WhatsApp + tax escrow + notices.
Phase 3: lot checkout — reserve, pay down payment, e-sign online.
Phase 4: multi-tenant SaaS for other land sellers.
