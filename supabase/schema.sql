-- AeroFocus account storage. Run this once in the Supabase SQL editor.
-- Every table is keyed by user_id with owner-only row-level security.
-- Only the email (in auth.users), flights and stats are stored.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  booking_id text not null,
  state text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.stamps (
  user_id uuid not null references auth.users (id) on delete cascade,
  iata text not null,
  visits integer not null,
  first_at bigint not null,
  last_at bigint not null,
  primary key (user_id, iata)
);

create index if not exists bookings_user on public.bookings (user_id);
create index if not exists sessions_user on public.sessions (user_id);

alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.sessions enable row level security;
alter table public.stamps enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'bookings', 'sessions', 'stamps'] loop
    execute format('drop policy if exists "owner only" on public.%I', t);
    execute format(
      'create policy "owner only" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
