-- ============================================================
-- RANCH LAND GROUP — servicing schema (Phase 1)
-- Run in the Supabase SQL editor. Money is BIGINT cents everywhere.
-- The ledger is append-only: rows are never updated or deleted;
-- corrections are posted as reversing entries.
-- ============================================================

create table ranches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  county      text not null,
  acres       numeric(8,2) not null,
  created_at  timestamptz not null default now()
);

create table lots (
  id          uuid primary key default gen_random_uuid(),
  ranch_id    uuid not null references ranches(id),
  number      text not null,
  acres       numeric(8,2) not null,
  price_cents bigint not null check (price_cents > 0),
  down_cents  bigint not null check (down_cents >= 0),
  apr_bps     int not null check (apr_bps between 0 and 1799),  -- < 18% TX usury ceiling
  term_months int not null check (term_months between 1 and 360),
  status      text not null default 'available' check (status in ('available','reserved','sold')),
  created_at  timestamptz not null default now()
);

create table buyers (
  id          uuid primary key default gen_random_uuid(),
  auth_user   uuid unique references auth.users(id),  -- linked on first portal sign-in
  name        text not null,
  email       text,
  phone       text,
  lang        text not null default 'en' check (lang in ('en','es')),
  created_at  timestamptz not null default now()
);

create table notes (
  id              uuid primary key default gen_random_uuid(),
  lot_id          uuid not null references lots(id),
  buyer_id        uuid not null references buyers(id),
  principal_cents bigint not null check (principal_cents > 0),
  apr_bps         int not null check (apr_bps between 0 and 1799),
  term_months     int not null,
  first_due_date  date not null,
  autopay         boolean not null default false,
  escrow_monthly_cents bigint not null default 0,
  status          text not null default 'current' check (status in ('current','late','default_notice','paid_off','cancelled')),
  originated_at   date not null default current_date
);

-- Money movement. status transitions: pending -> settled | returned.
-- An ACH that settles then bounces gets a NEW 'returned' row referencing the
-- original (reverses_id) — history is never rewritten.
create table payments (
  id           uuid primary key default gen_random_uuid(),
  note_id      uuid not null references notes(id),
  amount_cents bigint not null,
  method       text not null check (method in ('ach','card','cash','check')),
  status       text not null default 'pending' check (status in ('pending','settled','returned')),
  reverses_id  uuid references payments(id),
  external_ref text,            -- Stripe payment_intent / charge id
  received_at  timestamptz not null default now(),
  settled_at   timestamptz
);

-- Append-only double-entry style ledger: every settled payment explodes into
-- interest / principal / escrow / late-fee lines here.
create table ledger_entries (
  id           uuid primary key default gen_random_uuid(),
  note_id      uuid not null references notes(id),
  payment_id   uuid references payments(id),
  entry_date   date not null default current_date,
  category     text not null check (category in ('interest','principal','escrow','late_fee','adjustment')),
  amount_cents bigint not null,   -- positive = paid by buyer; negative = reversal
  memo         text,
  created_at   timestamptz not null default now()
);

create table note_documents (
  id           uuid primary key default gen_random_uuid(),
  note_id      uuid not null references notes(id),
  kind         text not null check (kind in ('contract','note','deed_of_trust','disclosure','statement')),
  name_en      text not null,
  name_es      text not null,
  storage_path text not null,     -- Supabase Storage object path
  created_at   timestamptz not null default now()
);

-- ---------- Row Level Security ----------
-- Buyers see only their own notes/payments/docs. Staff (role claim) see all.
alter table ranches enable row level security;
alter table lots enable row level security;
alter table buyers enable row level security;
alter table notes enable row level security;
alter table payments enable row level security;
alter table ledger_entries enable row level security;
alter table note_documents enable row level security;

create or replace function is_staff() returns boolean language sql stable as
  $$ select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff', false) $$;

-- Public marketing pages may list ranches & lots.
create policy "lots are public"    on lots    for select using (true);
create policy "ranches are public" on ranches for select using (true);

create policy "buyer reads self"   on buyers  for select using (auth_user = auth.uid() or is_staff());
create policy "buyer reads own notes" on notes for select
  using (is_staff() or buyer_id in (select id from buyers where auth_user = auth.uid()));
create policy "buyer reads own payments" on payments for select
  using (is_staff() or note_id in (select n.id from notes n join buyers b on b.id = n.buyer_id where b.auth_user = auth.uid()));
create policy "buyer reads own ledger" on ledger_entries for select
  using (is_staff() or note_id in (select n.id from notes n join buyers b on b.id = n.buyer_id where b.auth_user = auth.uid()));
create policy "buyer reads own docs" on note_documents for select
  using (is_staff() or note_id in (select n.id from notes n join buyers b on b.id = n.buyer_id where b.auth_user = auth.uid()));

-- All writes go through service-role server functions (Netlify functions),
-- never from the browser. Staff dashboards read with the staff claim.
create policy "staff writes ranches" on ranches for all using (is_staff());
create policy "staff writes lots"    on lots    for all using (is_staff());
create policy "staff writes buyers"  on buyers  for all using (is_staff());
create policy "staff writes notes"   on notes   for all using (is_staff());
