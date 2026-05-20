import { useEffect, useRef, useState } from 'react';
import FilterBar from '../components/FilterBar.jsx';
import EventCard from '../components/EventCard.jsx';
import { fetchEvents } from '../lib/api.js';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export default function Feed() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState({ label: 'All', value: 'all', filter: null, category: null });
  const [selected, setSelected] = useState(null);

  const loadRef = useRef(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (activeFilter.category) params.category = activeFilter.category;
      if (activeFilter.filter) params.filter = activeFilter.filter;
      const data = await fetchEvents(params);
      setEvents(Array.isArray(data) ? data : []);
      setLastRefreshed(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  loadRef.current = load;

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeFilter]);

  // Auto-refresh every 6 hours and whenever the tab is refocused so the user
  // always sees the latest server-cron-refreshed events without manual reload.
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

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
        <div>
          <div className="text-sm font-semibold text-gray-100">What's happening in Gainesville</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {loading ? 'Loading...' : `${events.length} event${events.length !== 1 ? 's' : ''} found`}
            {lastRefreshed && !loading && ` · updated ${lastRefreshed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            title="Refresh now"
            className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-700 transition-colors"
          >
            ↻
          </button>
          <button className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-700 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Search
          </button>
          <div className="w-8 h-8 rounded-full bg-uf-orange flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-4 h-4">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>
      </div>

      <FilterBar active={activeFilter.value} onChange={(chip) => setActiveFilter(chip)} />

      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="m-5 p-3 bg-red-900/40 border border-red-800/50 rounded-lg text-sm text-red-300">
            {error} — is the server running?
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <p className="text-sm font-medium text-gray-300">No events found</p>
            <p className="text-xs mt-1">Try a different filter or check back later</p>
          </div>
        )}

        {loading && events.length === 0 && (
          <div className="flex flex-col gap-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-4 border-b border-gray-800 animate-pulse">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-700 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="h-3 bg-gray-800 rounded w-1/4 mb-2" />
                  <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
                  <div className="flex gap-2">
                    <div className="h-4 bg-gray-800 rounded-full w-16" />
                    <div className="h-4 bg-gray-800 rounded-full w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {events.map((ev) => (
          <EventCard
            key={ev.id}
            event={ev}
            onClick={() => setSelected(selected?.id === ev.id ? null : ev)}
          />
        ))}
      </div>

      {selected && (
        <div className="border-t border-gray-800 bg-gray-950 p-5 shadow-2xl">
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-base font-bold text-gray-100">{selected.title}</h2>
            <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-200 text-xl leading-none">×</button>
          </div>
          {selected.location_name && (
            <p className="text-xs text-gray-400 mb-2">📍 {selected.location_name}</p>
          )}
          {selected.description && (
            <p className="text-sm text-gray-300 leading-relaxed mb-3">{selected.description}</p>
          )}
          <div className="flex gap-2 flex-wrap">
            {selected.tags?.map((t) => (
              <span key={t} className="text-xs px-2 py-0.5 bg-gray-800 rounded-full text-gray-300">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
