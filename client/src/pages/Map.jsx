import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import FilterBar from '../components/FilterBar.jsx';
import { fetchEvents } from '../lib/api.js';
import { CATEGORY_COLORS, PIN_GROUPS, UF_CENTER } from '../lib/constants.js';

// Colored bubble marker showing the event title
function makeIcon(color, label) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};color:white;padding:4px 11px;
      border-radius:99px;font-size:11px;font-weight:600;
      white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,0.45);
      border:2px solid rgba(255,255,255,0.45);
      font-family: Inter, system-ui, sans-serif;
    ">${label}</div>`,
    iconAnchor: [0, 0],
  });
}

// If multiple events share the same venue (rounded to ~10 m precision),
// spread them in a small circle so their text bubbles don't overlap.
// 1 deg latitude ≈ 111 km; 0.0005 deg ≈ 55 m radius.
function spreadOverlaps(events) {
  const groups = new Map();
  for (const ev of events) {
    const key = `${Number(ev.lat).toFixed(4)},${Number(ev.lng).toFixed(4)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ev);
  }
  const result = [];
  const radius = 0.0006;
  for (const grp of groups.values()) {
    if (grp.length === 1) {
      result.push(grp[0]);
      continue;
    }
    grp.forEach((ev, i) => {
      const angle = (i / grp.length) * 2 * Math.PI;
      result.push({
        ...ev,
        lat: ev.lat + radius * Math.cos(angle),
        lng: ev.lng + radius * Math.sin(angle),
      });
    });
  }
  return result;
}

// Fixes the gray-map bug — invalidate Leaflet's internal size whenever the
// container resizes (sidebar shows/hides, window resize, layout shift).
function MapResize() {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    const initialT = setTimeout(invalidate, 80);
    const ro = new ResizeObserver(invalidate);
    ro.observe(map.getContainer());
    window.addEventListener('resize', invalidate);
    return () => {
      clearTimeout(initialT);
      ro.disconnect();
      window.removeEventListener('resize', invalidate);
    };
  }, [map]);
  return null;
}

// Show only events happening in the next 7 days (or undated recurring events).
function isThisWeek(dateStr) {
  if (!dateStr) return true;
  const target = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(target.getTime())) return true;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((target - today) / (1000 * 60 * 60 * 24));
  return diffDays >= -1 && diffDays <= 7;
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export default function MapView() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [activeFilter, setActiveFilter] = useState({ label: 'All', value: 'all', filter: null, category: null });
  const [selectedEvent, setSelectedEvent] = useState(null);

  const loadRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (activeFilter.category) params.category = activeFilter.category;
      if (activeFilter.filter) params.filter = activeFilter.filter;
      const data = await fetchEvents(params);
      const filtered = (data || []).filter(
        (e) => e && e.lat && e.lng && isThisWeek(e.date)
      );
      setEvents(filtered);
      setLastRefreshed(new Date());
    } catch {
      // fail silently — map still renders prior pins
    } finally {
      setLoading(false);
    }
  }
  loadRef.current = load;

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeFilter]);

  useEffect(() => {
    const refresh = () => loadRef.current?.();
    const onVisible = () => { if (!document.hidden) refresh(); };
    const interval = setInterval(refresh, SIX_HOURS_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Spread overlapping pins so bubble labels don't collide.
  const displayedEvents = useMemo(() => spreadOverlaps(events), [events]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
        <div>
          <div className="text-sm font-semibold text-gray-100">Events this week</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Gainesville & UF campus
            {lastRefreshed && ` · updated ${lastRefreshed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            title="Refresh now"
            className="text-xs text-gray-400 hover:text-gray-100 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
          >
            ↻
          </button>
          <span className="text-xs text-gray-300 bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-md">
            {loading && events.length === 0 ? '…' : `${events.length} events`}
          </span>
        </div>
      </div>

      <FilterBar active={activeFilter.value} onChange={setActiveFilter} />

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 relative">
          <MapContainer
            center={UF_CENTER}
            zoom={14}
            className="h-full w-full"
            zoomControl={true}
          >
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
            <TileLayer
              attribution=""
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
              opacity={0.85}
            />
            <MapResize />

            {displayedEvents.map((ev) => (
              <Marker
                key={ev.id}
                position={[ev.lat, ev.lng]}
                icon={makeIcon(
                  CATEGORY_COLORS[ev.category] || '#0021A5',
                  ev.title.length > 22 ? ev.title.slice(0, 20) + '…' : ev.title
                )}
                eventHandlers={{ click: () => setSelectedEvent(ev) }}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <div className="font-semibold text-gray-100 text-sm mb-1">{ev.title}</div>
                    {ev.location_name && (
                      <div className="text-xs text-gray-400 mb-1">📍 {ev.location_name}</div>
                    )}
                    {ev.date && (
                      <div className="text-xs text-gray-400">
                        🗓 {new Date(ev.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {ev.time ? ` · ${ev.time}` : ''}
                      </div>
                    )}
                    {ev.tags?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2">
                        {ev.tags.map((t) => (
                          <span key={t} className="text-xs px-2 py-0.5 bg-gray-700 rounded-full text-gray-200">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          <div className="absolute bottom-3 left-3 z-[1000] bg-gray-900/90 backdrop-blur border border-gray-700 rounded-lg px-3 py-2 flex flex-col gap-1.5 text-xs text-gray-300 shadow-lg">
            {PIN_GROUPS.map(({ color, label }) => (
              <span key={label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="w-52 border-l border-gray-800 bg-gray-900 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-800 text-xs text-gray-500">
            {loading && events.length === 0 ? 'Loading…' : `${events.length} events this week`}
          </div>
          <div className="flex-1 overflow-y-auto">
            {events.map((ev) => (
              <div
                key={ev.id}
                onClick={() => setSelectedEvent(ev)}
                className={`px-3 py-3 border-b border-gray-800 cursor-pointer transition-colors
                  ${selectedEvent?.id === ev.id ? 'bg-uf-blue/30' : 'hover:bg-gray-800'}`}
              >
                <div className="text-xs font-semibold text-gray-100 mb-0.5 truncate">{ev.title}</div>
                <div className="text-xs text-gray-500 truncate">
                  {ev.time ? `${ev.time}` : ''}{ev.time && ev.location_name ? ' · ' : ''}{ev.location_name || ''}
                </div>
                {ev.tags?.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {ev.tags.slice(0, 2).map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 bg-gray-800 rounded-full text-gray-400">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!loading && events.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-gray-500">
                No events this week.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
