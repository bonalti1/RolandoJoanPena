# Rolando's Dashboard 💜

A personal life dashboard built for Rolando — tasks, bills, family, health and
more, all in one calm, customizable place. Built with **React + TypeScript +
Vite + Tailwind CSS v4**. No backend required for the core experience; all data
is stored privately in the browser.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into /dist
npm run preview  # preview the production build
```

## What's inside

| Page | What it does | Status |
| --- | --- | --- |
| **Tasks** | The "Alastair Method" — a master checklist plus a brain-dump list. Promote dumped ideas into real tasks. | ✅ Working |
| **Work list** | Weekly checklist split into **Home** and **Work**, one column per day. | ✅ Working |
| **Wishlist** | Side-by-side product comparison with price, star ratings, links and notes. | ✅ Working (manual) |
| **Payments** | The Excel replacement: bills down the side, Jan→Dec across the top, set amounts, click a cell to mark paid, live monthly/yearly totals + income. | ✅ Working |
| **Bank** | Track account balances by hand now; designed to drop in Plaid for live balances. | ✅ Working (manual) |
| **Calendar** | Month view with local events. | ✅ Working |
| **Health** | Weight log with trend line + records (doctor visits, labs, prescriptions) with file attachments. | ✅ Working |
| **Family** | Members & birthdays, upcoming-birthday reminders, appointments, medicine. | ✅ Working |
| **Ask AI** | Searches everything you've saved ("When did I…?"). Upgrades to full Claude conversation with an API key. | ✅ Working (local search) |
| **Notifications** | Upcoming events/appointments/birthdays in the next 30 days + browser alerts. | ✅ Working |
| **Settings** | Recolor the whole dashboard (presets + custom colors). Export/import a backup of all data. | ✅ Working |

## Architecture

- **`src/lib/store.ts`** — `useStore` hook persists every feature's state to
  `localStorage` (prefixed `jess:`), synced across tabs. This is the source of
  truth for the offline-first experience.
- **`src/lib/theme.tsx`** — theme provider that writes CSS variables to
  `:root`, so the entire UI recolors instantly from Settings.
- **`src/components/`** — `Sidebar`, shared `ui` primitives, icon set.
- **`src/pages/`** — one file per dashboard section.

## Deploy to Netlify

The app is configured to deploy to Netlify with serverless functions (see
`netlify.toml`).

1. Push this branch to GitHub (done).
2. In Netlify: **Add new site → Import from GitHub** and pick this repo.
   Build command and publish dir are auto-detected from `netlify.toml`
   (`npm run build` → `dist`).
3. Add the environment variable under **Site settings → Environment variables**:
   - `OPENAI_API_KEY` = your OpenAI secret key (required for "Ask AI")
   - `OPENAI_MODEL` = `gpt-4o-mini` (optional)
4. Deploy. The site is also an installable **PWA** — open it on a phone and
   choose "Add to Home Screen" to use it like a native app.

### Local development

```bash
npm run dev                 # UI only (AI falls back to local search)
npm i -g netlify-cli        # one-time
netlify dev                 # runs the app + the AI function together
```

## The AI assistant

- Browser builds a snapshot of saved data (`src/lib/ai.ts`) and POSTs it with
  the question to `/.netlify/functions/ask`.
- The function (`netlify/functions/ask.ts`) holds the API key and calls OpenAI.
  The key is **never** exposed to the browser.
- If the key isn't set or the function is unreachable, the UI gracefully falls
  back to an instant local search across the data.
- Provider is isolated in `callOpenAI()` so Claude/others can be added later
  without touching the frontend.

## Roadmap — connected services

These are built with clean integration points so they drop in when ready:

1. **AI assistant (OpenAI)** — ✅ wired now via Netlify function. Just add the key.
2. **Bank (Plaid)** — live balances and "deposited last month". Add a Plaid
   account + a `netlify/functions/plaid-*` function alongside the existing one.
3. **Google Calendar** — two-way sync via Google's API / OAuth.
4. **Apple Health / Garmin** — import weight, activity and labs into the Health
   page (HealthKit export or Garmin Connect API).
5. **Phone push notifications** — web push / email reminders + a daily
   scheduler, feeding off the existing Notifications list.
6. **Live product search** for the Wishlist — ✅ wired via the `product-search`
   function. Add `RAPIDAPI_KEY` (RapidAPI "Real-Time Product Search") to turn on
   type-to-search with live prices/ratings; paste-a-link auto-fill and AI
   pros/cons + "help me decide" already work with no extra key.

## Privacy

All data lives in the browser's `localStorage` on the device. Nothing is sent
anywhere until a connected service is explicitly added. Use **Settings →
Export backup** to save a copy.
