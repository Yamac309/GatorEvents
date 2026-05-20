import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabase.js';

let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

const SYSTEM_PROMPT =
  'You are an event categorization assistant for a UF Gainesville student app. ' +
  'Given this event data, return JSON with: ' +
  'category (one of: party, food, campus, music, sports, discount, other), ' +
  'tags (array of 2-3 short strings like "Free", "21+", "Student discount", "BYOB", "Outdoor"), ' +
  'is_inappropriate (boolean).';

const ALLOWED_CATEGORIES = ['party','food','campus','music','sports','discount','other'];

const FALLBACK = (event) => ({
  category: event.category || 'other',
  tags: [],
  is_inappropriate: false,
});

// Hard timeout — a slow or hung Gemini call must never block an event submission.
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// --- Categorization / moderation for a single submitted event ---
export async function analyzeEvent(event) {
  if (!genAI) return FALLBACK(event);

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `${SYSTEM_PROMPT}\n\nEvent:\n${JSON.stringify({
      title: event.title,
      description: event.description || '',
      category: event.category || '',
      location: event.location_name || '',
    })}`;

    const result = await withTimeout(model.generateContent(prompt), 8000);
    const parsed = JSON.parse(result.response.text());

    return {
      category: parsed.category || 'other',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : [],
      is_inappropriate: Boolean(parsed.is_inappropriate),
    };
  } catch (e) {
    console.error('[gemini] Error:', e.message);
    return FALLBACK(event);
  }
}

// =====================================================================
// Live event discovery — Gemini + Google Search grounding.
// Two-step pipeline (grounding doesn't compose with JSON-mode):
//   1. Grounded model: Google-searches the web for current Gainesville
//      events and returns a narrative summary with citations.
//   2. Structuring model: turns that narrative into a strict JSON array
//      matching our event schema (approx coords, category, tags).
// Cached in-memory (30 min) to avoid hammering the API.
// =====================================================================
const DISCOVER_TTL_MS = 30 * 60 * 1000;
let discoverCache = { ts: 0, data: [] };
// Dedup concurrent callers — first request kicks off the Gemini pipeline,
// subsequent simultaneous callers await the same in-flight promise instead
// of triggering parallel Gemini calls.
let discoverInFlight = null;

function safeParseJsonArray(text) {
  let cleaned = String(text || '').trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export async function discoverGainesvilleEvents() {
  if (!genAI) return [];

  // Serve from cache while fresh
  if (Date.now() - discoverCache.ts < DISCOVER_TTL_MS && discoverCache.data.length) {
    return discoverCache.data;
  }

  // Already discovering? Share the same Promise so we make ONE Gemini call.
  if (discoverInFlight) return discoverInFlight;

  discoverInFlight = (async () => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // -------- Step 1: grounded search ---------
    const groundedModel = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      tools: [{ googleSearch: {} }],
    });

    const narrativePrompt =
`Use Google Search to find AT LEAST 15 real, current events happening in Gainesville, Florida between ${today} and 7 days from now.

PRIORITY — find events from each of these categories. A balanced spread is essential:

1. UF GATORS ATHLETICS (MUST HAVE if any are scheduled) — search "Florida Gators schedule this week", "UF softball schedule", "UF baseball schedule", "UF football schedule", "UF basketball schedule". Include any sport currently in season: softball, baseball, football, basketball, soccer, volleyball, lacrosse, swimming, tennis, gymnastics, golf, track.

2. Live music — concerts at Heartwood Soundstage, Bo Diddley Plaza, The Wooly, High Dive, Loosey's, midtown bars. Search "Gainesville concerts this week".

3. UF campus events — lectures, career fairs, club meetings, theater/dance performances, lecture series. Search "UF events calendar" / "events.ufl.edu".

4. Student / Greek life — fraternity & sorority parties, mixers, philanthropy events, dorm/club events. Search "UF Greek events", "midtown Gainesville parties".

5. Food deals — restaurant specials for UF students this week (Burrito Bros, Satchel's, Reggae Shack, Gators Dockside, etc).

6. Arts & culture — Hippodrome Theatre shows, Harn Museum events, gallery openings.

7. Community — Bo Diddley Plaza events, Free Fridays, Depot Park events, festivals, charity runs.

Search broadly; cast a wide net. Aim for at least 2 sports events if any UF team is playing, and at least 2 live music events.

For each event, list:
- Event name (specific, e.g. "Gators Softball vs. Vanderbilt", not just "softball game")
- Exact venue (e.g., "Katie Seashole Pressly Stadium", "Heartwood Soundstage", "Bo Diddley Plaza")
- Date (YYYY-MM-DD)
- Time (e.g., "8:00 PM" or "All day")
- 1-sentence description
- Best category: party / food / campus / music / sports / discount / other
- 2-3 short tags (e.g., "Free", "Student discount", "21+", "Outdoor", "Live music", "Ticketed")

Only include events you can verify via search. Quality > quantity but include MORE than fewer when in doubt.`;

    // Grounded search is slow — Gemini runs real Google queries (~25-40s typical)
    const narrative = await withTimeout(
      groundedModel.generateContent(narrativePrompt),
      55000
    );
    const narrativeText = narrative.response.text();
    if (!narrativeText || narrativeText.length < 50) {
      return discoverCache.data;
    }

    // -------- Step 2: structure the narrative into JSON ---------
    const structureModel = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const structurePrompt =
`Convert the event list below into a JSON object with key "events" containing an array.
Each event must be exactly:
{
  "title": string (specific event name),
  "description": string (1 short sentence),
  "location_name": string (venue name in Gainesville),
  "lat": number (latitude near 29.65 — pick plausible coords for the venue),
  "lng": number (longitude near -82.32 — pick plausible coords),
  "date": "YYYY-MM-DD",
  "time": string ("8:00 PM" / "All day" / etc.),
  "category": one of "party" | "food" | "campus" | "music" | "sports" | "discount" | "other",
  "tags": array of up to 3 short strings
}

Coordinate hints for well-known Gainesville venues:
- UF main campus: 29.6481, -82.3437
- Bo Diddley Plaza (downtown): 29.6520, -82.3247
- Heartwood Soundstage: 29.6515, -82.3327
- Reitz Union: 29.6463, -82.3478
- Ben Hill Griffin Stadium ("The Swamp", football): 29.6500, -82.3486
- Katie Seashole Pressly Stadium (UF softball): 29.6360, -82.3675
- Florida Ballpark (UF baseball, Condron Family Ballpark): 29.6428, -82.3520
- O'Connell Center (basketball/volleyball/gymnastics): 29.6494, -82.3503
- James G. Pressly Stadium (UF soccer/lacrosse): 29.6353, -82.3673
- Stephen C. O'Connell Center: 29.6494, -82.3503
- Florida Pool (UF swimming): 29.6371, -82.3676
- Hippodrome Theatre: 29.6519, -82.3251
- Harn Museum of Art: 29.6358, -82.3711
- Sweetwater Wetlands Park: 29.5946, -82.3093
- Dave & Buster's Butler Plaza: 29.6253, -82.3825
- Mid-town bars (W University Ave): 29.6520, -82.3408
- The Wooly: 29.6519, -82.3252
- High Dive: 29.6519, -82.3250
- Depot Park: 29.6428, -82.3247
For unfamiliar venues, use 29.6516, -82.3248 (downtown Gainesville).

Output only the JSON object, no markdown.

Event list to convert:
${narrativeText}`;

    const structured = await withTimeout(
      structureModel.generateContent(structurePrompt),
      25000
    );
    const structuredText = structured.response.text();

    // Try the structured object first; fall back to bare-array parse
    let raw = [];
    try {
      const obj = JSON.parse(structuredText);
      if (Array.isArray(obj)) raw = obj;
      else if (Array.isArray(obj?.events)) raw = obj.events;
    } catch {
      raw = safeParseJsonArray(structuredText);
    }

    // Stable content-hash id so the same event keeps the same id across refetches
    // (otherwise React remounts every marker and Leaflet flickers).
    const hashId = (s) => {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
      return `gem-${(h >>> 0).toString(36)}`;
    };

    const normalized = raw
      .filter((e) => e && e.title && e.lat != null && e.lng != null)
      .slice(0, 15)
      .map((e, idx) => ({
        id: hashId(`${e.title}|${e.date || ''}|${e.location_name || ''}|${idx}`),
        title: String(e.title).slice(0, 140),
        description: String(e.description || '').slice(0, 500),
        location_name: String(e.location_name || ''),
        lat: parseFloat(e.lat),
        lng: parseFloat(e.lng),
        date: typeof e.date === 'string' ? e.date.slice(0, 10) : null,
        time: typeof e.time === 'string' ? e.time : null,
        category: ALLOWED_CATEGORIES.includes(e.category) ? e.category : 'other',
        tags: Array.isArray(e.tags)
          ? e.tags.slice(0, 4).map((t) => String(t).slice(0, 32))
          : [],
        source: 'gemini',
        status: 'approved',
        flagged: false,
      }))
      .filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lng));

    if (normalized.length === 0) {
      // Don't poison the cache with an empty result — keep prior data if any
      console.warn('[gemini discover] Got 0 events after structuring; keeping prior cache');
      return discoverCache.data;
    }

    discoverCache = { ts: Date.now(), data: normalized };
    console.log(`[gemini discover] cached ${normalized.length} live events`);
    return normalized;
  } catch (e) {
    console.error('[gemini discover] Error:', e.message);
    return discoverCache.data;
  }
  })();

  try {
    return await discoverInFlight;
  } finally {
    discoverInFlight = null;
  }
}

// Periodic refresh: call Gemini, then replace the source='gemini' rows in
// Supabase with the new batch. This makes /api/events the single source of
// truth — Map and Feed just query the DB, no slow Gemini call in the request
// path. Called from the 6-hour cron and once on server startup.
//
// Failure modes are intentional:
//  • Gemini quota exhausted → discoverGainesvilleEvents returns [] →
//    we KEEP the prior DB rows (no destructive delete).
//  • Gemini returns events → atomic-ish replace of source='gemini' rows.
export async function refreshGeminiEventsInDB() {
  try {
    const events = await discoverGainesvilleEvents();
    if (!Array.isArray(events) || events.length === 0) {
      console.log('[gemini refresh] 0 events back (quota or transient) — keeping prior DB rows.');
      return { inserted: 0, skipped: true };
    }

    // Strip the in-memory hash IDs — let Supabase mint UUIDs.
    const rows = events.map(({ id, ...rest }) => rest);

    const { error: delErr } = await supabase.from('events').delete().eq('source', 'gemini');
    if (delErr) throw delErr;

    const { data, error: insErr } = await supabase.from('events').insert(rows).select('id');
    if (insErr) throw insErr;

    console.log(`[gemini refresh] DB updated — ${data.length} events.`);
    return { inserted: data.length, skipped: false };
  } catch (e) {
    console.error('[gemini refresh] Error:', e.message);
    return { inserted: 0, skipped: true, error: e.message };
  }
}
