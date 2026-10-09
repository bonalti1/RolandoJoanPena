-- ============================================================================
-- EMPLOYEE OS — undo a punch, pay rate, weekly payroll and invoices
-- ============================================================================
-- Run after employee_os.sql and employee_os_02_owner_view.sql. Safe to re-run.
--
--   * Undo: the employee can take back his LAST punch of the day, with a
--     reason. Nothing is deleted — the punch is marked undone, reason and
--     time kept, and Rolando sees it crossed out on Team.
--   * Pay rate: Rolando's number, edited only from Team. Each change is a new
--     row with the date it takes effect, so hours are always paid at the
--     rate in force the day they were worked, and a change never rewrites
--     an invoice already sent.
--   * Payroll: weeks run Monday–Sunday (Texas time). Hours are computed here
--     in the database from the punches — never from numbers the phone sends.
--   * Invoices: once a week has ended he taps Create invoice; the database
--     freezes that week's lines, hours, rates and total into the invoice and
--     locks the week (no more undos in it). Rolando approves and marks paid.
-- ---------------------------------------------------------------------------

-- ── Undo columns on punches ─────────────────────────────────────────────────
alter table public.emp_clock add column if not exists voided_at   timestamptz;
alter table public.emp_clock add column if not exists void_reason text not null default '';

-- ── Invoice details on the employee (Rolando edits from Team) ───────────────
alter table public.emp_employees add column if not exists invoice_bill_to text not null default 'South Texas Builders';
alter table public.emp_employees add column if not exists invoice_from    text not null default '';

-- ── Pay rates: one row per change, effective from a date ────────────────────
create table if not exists public.emp_rates (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.emp_employees(id) on delete cascade,
  rate           numeric(10,2) not null check (rate >= 0),
  effective_from date not null,
  created_at     timestamptz not null default now()
);
create index if not exists emp_rates_emp on public.emp_rates (employee_id, effective_from desc);

-- ── Invoices: a frozen copy of one week ─────────────────────────────────────
create table if not exists public.emp_invoices (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.emp_employees(id) on delete cascade,
  number       int not null,
  week_start   date not null,
  week_end     date not null,
  lines        jsonb not null,
  minutes      int not null,
  total        numeric(12,2) not null,
  from_name    text not null default '',
  bill_to      text not null default '',
  status       text not null default 'sent' check (status in ('sent', 'approved', 'paid')),
  sent_at      timestamptz not null default now(),
  approved_at  timestamptz,
  paid_at      timestamptz,
  unique (employee_id, week_start),
  unique (employee_id, number)
);

alter table public.emp_rates    enable row level security;
alter table public.emp_invoices enable row level security;
do $$
declare t text;
begin
  foreach t in array array['emp_rates', 'emp_invoices'] loop
    execute format('drop policy if exists "owner manages %1$s" on public.%1$I', t);
    execute format(
      'create policy "owner manages %1$s" on public.%1$I for all
         using (public.ws_role() = ''owner'') with check (public.ws_role() = ''owner'')', t);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ── Helpers ─────────────────────────────────────────────────────────────────

-- The company's clock: every "day" and "week" is Texas time, whatever the
-- phone's or the server's time zone.
create or replace function public.emp_local_day(p_at timestamptz)
returns date language sql immutable as $$ select (p_at at time zone 'America/Chicago')::date $$;

create or replace function public.emp_week_start(p_day date)
returns date language sql immutable as $$ select p_day - ((extract(isodow from p_day)::int) - 1) $$;

create or replace function public.emp_rate_on(p_emp uuid, p_day date)
returns numeric language sql stable security definer set search_path = public as $$
  select rate from public.emp_rates
   where employee_id = p_emp and effective_from <= p_day
   order by effective_from desc, created_at desc limit 1
$$;

-- One week of hours and pay, computed from the punches (undone ones skipped).
-- An 'in' with no matching 'out' is reported as an open shift.
create or replace function public.emp_week_calc(p_emp uuid, p_week date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  r record;
  cur_in timestamptz;
  per_day jsonb := '{}'::jsonb;
  shifts jsonb := '{}'::jsonb;
  open_days jsonb := '[]'::jsonb;
  k text;
  mins int;
  d date;
  days jsonb := '[]'::jsonb;
  total_min int := 0;
  total_amt numeric := 0;
  rate numeric;
  missing_rate boolean := false;
begin
  for r in
    select kind, at from public.emp_clock
     where employee_id = p_emp and voided_at is null
       and public.emp_local_day(at) between p_week and p_week + 6
     order by at
  loop
    if r.kind = 'in' then
      if cur_in is not null then open_days := open_days || to_jsonb(public.emp_local_day(cur_in)::text); end if;
      cur_in := r.at;
    elsif cur_in is not null then
      k := public.emp_local_day(cur_in)::text;
      mins := floor(extract(epoch from (r.at - cur_in)) / 60);
      per_day := jsonb_set(per_day, array[k], to_jsonb(coalesce((per_day ->> k)::int, 0) + mins));
      shifts := jsonb_set(shifts, array[k], coalesce(shifts -> k, '[]'::jsonb)
                || jsonb_build_object('in', cur_in, 'out', r.at, 'minutes', mins));
      cur_in := null;
    end if;
  end loop;
  if cur_in is not null then open_days := open_days || to_jsonb(public.emp_local_day(cur_in)::text); end if;

  for i in 0..6 loop
    d := p_week + i;
    k := d::text;
    mins := coalesce((per_day ->> k)::int, 0);
    rate := public.emp_rate_on(p_emp, d);
    if mins > 0 and rate is null then missing_rate := true; end if;
    days := days || jsonb_build_object(
      'day', k, 'minutes', mins, 'rate', rate,
      'amount', round(mins / 60.0 * coalesce(rate, 0), 2),
      'shifts', coalesce(shifts -> k, '[]'::jsonb));
    total_min := total_min + mins;
    total_amt := total_amt + round(mins / 60.0 * coalesce(rate, 0), 2);
  end loop;

  return jsonb_build_object(
    'week_start', p_week, 'week_end', p_week + 6, 'days', days,
    'minutes', total_min, 'amount', total_amt,
    'open_days', open_days, 'missing_rate', missing_rate);
end $$;
revoke execute on function public.emp_week_calc(uuid, date) from public, anon, authenticated;
revoke execute on function public.emp_rate_on(uuid, date) from public, anon, authenticated;

-- ── Employee: today's data now carries undo fields and his current rate ────

create or replace function public.emp_me(p_token text, p_day date)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_emp uuid := public.emp_session_employee(p_token);
begin
  return json_build_object(
    'employee', (select json_build_object(
        'id', e.id, 'name', e.name, 'title', e.title, 'company', e.company,
        'apps', e.apps, 'nn_owner', e.nn_owner, 'nn_own', e.nn_own)
      from public.emp_employees e where e.id = v_emp),
    'day', (select json_build_object('nn_done', d.nn_done, 'journal', d.journal)
      from public.emp_days d where d.employee_id = v_emp and d.day = p_day),
    'clock', coalesce((select json_agg(c order by c.at)
      from (select id, kind, at, lat, lng, accuracy_m, geo_note, voided_at, void_reason
              from public.emp_clock
             where employee_id = v_emp and at > now() - interval '36 hours') c), '[]'::json),
    'tasks', coalesce((select json_agg(t order by t.done, t.due nulls last, t.created_at)
      from (select id, title, notes, due, done, done_at, created_by, created_at from public.emp_tasks
             where employee_id = v_emp
               and (not done or done_at > now() - interval '7 days')) t), '[]'::json)
  );
end $$;

-- ── Employee: undo his last punch of the day, with a reason ─────────────────

create or replace function public.emp_clock_undo(p_token text, p_punch uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_emp uuid := public.emp_session_employee(p_token);
  v_last public.emp_clock;
begin
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required';
  end if;
  select * into v_last from public.emp_clock
   where employee_id = v_emp and voided_at is null
   order by at desc limit 1;
  if v_last.id is null or v_last.id <> p_punch then
    raise exception 'only_last_punch';
  end if;
  if public.emp_local_day(v_last.at) <> public.emp_local_day(now()) then
    raise exception 'only_today';
  end if;
  if exists (select 1 from public.emp_invoices
              where employee_id = v_emp
                and week_start = public.emp_week_start(public.emp_local_day(v_last.at))) then
    raise exception 'week_invoiced';
  end if;
  update public.emp_clock
     set voided_at = now(), void_reason = left(btrim(p_reason), 200)
   where id = p_punch;
end $$;

-- ── Payroll — recent weeks, the current rate, the invoices ──────────────────
-- One body, two doors: the employee's phone (by session token) and Rolando's
-- Team page (owner only).

create or replace function public.emp_payroll_for(p_emp uuid, p_weeks int)
returns json
language plpgsql stable security definer set search_path = public
as $$
declare
  v_this date := public.emp_week_start(public.emp_local_day(now()));
  v_weeks jsonb := '[]'::jsonb;
  w date;
begin
  for i in 0..greatest(1, least(coalesce(p_weeks, 8), 26)) - 1 loop
    w := v_this - (7 * i);
    v_weeks := v_weeks || (public.emp_week_calc(p_emp, w) || jsonb_build_object(
      'ended', (w + 6) < public.emp_local_day(now()),
      'invoice', (select to_jsonb(x) from (
          select id, number, status, total, minutes, sent_at, approved_at, paid_at
            from public.emp_invoices where employee_id = p_emp and week_start = w) x)));
  end loop;
  return json_build_object(
    'rate', public.emp_rate_on(p_emp, public.emp_local_day(now())),
    'weeks', v_weeks,
    'invoices', coalesce((select json_agg(i order by i.week_start desc)
       from public.emp_invoices i where i.employee_id = p_emp), '[]'::json));
end $$;
revoke execute on function public.emp_payroll_for(uuid, int) from public, anon, authenticated;

create or replace function public.emp_payroll(p_token text, p_weeks int default 8)
returns json
language plpgsql security definer set search_path = public, extensions
as $$
begin
  return public.emp_payroll_for(public.emp_session_employee(p_token), p_weeks);
end $$;

create or replace function public.emp_owner_payroll(p_employee uuid, p_weeks int default 8)
returns json
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if public.ws_role() is distinct from 'owner' then
    raise exception 'owner_only' using errcode = '42501';
  end if;
  return public.emp_payroll_for(p_employee, p_weeks);
end $$;

-- ── Employee: create (and send) the invoice for one finished week ──────────

create or replace function public.emp_invoice_create(p_token text, p_week date)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_emp uuid := public.emp_session_employee(p_token);
  v_week date := public.emp_week_start(p_week);
  v_calc jsonb;
  v_e public.emp_employees;
  v_inv public.emp_invoices;
begin
  if (v_week + 6) >= public.emp_local_day(now()) then
    raise exception 'week_not_finished';
  end if;
  if exists (select 1 from public.emp_invoices where employee_id = v_emp and week_start = v_week) then
    raise exception 'already_invoiced';
  end if;
  v_calc := public.emp_week_calc(v_emp, v_week);
  if jsonb_array_length(v_calc -> 'open_days') > 0 then
    raise exception 'missing_clock_out';
  end if;
  if (v_calc ->> 'missing_rate')::boolean then
    raise exception 'no_pay_rate';
  end if;
  if (v_calc ->> 'minutes')::int = 0 then
    raise exception 'no_hours';
  end if;
  select * into v_e from public.emp_employees where id = v_emp;
  insert into public.emp_invoices (employee_id, number, week_start, week_end, lines, minutes, total, from_name, bill_to)
  values (v_emp,
          coalesce((select max(number) from public.emp_invoices where employee_id = v_emp), 0) + 1,
          v_week, v_week + 6, v_calc -> 'days', (v_calc ->> 'minutes')::int, (v_calc ->> 'amount')::numeric,
          coalesce(nullif(v_e.invoice_from, ''), v_e.name), v_e.invoice_bill_to)
  returning * into v_inv;
  return to_json(v_inv);
end $$;
