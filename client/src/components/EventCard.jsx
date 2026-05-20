import { CATEGORY_COLORS, CATEGORY_LABELS } from '../lib/constants.js';

const TAG_STYLES = {
  'Free':             'bg-green-900/40 text-green-300 border border-green-800/40',
  'Free entry':       'bg-green-900/40 text-green-300 border border-green-800/40',
  'Student discount': 'bg-blue-900/40 text-blue-300 border border-blue-800/40',
  'Student deal':     'bg-blue-900/40 text-blue-300 border border-blue-800/40',
  'UF Official':      'bg-blue-900/40 text-blue-300 border border-blue-800/40',
  'Student org':      'bg-purple-900/40 text-purple-300 border border-purple-800/40',
  '21+':              'bg-amber-900/40 text-amber-300 border border-amber-800/40',
  'BYOB':             'bg-amber-900/40 text-amber-300 border border-amber-800/40',
  'Outdoor':          'bg-green-900/40 text-green-300 border border-green-800/40',
};

function Tag({ label }) {
  const style = TAG_STYLES[label] || 'bg-gray-800 text-gray-300 border border-gray-700';
  return <span className={`text-xs px-2 py-0.5 rounded-full ${style}`}>{label}</span>;
}

export default function EventCard({ event, onClick }) {
  const color = CATEGORY_COLORS[event.category] || '#0021A5';
  const catLabel = CATEGORY_LABELS[event.category] || event.category || 'Event';

  const timeDisplay = event.time
    ? event.time
    : event.date
    ? new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'TBD';

  return (
    <div
      onClick={onClick}
      className="flex items-start gap-3 px-5 py-3.5 border-b border-gray-800 hover:bg-gray-800/40 cursor-pointer transition-colors"
    >
      <div
        className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
        style={{ background: color, boxShadow: `0 0 0 3px ${color}33` }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5 font-medium">
          {catLabel}
          {event.date && ` · ${new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}`}
        </div>
        <div className="text-sm font-semibold text-gray-100 truncate">{event.title}</div>
        {event.location_name && (
          <div className="text-xs text-gray-500 mt-0.5 truncate">📍 {event.location_name}</div>
        )}
        {event.tags?.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-1.5">
            {event.tags.map((t) => <Tag key={t} label={t} />)}
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs text-gray-400 whitespace-nowrap font-medium">{timeDisplay}</div>
        {event.source === 'uf_scraper' || event.source === 'gemini' || event.tags?.includes('Verified') ? (
          <div className="flex items-center justify-end gap-0.5 mt-1 text-green-400 text-xs">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {event.source === 'gemini' ? 'AI' : 'Verified'}
          </div>
        ) : null}
      </div>
    </div>
  );
}
