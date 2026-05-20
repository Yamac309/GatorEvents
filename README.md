# GatorEvents 🐊

I built this so UF students could see what's actually happening around Gainesville each week without scrolling through five different Instagram pages. It shows events on a satellite map of the city plus a chronological feed.

The fun source is the AI one — every six hours a cron job has Gemini 2.5 Flash do a real Google Search for current Gainesville events, then a second Gemini call structures the results into Supabase. The other two sources are a UF events RSS scraper and a public submission form that goes through an admin moderation queue. The whole thing is a PWA, so it installs on your phone home screen.

## Stack

React + Vite + Tailwind on the frontend. Leaflet with free Esri satellite tiles for the map. Express on Node 20+ for the API. Supabase (Postgres) for the database. Gemini 2.5 Flash with Google Search grounding for the live event discovery. Google Places API for autocomplete on the submit form. vite-plugin-pwa for the installable bits.

## What I had to figure out

**Gemini's grounding limitation.** Google Search grounding doesn't work with JSON mode in a single API call. Figured this out the hard way after a frustrating evening. So discovery runs in two stages: first call gets a written event summary from real Google results, second call parses that summary into structured rows. Code is in `server/services/gemini.js`.

**Keeping the frontend fast.** I didn't want the React app to ever block on a slow AI call, so the cron writes Gemini's output straight into the Postgres table and the frontend just reads from the DB. If Gemini gets rate-limited or fails, the last batch stays in place. Map never empties out.

**Map label collisions.** Multiple events at the same venue (looking at you, Bo Diddley Plaza) had their text labels stacking on top of each other. I added a function that detects same-coord events and spreads them in a small circle. Also Leaflet leaves tiles gray when the container resizes, so a ResizeObserver fires `invalidateSize` whenever the layout shifts.

**Admin hardening.** `/admin` is hidden from the public navigation. The login route has a 5-attempts-per-15-min IP lockout, a 200 ms artificial delay on every attempt, and refuses to accept weak passwords server-side. The admin dashboard lets you drag the map pin to fix wrong coordinates on auto-imported events.

## Running it locally

You need Node 20+, a free Supabase project, and a Gemini API key from aistudio.google.com.

```bash
git clone https://github.com/<your-username>/gatorevents.git
cd gatorevents
npm install
cp server/.env.example server/.env
# Fill in your keys in server/.env
# Then paste supabase/schema.sql into Supabase's SQL editor and run it
npm run dev
```

Frontend opens on http://localhost:5173, API on :3001.

## Environment variables

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Same page — the `service_role` secret key |
| `ADMIN_PASSWORD` | Pick your own, 8+ characters |
| `GEMINI_API_KEY` | aistudio.google.com (optional, but live discovery requires it) |
| `GOOGLE_PLACES_API_KEY` | Cloud Console (optional, powers the submit-form autocomplete) |

## Deploy

Wired for Vercel (client) and Render (server) on their free tiers — there's a `render.yaml` blueprint and a `client/vercel.json`. Push to GitHub, on Vercel point the root directory at `client`, on Render select Blueprint. Add the env vars in both dashboards, set `CLIENT_URL` on the server to your Vercel URL and `VITE_API_URL` on the client to your Render URL. About ten minutes total.

Render's free tier sleeps after 15 min idle, so the first request after a quiet period takes ~30 seconds to wake up.

## Known issues

- UF events RSS scraper started returning 403/DNS errors recently. UF must've changed their feed URL or started blocking generic user-agents.
- Gemini free tier caps at 20 requests/day per model. Enabling pay-as-you-go billing in Cloud Console fixes it for pennies a month.
- No user accounts yet. Anyone can submit, admin moderates everything.
