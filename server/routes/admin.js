import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../services/supabase.js';

const router = Router();

const JWT_SECRET = () => process.env.JWT_SECRET || process.env.ADMIN_PASSWORD || 'dev-secret';

// =====================================================================
// Brute-force protection — in-memory rate limit per IP.
//   5 failed login attempts within 15 min → 1-hour lockout.
//   Memory-resident; cleared on server restart (fine for portfolio scale).
// =====================================================================
const loginAttempts = new Map(); // ip -> { count, firstFail, lockedUntil }
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 60 * 60 * 1000;

// Periodically prune stale entries so the Map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now - (entry.lockedUntil || entry.firstFail) > LOCKOUT_MS) {
      loginAttempts.delete(ip);
    }
  }
}, 10 * 60 * 1000).unref?.();

function clientIp(req) {
  return (req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown').trim();
}

function isLockedOut(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry?.lockedUntil) return null;
  const remaining = entry.lockedUntil - Date.now();
  if (remaining <= 0) {
    loginAttempts.delete(ip);
    return null;
  }
  return Math.ceil(remaining / 60000); // minutes
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstFail > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstFail: now });
    return;
  }
  entry.count++;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
}

// Middleware: verify admin JWT
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, JWT_SECRET());
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// POST /api/admin/login — strict, rate-limited, no default password
router.post('/login', async (req, res) => {
  const ip = clientIp(req);

  // 1. Locked out?
  const lockedMinutes = isLockedOut(ip);
  if (lockedMinutes) {
    return res.status(429).json({
      error: `Too many failed attempts. Try again in ${lockedMinutes} minute${lockedMinutes !== 1 ? 's' : ''}.`,
    });
  }

  // 2. Server must have a real password set — refuse to accept default/weak values
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected === 'changeme' || expected === 'replace-with-any-long-random-string' || expected.length < 8) {
    return res.status(503).json({
      error: 'Admin not configured. Set a strong ADMIN_PASSWORD (>= 8 chars) in server/.env.',
    });
  }

  // 3. Slight delay (200ms) on EVERY attempt to make brute-force impractical
  await new Promise((r) => setTimeout(r, 200));

  const { password } = req.body || {};
  if (!password || password !== expected) {
    recordFailedLogin(ip);
    return res.status(401).json({ error: 'Incorrect password' });
  }

  // Success — clear any prior failures for this IP
  loginAttempts.delete(ip);
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET(), { expiresIn: '24h' });
  res.json({ token });
});

// GET /api/admin/events — all pending events, plus recently approved
router.get('/events', requireAdmin, async (req, res) => {
  try {
    const { data: pending, error: e1 } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (e1) throw e1;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent, error: e2 } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'approved')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    if (e2) throw e2;

    res.json({ pending, recent });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/admin/events/:id — approve, reject, or edit any field
router.patch('/events/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['status', 'title', 'description', 'category', 'date', 'time', 'location_name', 'tags', 'lat', 'lng', 'flagged'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
