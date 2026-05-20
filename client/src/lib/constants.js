// Two-color scheme: gator orange for social/fun, gator blue for everything else.
// Pins stay readable on the satellite map and the brand identity is consistent.
const ORANGE = '#FA4616';
const BLUE   = '#0021A5';

export const CATEGORY_COLORS = {
  party:    ORANGE,
  music:    ORANGE,
  sports:   ORANGE,
  food:     BLUE,
  campus:   BLUE,
  discount: BLUE,
  other:    BLUE,
};

export const PIN_GROUPS = [
  { color: ORANGE, label: 'Party · Music · Sports' },
  { color: BLUE,   label: 'Campus · Food · Discount · Other' },
];

export const CATEGORY_LABELS = {
  party:    'Party',
  food:     'Food & Drink',
  campus:   'Campus',
  music:    'Music',
  sports:   'Sports',
  discount: 'Discount',
  other:    'Other',
};

export const FILTER_CHIPS = [
  { label: 'All',         value: 'all',      filter: null,       category: null },
  { label: 'Parties',     value: 'party',    filter: null,       category: 'party' },
  { label: 'Food & Drink',value: 'food',     filter: null,       category: 'food' },
  { label: 'Free',        value: 'free',     filter: 'free',     category: null },
  { label: 'Sports',      value: 'sports',   filter: null,       category: 'sports' },
  { label: 'Campus',      value: 'campus',   filter: null,       category: 'campus' },
  { label: 'Tonight',     value: 'tonight',  filter: 'tonight',  category: null },
];

export const UF_CENTER = [29.6516, -82.3248];
