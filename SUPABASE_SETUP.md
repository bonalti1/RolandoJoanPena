# Cloud backup & sync — one-time setup (~10 minutes)

Your dashboard works offline on its own. Follow these steps once to also back
everything up to **your own** Supabase database and sync it across every device
you sign in on. Do this **first on the device that currently has your data**
(so it uploads), then sign in on your phone/other computers to pull it down.

---

## 1. Create a free Supabase project
1. Go to **https://supabase.com** → **Start your project** → sign up (free).
2. **New project.** Give it a name (e.g. `rjp-dashboard`), set a strong database
   password (save it somewhere safe), pick the region closest to you.
3. Wait ~2 minutes while it provisions.

## 2. Create the data table
1. In your project, left sidebar → **SQL Editor** → **New query**.
2. Paste everything below and click **Run**. It should say *Success*.

```sql
-- One key-value table holding all your dashboard data.
create table if not exists public.app_state (
  user_id uuid not null references auth.users on delete cascade,
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Lock it down: each person can read/write only their own rows.
alter table public.app_state enable row level security;

create policy "app_state is private to its owner"
  on public.app_state for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Enable live cross-device sync for this table.
alter publication supabase_realtime add table public.app_state;
```

## 3. Get your two keys
1. Left sidebar → **Project Settings** (gear) → **API**.
2. Copy these two values:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — a long token under *Project API keys*
     (the `anon` / public one — **not** the `service_role` key)

> The anon key is safe to put in the app — it's meant to be public. Your login
> plus the security rule above are what actually protect your data.

## 4. Point the magic-link back to your site
1. Left sidebar → **Authentication** → **URL Configuration**.
2. Set **Site URL** to your Netlify address (e.g. `https://your-site.netlify.app`).
3. Add that same URL under **Redirect URLs** and save.

## 5. Add the keys to Netlify
1. In **Netlify** → your site → **Site configuration** → **Environment variables**.
2. Add two variables:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
3. **Redeploy:** Deploys → **Trigger deploy** → **Deploy site**.
   (Vite bakes these in at build time, so a redeploy is required.)

## 6. Sign in
1. Open your site. You'll now see a **Sign in** screen.
2. Tap **Continue with Google** (after step 8 below) — or **Prefer email?** to get
   a one-tap email link instead.
3. Your existing data uploads automatically. Repeat the sign-in on your phone
   and other computers — each one pulls everything down and stays in sync.

You can see the status and sign out any time under **Settings → Cloud backup**.

## 7. Turn on "Continue with Google" (one-tap sign-in)

The sign-in screen shows a **Continue with Google** button. To make it work you
enable Google as a provider once. (Until you do this, use **Prefer email?** to
sign in — that needs no extra setup.)

**A. Create Google OAuth credentials**
1. Go to **https://console.cloud.google.com** → create a project (or pick one).
2. Left menu → **APIs & Services** → **OAuth consent screen**. Choose **External**,
   fill in the app name (e.g. `RJP Dashboard`) and your email, save. Under
   **Audience**, add your own email as a **Test user** (or click **Publish app**).
3. **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized JavaScript origins:** add `https://rolandojoanpena.netlify.app`
   - **Authorized redirect URIs:** add your Supabase callback —
     `https://wwzsgfzfjykcvyoimwva.supabase.co/auth/v1/callback`
     (Project URL + `/auth/v1/callback`.)
   - Create, then copy the **Client ID** and **Client secret**.

**B. Enable Google in Supabase**
1. Supabase → **Authentication** → **Sign In / Providers** (or **Providers**) → **Google**.
2. Toggle it **on**, paste the **Client ID** and **Client secret**, **Save**.
3. Make sure **Authentication → URL Configuration → Redirect URLs** already lists
   `https://rolandojoanpena.netlify.app` (from step 4). Done.

No Netlify change is needed. From then on, **Continue with Google** signs you in
in one tap on any device.

---

## 8. (Optional) Sync journal voice recordings across devices

Text, titles, dates and summaries already sync. To also sync the **audio
recordings** themselves (so a note recorded on your phone plays back on your
computer), run this once in **SQL Editor → New query → Run**:

```sql
-- Private bucket for journal voice recordings
insert into storage.buckets (id, name, public)
values ('journal-audio', 'journal-audio', false)
on conflict (id) do nothing;

-- Each person can read/write only files inside their own user-id folder
create policy "own audio read"   on storage.objects for select to authenticated
  using (bucket_id = 'journal-audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own audio insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'journal-audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own audio update" on storage.objects for update to authenticated
  using (bucket_id = 'journal-audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own audio delete" on storage.objects for delete to authenticated
  using (bucket_id = 'journal-audio' and (storage.foldername(name))[1] = auth.uid()::text);
```

No Netlify change is needed — it uses the same keys. From then on, new
recordings upload automatically, and opening an entry on another device pulls
the audio down and caches it. (Recordings made before this was set up only
exist on the device they were made on.)

---

### Notes
- **What syncs:** all your tasks, non-negotiables, bills, bank, health numbers,
  DEXA values, family info, journal text & summaries, goals, settings, any
  photos/attachments saved in the app — and, once step 7 is done, journal
  voice recordings.
- **Free tier** is plenty for this — a personal dashboard uses a tiny fraction
  of the included database, storage and bandwidth.
