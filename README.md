<div align="center">

# 🐊 GatorEvents

**AI-powered event discovery for UF students & Gainesville locals.**

Pulls live events around campus from Google via Gemini, lets students submit their own (with admin moderation), and shows it all on a satellite map of Gainesville.

[Live demo](#) · [Quick start](#-quick-start) · [Architecture](#-architecture) · [Engineering highlights](#-engineering-highlights)

![React](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node-20+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?logo=google&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

## ✨ What it does

GatorEvents answers one question: **"What's happening around UF this week?"**

It surfaces real events — UF Gators home games, concerts at Heartwood Soundstage, free yoga at Bo Diddley Plaza, restaurant deals, campus lectures, dorm parties — pulled from three independent sources and merged into one feed:

1. **Live AI discovery** — every 6 hours a `node-cron` job has Gemini 2.5 Flash do a real Google Search for events happening in the next 7 days. Returned events are categorized, tagged, and persisted to Postgres.
2. **User submissions** — anyone can submit an event via a public form; it goes to admin review before publishing.
3. **UF Events scraper** — pulls the official UF events RSS feed and auto-approves it.

Everything renders on a **dark, mobile-first PWA** with an Esri satellite map of Gainesville, two-color pin scheme (UF orange for social/music/sports, UF blue for everything else), and an admin dashboard with a drag-to-fix map for correcting wrong coordinates.

## 📸 Screenshots

> Add your captures to `docs/screenshots/` — see `docs/screenshots/README.md` for the recommended set.

<!-- Once you have screenshots, drop them in like:
| Feed | Map | Submit |
|---|---|---|
| ![Feed](docs/screenshots/feed.png) | ![Map](docs/screenshots/map.png) | ![Submit](docs/screenshots/submit.png) |
-->

## 🧠 Engineering highlights

The interesting parts (worth reading if you're a recruiter or eng manager):

- **Two-step Gemini pipeline** — Google Search grounding doesn't compose with JSON-mode in the Gemini API, so the discovery pipeline runs in two stages: (1) grounded model produces a narrative summary with citations, (2) a separate model with `responseMimeType: 'application/json'` structures the narrative into typed event rows. See [`server/services/gemini.js`](server/services/gemini.js).
- **Graceful degradation** — every Gemini call is wrapped in a `Promise.race` timeout (8s for tagging, 55s for discovery) and a try/catch that returns the prior DB cache. If Gemini is down, rate-limited, or just slow, the map still renders the last good batch. The user never sees a broken state.
- **In-flight de-duplication** — concurrent callers of the discovery pipeline share a single in-progress Promise so we never burn API quota on parallel duplicate requests.
- **DB-as-cache architecture** — discovered events are written to Supabase rather than held in memory. Server restarts don't lose data, the front-end never blocks on a slow AI call, and `/api/events` is the single source of truth.
- **Satellite map without paid tiles** — uses Esri World Imagery + Esri Reference labels overlay (no API key needed) for the satellite-with-street-names look.
- **Map quirks handled** — overlapping pins at identical venues auto-spread in a small circle so the bubble labels don't collide; `ResizeObserver` fires `map.invalidateSize()` on layout changes to fix the classic Leaflet gray-tile bug.
- **Hardened admin login** — IP-based rate limit (5 attempts / 15 min → 1-hour lockout), 200 ms artificial delay on every attempt, refuses to accept default/weak passwords, JWT with 24-hour expiry, admin link hidden from public navigation.
- **Installable PWA** — `vite-plugin-pwa` generates a Workbox service worker, the manifest precaches map tiles + last-fetched events for offline shell, and maskable SVG icons render cleanly across iOS/Android/desktop install flows.

## 🛠 Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 18 · Vite 5 · React Router 6 · Tailwind CSS 3 · Leaflet · Inter font |
| Backend | Node 20+ · Express 4 · `node-cron` · JWT |
| Database | Supabase (Postgres) with row-level-security policies |
| AI | Google Gemini 2.5 Flash with Google Search grounding |
| Geo | Esri World Imagery (satellite tiles) · Google Places API (autocomplete) |
| PWA | `vite-plugin-pwa` · Workbox · manifest + maskable icons |
| Hosting | Vercel (client static) · Render (Express + cron) |

## 🏗 Architecture

```
                       ┌──────────────────────────────┐
                       │   client (Vite + React PWA)  │
                       │   ─ Feed                     │
                       │   ─ Map (Leaflet + Esri)     │
                       │   ─ Submit                   │
                       │   ─ Admin (hidden, JWT)      │
                       └──────────────┬───────────────┘
                                      │  /api/*
                                      ▼
                       ┌──────────────────────────────┐
                       │   server (Express + cron)    │
                       │   ─ /events       (public)   │
                       │   ─ /places       (public)   │
                       │   ─ /admin/login  (rate ltd) │
                       │   ─ /admin/*      (JWT)      │
                       └──┬──────────┬────────────┬───┘
                          │          │            │
                          ▼          ▼            ▼
                   ┌──────────┐  ┌──────┐   ┌──────────┐
                   │ Supabase │  │Gemini│   │ Places   │
                   │ Postgres │  │ 2.5  │   │ Autocom- │
                   │ + RLS    │  │Flash │   │ plete    │
                   └──────────┘  └──────┘   └──────────┘
                          ▲           │
                          │ upsert    │ Google Search grounding
                          └───────────┘ every 6h cron + on startup
```

## 🚀 Quick start

**Prerequisites:** Node 20+, free Supabase account, free Gemini API key from [Google AI Studio](https://aistudio.google.com).

```bash
# 1 — Clone & install everything (root postinstall installs client + server too)
git clone https://github.com/YOUR_USERNAME/gatorevents.git
cd gatorevents
npm install

# 2 — Configure environment
cp server/.env.example server/.env
# Open server/.env and fill in SUPABASE_URL, SUPABASE_SERVICE_KEY,
# GEMINI_API_KEY, and a strong ADMIN_PASSWORD (≥ 8 chars).

# 3 — Create the database table
# In your Supabase dashboard → SQL Editor → New query →
# paste the contents of  supabase/schema.sql  → Run.

# 4 — Start both frontend + backend in one command
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The admin dashboard lives at [`/admin`](http://localhost:5173/admin) (the nav link is intentionally hidden — log in with the password from your `.env`).

## 🔑 Environment variables

Required:

| Variable | Source | What it does |
|---|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → "Project URL" | Database connection |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → `service_role` secret | Server-side DB writes (bypasses RLS) |
| `ADMIN_PASSWORD` | You pick. **Use ≥ 8 chars, unique.** Default rejected. | Admin dashboard login |

Optional (each feature degrades gracefully when blank):

| Variable | What unlocks |
|---|---|
| `GEMINI_API_KEY` | Live event discovery + auto-categorization + content moderation on submissions |
| `GOOGLE_PLACES_API_KEY` | Location autocomplete on the submit form |
| `JWT_SECRET` | If unset, falls back to `ADMIN_PASSWORD` (fine for dev — set explicitly in production) |
| `CLIENT_URL` | CORS origin for the client (default `http://localhost:5173`) |
| `PORT` | Server port (default `3001`) |

## 🗂 Project layout

```
gatorevents/
├── client/                    React + Vite PWA
│   ├── public/                Favicon, PWA icons (SVG, designed)
│   └── src/
│       ├── pages/             Feed, Map, Submit, Admin, AdminLogin
│       ├── components/        Sidebar, FilterBar, EventCard
│       └── lib/               api.js (fetch helpers), constants.js
│
├── server/                    Express API + cron jobs
│   ├── routes/                events.js, admin.js, places.js
│   ├── services/              supabase.js, gemini.js (the AI pipeline)
│   ├── scrapers/              ufScraper.js
│   └── index.js               Boot + cron registration
│
├── supabase/
│   └── schema.sql             Table + indexes + RLS policies (idempotent)
│
├── docs/screenshots/          README screenshots
├── render.yaml                Render blueprint for backend deploy
├── client/vercel.json         Vercel rewrites for SPA routing
└── README.md
```

## 🚢 Deploy live

The repo is wired for **Render (server) + Vercel (client)** — both free-tier-compatible.

### Backend → Render
1. Push the repo to GitHub.
2. On [render.com](https://render.com): **New + → Blueprint**, select the repo. Render auto-detects `render.yaml`.
3. In the env vars panel, paste each value from your `.env`.
4. Note the deployed URL, e.g. `https://gatorevents-api.onrender.com`.

### Frontend → Vercel
1. On [vercel.com](https://vercel.com): **Add New → Project**, import the repo.
2. Set **Root Directory** to `client` (Vercel auto-detects Vite from `vercel.json`).
3. Add env var: `VITE_API_URL` = your Render URL (no trailing slash).
4. Deploy. Copy the Vercel URL.

### Wire them together
- Back on Render, set `CLIENT_URL` = your Vercel URL (for CORS) → save → service redeploys.
- That's it — the live URL goes on your resume.

> Note: Render's free tier sleeps after 15 min idle, so the first request after a dry spell takes ~30 s to wake up. Fine for a portfolio demo.

## 🔄 How the 6-hour refresh works

- A `node-cron` schedule (`30 */6 * * *` — offset from the UF scraper so the two API-heavy jobs don't fight) calls `refreshGeminiEventsInDB()`.
- That function runs the two-step Gemini pipeline → atomically replaces all `source='gemini'` rows in Supabase with the new batch.
- The client's `Map.jsx` and `Feed.jsx` use the same `loadRef`-pattern: they re-fetch on mount, on filter change, every 6 hours via `setInterval`, AND whenever the browser tab regains focus (`visibilitychange`).
- If Gemini is down or rate-limited, the refresh quietly skips the destructive delete — last good batch stays in DB.

## 🔐 Admin hardening

`/admin` is **hidden from public navigation** (no nav link). To reach it you have to know the URL. Even then, login is gated by:

- 200 ms artificial delay on every attempt (kills brute-force throughput)
- Per-IP rate limit: 5 failed attempts within 15 min → 1-hour lockout
- Server refuses to start the login flow if `ADMIN_PASSWORD` is unset, default (`changeme`), or shorter than 8 chars
- JWT signed with `JWT_SECRET`, 24-hour expiry, required on every `/admin/*` route except `/login`

Tradeoff worth naming: this is the right level for a portfolio. For real production, swap the password check for Supabase Auth with an email allowlist.

## 🗺 Roadmap

- [ ] Email allowlist via Supabase Auth (replace password-only admin)
- [ ] User accounts: save favorites, RSVP, personalized recommendations
- [ ] Push notifications via Firebase Cloud Messaging
- [ ] Embedding-based event similarity ("more like this")
- [ ] iOS / Android wrappers via Capacitor (the PWA already covers most of it)

## 📄 License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

Built as a full-stack portfolio project. Made with `react`, `express`, `supabase`, and a lot of Gemini API debugging.

</div>
