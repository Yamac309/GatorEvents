import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();
const PLACES_KEY = () => process.env.GOOGLE_PLACES_API_KEY;
const UF_LAT = 29.6516;
const UF_LNG = -82.3248;

// GET /api/places/autocomplete?input=...
// Used by the Submit form's location field — does NOT touch the events table.
router.get('/autocomplete', async (req, res) => {
  const { input } = req.query;
  if (!input || !PLACES_KEY()) return res.json({ predictions: [] });

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&location=${UF_LAT},${UF_LNG}&radius=10000&key=${PLACES_KEY()}`;
    const r = await fetch(url);
    const json = await r.json();
    res.json({ predictions: json.predictions || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/places/nearby — stateless lookup of nearby venues.
// IMPORTANT: this used to auto-insert every venue into the events table as an
// "approved event", which polluted the feed with restaurants/bars that had no
// actual events. The map view no longer calls this. Kept as a stateless helper
// for potential future use; never writes to the DB.
router.get('/nearby', async (req, res) => {
  const { lat = UF_LAT, lng = UF_LNG, radius = 3000 } = req.query;
  if (!PLACES_KEY()) return res.json([]);

  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=bar|restaurant|night_club|event_venue&key=${PLACES_KEY()}`;
    const r = await fetch(url);
    const json = await r.json();
    const places = (json.results || []).slice(0, 20).map((p) => ({
      title: p.name,
      location_name: p.name,
      lat: p.geometry?.location?.lat || null,
      lng: p.geometry?.location?.lng || null,
      source: 'google_places',
    }));
    res.json(places);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
