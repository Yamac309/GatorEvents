import { useState, useRef } from 'react';
import { submitEvent, fetchPlacesAutocomplete } from '../lib/api.js';

const CATEGORIES = ['party', 'food', 'campus', 'music', 'sports', 'discount', 'other'];
const CAT_LABELS = { party: 'Party', food: 'Food & Drink', campus: 'Campus', music: 'Music', sports: 'Sports', discount: 'Discount', other: 'Other' };

const INPUT_CLS = "w-full border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-uf-blue focus:border-transparent";

export default function Submit() {
  const [form, setForm] = useState({
    title: '',
    category: 'party',
    date: '',
    time: '',
    location_name: '',
    description: '',
    submitter_name: '',
    submitter_email: '',
  });
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleLocationInput(val) {
    update('location_name', val);
    clearTimeout(debounceRef.current);
    if (val.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const { predictions } = await fetchPlacesAutocomplete(val);
        setSuggestions(predictions || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 350);
  }

  function pickSuggestion(pred) {
    update('location_name', pred.description);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitEvent({ ...form, ...coords });
      setSuccess(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center bg-gray-900">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-lg font-bold text-gray-100 mb-2">Thanks! Your event is under review.</h2>
        <p className="text-sm text-gray-400 mb-6 max-w-xs">
          It'll appear on GatorEvents once an admin approves it — usually within a few hours.
        </p>
        <button
          onClick={() => { setSuccess(false); setForm({ title: '', category: 'party', date: '', time: '', location_name: '', description: '', submitter_name: '', submitter_email: '' }); }}
          className="bg-uf-blue text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-900 transition-colors"
        >
          Submit another event
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="px-5 py-3.5 border-b border-gray-800">
        <div className="text-sm font-semibold text-gray-100">Submit an event</div>
        <div className="text-xs text-gray-500 mt-0.5">Goes to admin review first</div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">Event title *</label>
          <input
            required
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. Free pizza at Reitz Union..."
            className={INPUT_CLS}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => update('category', cat)}
                className={`text-xs px-3.5 py-1.5 rounded-full border transition-colors font-medium
                  ${form.category === cat
                    ? 'bg-uf-blue text-white border-uf-blue'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'}`}
              >
                {CAT_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Date</label>
            <input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Time</label>
            <input type="time" value={form.time} onChange={(e) => update('time', e.target.value)} className={INPUT_CLS} />
          </div>
        </div>

        <div className="relative">
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">Location</label>
          <div className="flex items-center gap-2 border border-gray-700 rounded-lg px-3 py-2 bg-gray-800 focus-within:ring-2 focus-within:ring-uf-blue focus-within:border-transparent">
            <svg viewBox="0 0 24 24" fill="none" stroke="#FA4616" strokeWidth="2" className="w-4 h-4 shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <input
              value={form.location_name}
              onChange={(e) => handleLocationInput(e.target.value)}
              onFocus={() => suggestions.length && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Search address or place name..."
              className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
            />
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
              {suggestions.slice(0, 5).map((pred) => (
                <button
                  key={pred.place_id}
                  type="button"
                  onMouseDown={() => pickSuggestion(pred)}
                  className="w-full text-left px-3 py-2.5 text-xs hover:bg-gray-700 border-b border-gray-700 last:border-0"
                >
                  <span className="font-medium text-gray-100">{pred.structured_formatting?.main_text || pred.description}</span>
                  {pred.structured_formatting?.secondary_text && (
                    <span className="text-gray-400 ml-1">{pred.structured_formatting.secondary_text}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Tell students what to expect — entry requirements, cost, vibe..."
            className={`${INPUT_CLS} resize-none`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Your name</label>
            <input value={form.submitter_name} onChange={(e) => update('submitter_name', e.target.value)} placeholder="Optional" className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Email</label>
            <input type="email" value={form.submitter_email} onChange={(e) => update('submitter_email', e.target.value)} placeholder="Optional" className={INPUT_CLS} />
          </div>
        </div>

        <div className="flex gap-2 bg-amber-900/30 border border-amber-800/40 rounded-lg px-3 py-2.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" className="w-4 h-4 mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-xs text-amber-200">
            Your submission goes to an admin for review before it appears publicly. Usually approved within a few hours.
          </span>
        </div>

        {error && (
          <div className="text-xs text-red-300 bg-red-900/40 border border-red-800/50 rounded-lg px-3 py-2">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting || !form.title.trim()}
          className="w-full bg-uf-orange text-white font-semibold text-sm py-3 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting…' : 'Submit for review'}
        </button>
      </form>
    </div>
  );
}
