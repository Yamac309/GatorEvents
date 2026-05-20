import { Router } from 'express';
import { supabase } from '../services/supabase.js';
import { analyzeEvent, discoverGainesvilleEvents } from '../services/gemini.js';

const router = Router();

// GET /api/events — list approved events with optional filters
router.get('/', async (req, res) => {
  try {
    const { category, filter, limit = 100 } = req.query;

    let query = supabase
      .from('events')
      .select('*')
      .eq('status', 'approved')
      // Defensive: never surface stale google_places POI records as events.
      // Legitimate events use source 'user', 'uf_scraper', or 'gemini'.
      .neq('source', 'google_places')
      .order('date', { ascending: true, nullsFirst: false })
      .limit(parseInt(limit));

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (filter === 'tonight') {
      const today = new Date().toISOString().split('T')[0];
      query = query.eq('date', today);
    }

    if (filter === 'free') {
      query = query.contains('tags', ['Free']);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/events/discover — uses Gemini + Google Search grounding to fetch
// real events happening in Gainesville right now. Cached server-side (~30 min).
router.get('/discover', async (req, res) => {
  try {
    const events = await discoverGainesvilleEvents();
    res.json(events);
  } catch (e) {
    console.error('[/discover] Error:', e.message);
    res.json([]);
  }
});

// POST /api/events — user submits a new event (always pending)
router.post('/', async (req, res) => {
  try {
    const { title, description, category, date, time, location_name, lat, lng, submitter_name, submitter_email } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const analysis = await analyzeEvent({ title, description, category, location_name });

    const { data, error } = await supabase
      .from('events')
      .insert([{
        title: title.trim(),
        description: description?.trim() || null,
        category: analysis.category || category || 'other',
        date: date || null,
        time: time || null,
        location_name: location_name?.trim() || null,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        tags: analysis.tags || [],
        source: 'user',
        status: 'pending',
        flagged: analysis.is_inappropriate || false,
        submitter_name: submitter_name?.trim() || null,
        submitter_email: submitter_email?.trim() || null,
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, event: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
