import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import eventsRouter from './routes/events.js';
import adminRouter from './routes/admin.js';
import placesRouter from './routes/places.js';
import { runUFScraper } from './scrapers/ufScraper.js';
import { refreshGeminiEventsInDB } from './services/gemini.js';

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

app.use('/api/events', eventsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/places', placesRouter);

app.get('/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// UF scraper every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('[cron] Running UF Events scraper...');
  try { await runUFScraper(); } catch (e) { console.error('[cron]', e.message); }
});

// Gemini live discovery every 6 hours — checks Google for new Gainesville
// events and replaces source='gemini' rows in Supabase. Offset by 30 minutes
// from the UF scraper so the two API-heavy jobs don't fight each other.
cron.schedule('30 */6 * * *', async () => {
  console.log('[cron] Refreshing Gemini live event discovery...');
  await refreshGeminiEventsInDB();
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\nGatorEvents API running on http://localhost:${PORT}`);
  console.log('Admin password set:', !!process.env.ADMIN_PASSWORD);
  console.log('Gemini key set:', !!process.env.GEMINI_API_KEY);
  console.log('Supabase configured:', !!process.env.SUPABASE_URL);

  // Refresh Gemini events into the DB on startup so the map is always populated
  // when the server boots (no slow first-load while Gemini is queried).
  if (process.env.GEMINI_API_KEY) {
    setTimeout(() => {
      console.log('[startup] Refreshing Gemini event discovery into DB...');
      refreshGeminiEventsInDB();
    }, 500);
  }
});
