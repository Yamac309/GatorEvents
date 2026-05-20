// In dev, VITE_API_URL is empty so calls are relative ('/api') and use the Vite proxy.
// In production, set VITE_API_URL to the deployed backend origin (e.g. https://gatorevents-api.onrender.com).
const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Events
export const fetchEvents = (params = {}) =>
  request(`/events?${new URLSearchParams(params)}`);

export const submitEvent = (body) =>
  request('/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// Places
export const fetchPlacesAutocomplete = (input) =>
  request(`/places/autocomplete?${new URLSearchParams({ input })}`);

export const fetchNearbyPlaces = (lat, lng) =>
  request(`/places/nearby?${new URLSearchParams({ lat, lng })}`);

// Live discovery — Gemini + Google Search grounding picks current Gainesville events
export const fetchDiscoveredEvents = () => request('/events/discover');

// Admin
export const adminLogin = (password) =>
  request('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

export const fetchAdminEvents = (token) =>
  request('/admin/events', { headers: authHeaders(token) });

export const updateEvent = (id, updates, token) =>
  request(`/admin/events/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(updates),
  });
