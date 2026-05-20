import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import AdminLogin from './AdminLogin.jsx';
import { fetchAdminEvents, updateEvent } from '../lib/api.js';
import { UF_CENTER } from '../lib/constants.js';

const CATEGORIES = ['party','food','campus','music','sports','discount','other'];
const ORANGE_CATS = ['party','music','sports'];

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-900/50 text-blue-200',
  'bg-amber-900/50 text-amber-200',
  'bg-green-900/50 text-green-200',
  'bg-purple-900/50 text-purple-200',
];
function avatarColor(name) {
  const i = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
}

// Map helper: ensure the mini-map re-measures after open and that the marker can be
// re-positioned by clicking elsewhere on the map (in addition to dragging the pin).
function MiniMapSetup({ onMapClick }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 80);
    const click = (e) => onMapClick(e.latlng.lat, e.latlng.lng);
    map.on('click', click);
    return () => { clearTimeout(t); map.off('click', click); };
  }, [map, onMapClick]);
  return null;
}

function DraggablePin({ position, onMove, color }) {
  const icon = L.divIcon({
    className: '',
    html: `<div style="
      background:${color};width:26px;height:26px;border-radius:50%;
      border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.55);
      cursor:grab;
    "></div>`,
    iconAnchor: [13, 13],
  });
  return (
    <Marker
      position={position}
      icon={icon}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const p = e.target.getLatLng();
          onMove(p.lat, p.lng);
        },
      }}
    />
  );
}

function EditPanel({ event, token, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: event.title || '',
    description: event.description || '',
    category: event.category || 'other',
    date: event.date || '',
    time: event.time || '',
    location_name: event.location_name || '',
    tags: (event.tags || []).join(', '),
    lat: event.lat != null ? Number(event.lat) : UF_CENTER[0],
    lng: event.lng != null ? Number(event.lng) : UF_CENTER[1],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const pinColor = ORANGE_CATS.includes(form.category) ? '#FA4616' : '#0021A5';

  const up = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setLatLng = (lat, lng) => setForm((f) => ({ ...f, lat, lng }));

  async function save(publish) {
    setSaving(true);
    setError(null);
    try {
      const updates = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        date: form.date || null,
        time: form.time || null,
        location_name: form.location_name.trim() || null,
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        ...(publish ? { status: 'approved' } : {}),
      };
      await updateEvent(event.id, updates, token);
      onSave();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-gray-950/60 border-t border-gray-800 px-5 py-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Title</label>
          <input value={form.title} onChange={(e) => up('title', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-uf-blue" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Date</label>
          <input type="date" value={form.date} onChange={(e) => up('date', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-uf-blue" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Time</label>
          <input value={form.time} onChange={(e) => up('time', e.target.value)} placeholder="8:00 PM"
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-uf-blue" />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Category</label>
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button key={cat} type="button" onClick={() => up('category', cat)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors
                  ${form.category === cat
                    ? 'bg-uf-blue text-white border-uf-blue'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Location name</label>
          <input value={form.location_name} onChange={(e) => up('location_name', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-uf-blue" />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</label>
          <textarea rows={2} value={form.description} onChange={(e) => up('description', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-uf-blue resize-none" />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Tags (comma-separated)</label>
          <input value={form.tags} onChange={(e) => up('tags', e.target.value)} placeholder="Free, 21+, Outdoor"
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-uf-blue" />
        </div>
      </div>

      {/* Drag-to-fix map */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
          Pin location — drag the marker (or click anywhere on the map) to fix it
          <span className="ml-2 text-gray-500 font-mono normal-case">
            {Number(form.lat).toFixed(4)}, {Number(form.lng).toFixed(4)}
          </span>
        </label>
        <div className="h-48 rounded-md overflow-hidden border border-gray-700">
          <MapContainer center={[form.lat, form.lng]} zoom={15} className="h-full w-full" zoomControl={false}>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              opacity={0.85}
              maxZoom={19}
            />
            <MiniMapSetup onMapClick={setLatLng} />
            <DraggablePin position={[form.lat, form.lng]} onMove={setLatLng} color={pinColor} />
          </MapContainer>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-300 bg-red-900/40 border border-red-800 rounded-md px-3 py-2">{error}</div>
      )}

      <div className="flex gap-2 flex-wrap pt-1">
        <button onClick={() => save(true)} disabled={saving}
          className="text-xs px-4 py-1.5 bg-uf-orange text-white font-semibold rounded-full hover:bg-orange-600 disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : '✓ Save & approve'}
        </button>
        <button onClick={() => save(false)} disabled={saving}
          className="text-xs px-4 py-1.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-full hover:bg-gray-700 disabled:opacity-50 transition-colors">
          Save (keep pending)
        </button>
        <button onClick={onCancel} disabled={saving}
          className="text-xs px-4 py-1.5 bg-transparent border border-gray-700 text-gray-500 rounded-full hover:text-gray-300 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

function EventRow({ event, token, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  async function act(status) {
    setLoading(true);
    try {
      await updateEvent(event.id, { status }, token);
      onUpdate();
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  const avColor = avatarColor(event.submitter_name || event.title);
  const sourceLabel =
    event.source === 'uf_scraper' ? 'UF Scraper'
    : event.source === 'google_places' ? 'Google Places'
    : event.source === 'gemini' ? 'Gemini live'
    : 'User';

  return (
    <div className={`border-b border-gray-800 ${loading ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3 px-5 py-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avColor}`}>
          {initials(event.submitter_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-gray-100 truncate">{event.title}</span>
            {event.flagged && (
              <span className="text-xs px-2 py-0.5 bg-red-900/40 text-red-300 border border-red-800/50 rounded-full shrink-0">⚠ Flagged</span>
            )}
            <span className="text-xs px-2 py-0.5 bg-amber-900/40 text-amber-200 border border-amber-800/40 rounded-full shrink-0">Pending</span>
          </div>
          <div className="text-xs text-gray-500 mb-2">
            {event.submitter_name ? `Submitted by ${event.submitter_name}` : 'Anonymous'} · {event.category} · {event.date || 'No date'}{event.time ? ` ${event.time}` : ''} · {sourceLabel}
          </div>
          {event.description && (
            <p className="text-xs text-gray-400 mb-2 line-clamp-2">{event.description}</p>
          )}
          {!editing && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => act('approved')} disabled={loading}
                className="text-xs px-3 py-1 bg-green-900/40 text-green-300 border border-green-800/50 rounded-full hover:bg-green-900/60 transition-colors">
                ✓ Approve
              </button>
              <button onClick={() => act('rejected')} disabled={loading}
                className="text-xs px-3 py-1 bg-red-900/40 text-red-300 border border-red-800/50 rounded-full hover:bg-red-900/60 transition-colors">
                ✕ Reject
              </button>
              <button onClick={() => setEditing(true)}
                className="text-xs px-3 py-1 bg-gray-800 border border-gray-700 text-gray-300 rounded-full hover:bg-gray-700 transition-colors">
                ✎ Edit details
              </button>
            </div>
          )}
        </div>
      </div>
      {editing && (
        <EditPanel
          event={event}
          token={token}
          onSave={() => { setEditing(false); onUpdate(); }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token'));
  const [data, setData] = useState({ pending: [], recent: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (token) load();
  }, [token]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchAdminEvents(token);
      setData(d);
    } catch (e) {
      if (e.message.includes('401') || e.message.toLowerCase().includes('unauthorized')) {
        localStorage.removeItem('admin_token');
        setToken(null);
      }
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(newToken) { setToken(newToken); }
  function handleLogout() { localStorage.removeItem('admin_token'); setToken(null); }

  if (!token) return <AdminLogin onLogin={handleLogin} />;

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
        <div>
          <div className="text-sm font-semibold text-gray-100">Admin review</div>
          <div className="text-xs text-gray-500 mt-0.5">Your moderation dashboard</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-xs text-gray-400 hover:text-gray-100 transition-colors px-2 py-1 rounded hover:bg-gray-800">
            ↻ Refresh
          </button>
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-gray-800">
            Sign out
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="m-4 p-3 bg-red-900/40 border border-red-800/50 rounded-lg text-xs text-red-300">{error}</div>
        )}

        <div className="px-5 py-2 bg-gray-950/60 border-b border-gray-800 text-xs text-gray-500">
          Pending review — {loading ? '…' : `${data.pending.length} submission${data.pending.length !== 1 ? 's' : ''} waiting`}
        </div>

        {!loading && data.pending.length === 0 && (
          <div className="px-5 py-12 text-center">
            <div className="text-3xl mb-2">✓</div>
            <p className="text-sm text-gray-400">All caught up! No pending submissions.</p>
          </div>
        )}

        {loading && <div className="px-5 py-8 text-center text-sm text-gray-500 animate-pulse">Loading…</div>}

        {data.pending.map((ev) => (
          <EventRow key={ev.id} event={ev} token={token} onUpdate={load} />
        ))}

        {data.recent.length > 0 && (
          <>
            <div className="px-5 py-2 bg-gray-950/60 border-b border-gray-800 text-xs text-gray-500 mt-2">
              Recently approved (last 24h)
            </div>
            {data.recent.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 px-5 py-3 border-b border-gray-800 opacity-60">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(ev.submitter_name || ev.title)}`}>
                  {initials(ev.submitter_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-gray-200 truncate">{ev.title}</span>
                    <span className="text-xs px-2 py-0.5 bg-green-900/40 text-green-300 border border-green-800/50 rounded-full shrink-0">Approved</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Approved {new Date(ev.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {ev.category}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
