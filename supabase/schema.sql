-- Linger database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run again: it only creates what's missing and refreshes the rules.

-- ---------- Tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '' check (char_length(name) <= 40),
  home_base text not null default '' check (char_length(home_base) <= 60),
  tz text not null default 'Europe/Copenhagen',
  currency text not null default 'USD',
  color int not null default 0,
  prep jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  place text not null default '' check (char_length(place) <= 60),
  cover int not null default 0,
  join_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  locked_option uuid,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.spots (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  note text not null default '',
  hours text not null default '',
  cost text not null default '',
  website text not null default '',
  maps text not null default '',
  position int not null default 0,
  locked boolean not null default false,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  spot_id uuid not null references public.spots on delete cascade,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  trip_id uuid not null references public.trips on delete cascade,
  primary key (spot_id, user_id)
);

create table if not exists public.inspo (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  board text not null default 'places' check (board in ('places', 'photo')),
  url text not null default '',
  image_path text not null default '',
  title text not null default '',
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  kind text not null default 'Other',
  name text not null check (char_length(name) between 1 and 100),
  url text not null default '',
  details text not null default '',
  price numeric,
  currency text not null default 'EUR',
  booked_by uuid references auth.users on delete set null,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.date_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  start_date date not null,
  end_date date not null,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trips_locked_option_fkey') then
    alter table public.trips add constraint trips_locked_option_fkey
      foreign key (locked_option) references public.date_options (id) on delete set null;
  end if;
end $$;

create table if not exists public.availability (
  option_id uuid not null references public.date_options on delete cascade,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  trip_id uuid not null references public.trips on delete cascade,
  status text not null check (status in ('yes', 'maybe', 'no')),
  primary key (option_id, user_id)
);

create table if not exists public.rsvps (
  trip_id uuid not null references public.trips on delete cascade,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  status text not null check (status in ('going', 'maybe', 'no')),
  primary key (trip_id, user_id)
);

create table if not exists public.costs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  what text not null check (char_length(what) between 1 and 80),
  amount numeric not null check (amount > 0),
  currency text not null default 'EUR',
  paid_by uuid references auth.users on delete set null,
  split_between uuid[] not null default '{}',
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 40),
  tz text not null,
  phone text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists spots_trip on public.spots (trip_id);
create index if not exists votes_trip on public.votes (trip_id);
create index if not exists inspo_trip on public.inspo (trip_id);
create index if not exists links_trip on public.links (trip_id);
create index if not exists dates_trip on public.date_options (trip_id);
create index if not exists avail_trip on public.availability (trip_id);
create index if not exists costs_trip on public.costs (trip_id);
create index if not exists members_user on public.trip_members (user_id);

-- ---------- Helper functions ----------
create or replace function public.is_member(t uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.trip_members where trip_id = t and user_id = auth.uid());
$$;

create or replace function public.shares_trip(other uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.trip_members a join public.trip_members b on a.trip_id = b.trip_id
    where a.user_id = auth.uid() and b.user_id = other);
$$;

create or replace function public.create_trip(p_name text, p_place text, p_cover int)
returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  insert into public.trips (name, place, cover, created_by)
    values (trim(p_name), coalesce(trim(p_place), ''), coalesce(p_cover, 0), auth.uid())
    returning id into tid;
  insert into public.trip_members (trip_id, user_id, role) values (tid, auth.uid(), 'planner');
  return tid;
end $$;

create or replace function public.join_trip(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  select id into tid from public.trips where join_code = lower(trim(p_code));
  if tid is null then raise exception 'That invite link is not valid anymore'; end if;
  insert into public.trip_members (trip_id, user_id) values (tid, auth.uid()) on conflict do nothing;
  return tid;
end $$;

create or replace function public.trip_preview(p_code text)
returns table (name text, place text, members int)
language sql security definer stable set search_path = public as $$
  select t.name, t.place, (select count(*)::int from public.trip_members m where m.trip_id = t.id)
  from public.trips t where t.join_code = lower(trim(p_code));
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row-level security: only your crew sees your trips ----------
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.spots enable row level security;
alter table public.votes enable row level security;
alter table public.inspo enable row level security;
alter table public.links enable row level security;
alter table public.date_options enable row level security;
alter table public.availability enable row level security;
alter table public.rsvps enable row level security;
alter table public.costs enable row level security;
alter table public.contacts enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_trip(id));
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "trips read" on public.trips;
create policy "trips read" on public.trips for select to authenticated using (public.is_member(id));
drop policy if exists "trips update" on public.trips;
create policy "trips update" on public.trips for update to authenticated using (public.is_member(id)) with check (public.is_member(id));
drop policy if exists "trips delete" on public.trips;
create policy "trips delete" on public.trips for delete to authenticated using (created_by = auth.uid());

drop policy if exists "members read" on public.trip_members;
create policy "members read" on public.trip_members for select to authenticated using (public.is_member(trip_id));
drop policy if exists "members leave" on public.trip_members;
create policy "members leave" on public.trip_members for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.trips t where t.id = trip_id and t.created_by = auth.uid()));

do $$
declare tbl text;
begin
  foreach tbl in array array['spots', 'inspo', 'links', 'date_options', 'costs'] loop
    execute format('drop policy if exists "crew all" on public.%I', tbl);
    execute format('create policy "crew all" on public.%I for all to authenticated using (public.is_member(trip_id)) with check (public.is_member(trip_id))', tbl);
  end loop;
  foreach tbl in array array['votes', 'availability', 'rsvps'] loop
    execute format('drop policy if exists "crew read" on public.%I', tbl);
    execute format('create policy "crew read" on public.%I for select to authenticated using (public.is_member(trip_id))', tbl);
    execute format('drop policy if exists "own write" on public.%I', tbl);
    execute format('create policy "own write" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(trip_id))', tbl);
  end loop;
end $$;
-- the "own write" policy also allows reading your own rows; "crew read" covers the rest

drop policy if exists "contacts own" on public.contacts;
create policy "contacts own" on public.contacts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Photo uploads for Inspo ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspo', 'inspo', true, 6291456, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'])
on conflict (id) do nothing;

drop policy if exists "inspo upload by crew" on storage.objects;
create policy "inspo upload by crew" on storage.objects for insert to authenticated
  with check (bucket_id = 'inspo' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "inspo delete own" on storage.objects;
create policy "inspo delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'inspo' and owner = auth.uid());
