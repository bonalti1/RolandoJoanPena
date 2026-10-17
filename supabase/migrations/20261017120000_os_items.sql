-- ============================================================================
-- OS ITEMS — what your AI bots leave in your OS
-- ============================================================================
-- NOT applied yet. Run it once in Supabase → SQL Editor → New query → Run
-- (or `supabase db push` with the Supabase CLI). Safe to re-run — and if
-- you ran an earlier version of this file, run the whole file again: it only
-- adds what's missing.
--
-- Small tables, each private to its owner exactly like app_state
-- (auth.uid() = user_id). app_state and its policies are not touched.
--
--   os_items         A task a bot created for you: title, notes, which bot,
--                    area (casa / trabajo / salud / familia), date, priority,
--                    status (abierta / hecha). Shows on Home under
--                    "De mis bots"; the 'casa' ones also on Home tasks.
--                    needs_me = true puts it under "Esperando por ti"
--                    instead: something only you can do or approve.
--
--   os_events        A dated event a bot sent (school, the kids' activities):
--                    shows on the Calendar and on Home that day.
--
--   os_nonneg_marks  A bot's tick on one of today's EXISTING non-negotiables
--                    ("hice gym"), by that non-negotiable's id in app_state
--                    ('home.nonneg'). It is never a copy of the list. The app
--                    folds the tick into your own checklist when it opens, so
--                    app_state keeps a single writer: the app.
--
--   os_tokens        Server-only: the Strava login the health sync keeps
--                    fresh. Strava replaces its refresh token as it goes, so
--                    the latest one has to live somewhere; the app and the
--                    browser can never read this table.
--
-- Bots never reach these tables directly. They call the `bot` Netlify
-- function, which holds the service key server-side and pins every query to
-- one user (BOT_USER_ID). See docs/BOT_API.md.
-- ---------------------------------------------------------------------------

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.os_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 300),
  notes       text not null default '' check (char_length(notes) <= 5000),
  -- Which bot created it ("telegram", "asistente-correo", …)
  bot         text not null check (char_length(btrim(bot)) between 1 and 60),
  area        text not null check (area in ('casa', 'trabajo', 'salud', 'familia')),
  due         date,
  priority    text not null default 'media' check (priority in ('baja', 'media', 'alta')),
  status      text not null default 'abierta' check (status in ('abierta', 'hecha')),
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists os_items_user_status_due on public.os_items (user_id, status, due);
-- Something only you can do or approve (a PR, a script, a purchase, a decision).
alter table public.os_items add column if not exists needs_me boolean not null default false;

create table if not exists public.os_nonneg_marks (
  user_id     uuid not null references auth.users on delete cascade,
  day         date not null,
  -- The id of a non-negotiable that already exists in app_state 'home.nonneg'
  nonneg_id   text not null check (char_length(nonneg_id) between 1 and 100),
  bot         text not null default '' check (char_length(bot) <= 60),
  created_at  timestamptz not null default now(),
  primary key (user_id, day, nonneg_id)
);

create table if not exists public.os_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 300),
  notes       text not null default '' check (char_length(notes) <= 5000),
  bot         text not null check (char_length(btrim(bot)) between 1 and 60),
  area        text not null default 'familia' check (area in ('casa', 'trabajo', 'salud', 'familia')),
  day         date not null,
  -- 24-hour "HH:MM", or empty for an all-day event
  start_time  text check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time    text check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  created_at  timestamptz not null default now()
);
create index if not exists os_events_user_day on public.os_events (user_id, day);

create table if not exists public.os_tokens (
  user_id       uuid not null references auth.users on delete cascade,
  provider      text not null check (provider in ('strava')),
  refresh_token text not null,
  access_token  text,
  expires_at    timestamptz,
  -- Which STRAVA_REFRESH_TOKEN these came from: a new one in Netlify wins.
  seed_hash     text not null default '',
  updated_at    timestamptz not null default now(),
  primary key (user_id, provider)
);

-- Keeps updated_at and done_at honest no matter who writes the row.
create or replace function public.os_items_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'hecha' then
    if tg_op = 'INSERT' then
      new.done_at := coalesce(new.done_at, now());
    elsif old.status is distinct from 'hecha' then
      new.done_at := now();
    end if;
  else
    new.done_at := null;
  end if;
  return new;
end $$;

drop trigger if exists os_items_stamp on public.os_items;
create trigger os_items_stamp
  before insert or update on public.os_items
  for each row execute function public.os_items_stamp();

-- ── Row Level Security: only you ────────────────────────────────────────────

alter table public.os_items        enable row level security;
alter table public.os_nonneg_marks enable row level security;
alter table public.os_events       enable row level security;
alter table public.os_tokens       enable row level security;

drop policy if exists "os_items is private to its owner" on public.os_items;
create policy "os_items is private to its owner"
  on public.os_items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "os_nonneg_marks is private to its owner" on public.os_nonneg_marks;
create policy "os_nonneg_marks is private to its owner"
  on public.os_nonneg_marks for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "os_events is private to its owner" on public.os_events;
create policy "os_events is private to its owner"
  on public.os_events for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- os_tokens gets no policy at all: with RLS on, only the service key (the
-- server functions) can read or write it.

-- Signed-in app: rows as allowed by the policies above. Not-signed-in
-- visitors: nothing at all. The bot function uses the service key.
revoke all on public.os_items, public.os_nonneg_marks, public.os_events, public.os_tokens from anon;
revoke all on public.os_tokens from authenticated;
grant select, insert, update, delete on public.os_items, public.os_nonneg_marks, public.os_events to authenticated;
grant select, insert, update, delete on public.os_items, public.os_nonneg_marks, public.os_events, public.os_tokens to service_role;

-- ── Live updates in the app (like app_state) ────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['os_items', 'os_nonneg_marks', 'os_events'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
