# Getting it working — setup & integration checklist

## 0. Deploy it (pick one)

**A — Instant, drag-and-drop (no serverless functions).**
Drop the contents of `/dist` on <https://app.netlify.com/drop>. The whole app
works offline on your device. Integrations (Calendar/Bank/AI) do NOT run on a
drop deploy.

**B — Connect the repo (recommended — enables integrations + auto-deploy).**
1. Netlify → **Add new site → Import an existing project → GitHub**.
2. Pick `bonalti1/RolandoJoanPena`, branch `claude/personal-dashboard-setup-bicgs2`.
   Build command `npm run build`, publish dir `dist` (auto-filled from `netlify.toml`).
3. Deploy. Every push now redeploys automatically, and serverless functions run.

## 1. Install on your phone (2 min)
Open the site URL → iPhone: Share → **Add to Home Screen**. Android: menu → **Install app**.
It runs like a native app, full-screen, offline.

## 2. How storage works (read this once)
- **Text data** (tasks, bills, goals, health metrics, journal text, family) → browser
  `localStorage`, ~5 MB. Plenty for years of text.
- **Recordings + DEXA files** → browser **IndexedDB**, much larger (100s of MB+).
- Data lives **on the device/browser you use** — it is NOT synced across devices yet.
- **Back it up:** Settings → **Export backup** (downloads a JSON). Do this weekly.
  **Import backup** restores it, or moves it to another device.
- Don't "Clear site data" or delete the installed app without exporting first.

## 3. Works with ZERO setup (usable tomorrow, one device)
Home + non-negotiables, Tasks, Work list, Payments, Bank (manual), Calendar (local
events), Health (weight, body-fat, DEXA manual entry + file upload), Family + ideas,
Journal (voice recording + live transcription + summaries), Notifications (browser),
Settings + themes + backup.

## 4. Environment variables (set in Netlify → Site configuration → Environment variables)
| Variable | Turns on | Status |
| --- | --- | --- |
| `OPENAI_API_KEY` | DEXA scan auto-read (Health) | ✅ built — works once set |
| `GOOGLE_CLIENT_ID` (+ OAuth) | Google Calendar sync | ⛔ not built yet |
| `PLAID_CLIENT_ID`, `PLAID_SECRET` | Live bank balances | ⛔ not built yet |
| `VAPID_PUBLIC_KEY` (+ scheduler) | Phone push notifications | ⛔ not built yet |

## 5. Integration checklist

### OpenAI — DEXA auto-read (real, ~10 min)
- [ ] Create a key at <https://platform.openai.com/api-keys>.
- [ ] Netlify → Environment variables → add `OPENAI_API_KEY`.
- [ ] Redeploy (Deploys → Trigger deploy). Health → upload a scan photo → **Auto-read**.
- Note: the Journal already transcribes in the browser for free; this key is only
  for reading DEXA scan images today.

### Google Calendar — not built yet (needs a small build)
Two ways to make it real:
- **Read-only import (fast):** paste your calendar's **secret iCal URL**
  (Google Calendar → Settings → your calendar → "Secret address in iCal format").
  A function fetches it and shows your events in the dashboard. One-way.
- **Two-way sync (bigger):** Google Cloud OAuth (consent screen + tokens). Lets the
  dashboard create events back. Needs a place to store tokens.
- To start the fast path, have the secret iCal URL ready and I'll wire it up.

### Bank (Plaid) — not built yet
- Manual balances work today. Live balances need a Plaid account
  (<https://dashboard.plaid.com>) + `PLAID_CLIENT_ID`/`PLAID_SECRET` + a build.

### Phone push notifications — not built yet
- In-app/browser reminders work today. True push-to-phone needs web-push keys +
  a daily scheduler (a build).

## Recommended for tomorrow
1. Deploy (Option B if you can — it unlocks everything later).
2. Install on your phone.
3. (Optional) Add `OPENAI_API_KEY` for DEXA auto-read.
4. Use Calendar/Bank manually for now.
5. Ask me to build the Google Calendar **read-only import** next — it's the fastest
   real integration and I can have it working quickly once the repo is connected.
