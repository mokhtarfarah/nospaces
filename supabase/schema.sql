-- Run this in your Supabase SQL editor (supabase.com → project → SQL editor)

-- Items table
create table if not exists public.items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  title             text not null,
  creator           text,
  type              text not null,
  year              integer,
  status            text not null default 'want_to' check (status in ('want_to', 'done')),
  reaction          text check (reaction in ('loved_it', 'liked_it', 'eh', 'not_for_me')),
  note              text,
  source            text not null default 'manual' check (source in ('share_sheet', 'quick_add', 'photo', 'email', 'manual')),
  source_detail     text,
  recommended_by    text,
  metadata          jsonb not null default '{}',
  tags              text[] not null default '{}',
  moods             text[] not null default '{}',
  date_added        timestamptz not null default now(),
  date_done         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Row-level security: users can only see and edit their own items
alter table public.items enable row level security;

create policy "Users can read own items"
  on public.items for select
  using (auth.uid() = user_id);

create policy "Users can insert own items"
  on public.items for insert
  with check (auth.uid() = user_id);

create policy "Users can update own items"
  on public.items for update
  using (auth.uid() = user_id);

create policy "Users can delete own items"
  on public.items for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- Useful indexes
create index items_user_id_date_added on public.items (user_id, date_added desc);
create index items_user_id_status on public.items (user_id, status);
create index items_type on public.items (type);

-- ---------------------------------------------------------------------------
-- Per-user preferences (synced across devices). One row per user; `prefs` is a
-- free-form JSON bag. Currently holds the "shows near you" custom city list
-- under prefs.cities = [{ name, lat, lng }, ...].
-- ---------------------------------------------------------------------------
create table if not exists public.user_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  prefs      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.user_prefs enable row level security;

create policy "Users can read own prefs"
  on public.user_prefs for select
  using (auth.uid() = user_id);

create policy "Users can insert own prefs"
  on public.user_prefs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own prefs"
  on public.user_prefs for update
  using (auth.uid() = user_id);

create trigger user_prefs_updated_at
  before update on public.user_prefs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- API rate limiting. One row per (user, endpoint, UTC-hour window).
-- The check_rate_limit() function atomically increments and returns the count.
-- Used by /api/identify (60/hr) and /api/recommend (10/hr).
-- ---------------------------------------------------------------------------
create table if not exists public.api_rate_limits (
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null,
  window_hour text not null,  -- "2026-06-05T14" (UTC)
  count      int not null default 0,
  primary key (user_id, endpoint, window_hour)
);

create or replace function public.check_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_window text,
  p_limit int
) returns int language plpgsql security definer as $$
declare
  v_count int;
begin
  insert into public.api_rate_limits (user_id, endpoint, window_hour, count)
  values (p_user_id, p_endpoint, p_window, 1)
  on conflict (user_id, endpoint, window_hour)
  do update set count = api_rate_limits.count + 1
  returning count into v_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Email capture log. One row per inbound forwarded email that produced NO new
-- library items — i.e. the silent cases the "for review" inbox can't show
-- (successful captures already appear there as items, so they are NOT logged).
-- Surfaced in-app via the "email captures" sheet so a forward that fell through
-- never vanishes without a trace. Written server-side by /api/email with the
-- service-role key (bypasses RLS); the SELECT policy lets the user read own.
-- ---------------------------------------------------------------------------
create table if not exists public.email_captures (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,  -- null if sender matched no account
  from_email   text,
  subject      text,
  outcome      text not null check (outcome in ('nothing_found', 'duplicates', 'error')),
  saved_count  int not null default 0,
  detail       text,                       -- error message / short note
  snippet      text,                        -- first ~400 chars of the body, to see what was sent
  created_at   timestamptz not null default now()
);

alter table public.email_captures enable row level security;

create policy "Users can read own email captures"
  on public.email_captures for select
  using (auth.uid() = user_id);

create policy "Users can delete own email captures"
  on public.email_captures for delete
  using (auth.uid() = user_id);

create index email_captures_user_id_created on public.email_captures (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Storage bucket for Things image cutouts (s74). Transparent-PNG subject
-- cutouts are generated browser-side at save (see src/lib/cutout.ts) and the
-- board renders them on a cream tile. Public read so a plain <img> can load
-- them; writes are scoped to each user's own folder ("<uid>/<itemId>.png").
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('thing-cutouts', 'thing-cutouts', true)
  on conflict (id) do nothing;

create policy "cutouts public read"
  on storage.objects for select
  using (bucket_id = 'thing-cutouts');

create policy "cutouts owner insert"
  on storage.objects for insert
  with check (bucket_id = 'thing-cutouts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "cutouts owner update"
  on storage.objects for update
  using (bucket_id = 'thing-cutouts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "cutouts owner delete"
  on storage.objects for delete
  using (bucket_id = 'thing-cutouts' and auth.uid()::text = (storage.foldername(name))[1]);
