-- ============================================================================
-- OS BOT ACTIVITY — what each bot is doing right now (pestaña "Oficina")
-- ============================================================================
-- NOT applied yet (Bonalti bot applies it). Safe to re-run.
--
--   os_bot_activity  One row each time a bot reports its status through the
--                    `bot` function's `set_status` action:
--                    bot      — the bot key (bonalti, grok, scheduling, …)
--                    status   — 'working' | 'idle' | 'paused'
--                    activity — short text: what it is doing
--
-- Private to its owner exactly like the other os_* tables. app_state and its
-- policies are not touched.

create table if not exists public.os_bot_activity (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  bot         text not null check (char_length(btrim(bot)) between 1 and 60),
  status      text not null check (status in ('working', 'idle', 'paused')),
  activity    text not null default '' check (char_length(activity) <= 500),
  created_at  timestamptz not null default now()
);
create index if not exists os_bot_activity_user_bot_time
  on public.os_bot_activity (user_id, bot, created_at desc);

alter table public.os_bot_activity enable row level security;

drop policy if exists "os_bot_activity is private to its owner" on public.os_bot_activity;
create policy "os_bot_activity is private to its owner"
  on public.os_bot_activity for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.os_bot_activity from anon;
grant select, insert, update, delete on public.os_bot_activity to authenticated;
grant select, insert, update, delete on public.os_bot_activity to service_role;

-- Live updates in the app
do $$
begin
  begin
    alter publication supabase_realtime add table public.os_bot_activity;
  exception when duplicate_object then null;
  end;
end $$;
