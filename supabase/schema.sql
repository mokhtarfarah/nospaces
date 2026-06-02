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
