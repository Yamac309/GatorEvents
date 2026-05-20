-- Run this in the Supabase SQL editor to set up the GatorEvents schema

create table if not exists events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  category text check (category in ('party','food','campus','music','sports','discount','other')),
  date date,
  time text,
  location_name text,
  lat float,
  lng float,
  tags text[] default '{}',
  source text default 'user' check (source in ('user','uf_scraper','google_places','gemini')),
  status text default 'pending' check (status in ('pending','approved','rejected')),
  submitter_name text,
  submitter_email text,
  flagged boolean default false,
  created_at timestamptz default now()
);

-- Index for common queries
create index if not exists events_status_idx on events(status);
create index if not exists events_category_idx on events(category);
create index if not exists events_date_idx on events(date);
create index if not exists events_created_at_idx on events(created_at desc);

-- Row-level security: allow public reads on approved events
alter table events enable row level security;

drop policy if exists "Anyone can read approved events" on events;
create policy "Anyone can read approved events"
  on events for select
  using (status = 'approved');

-- Service key (server-side) bypasses RLS automatically
