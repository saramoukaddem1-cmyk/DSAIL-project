-- Run in Supabase SQL editor. Past searches for /chat (persisted per user).
create table if not exists public.user_past_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_past_searches_user_updated_idx
  on public.user_past_searches (user_id, updated_at desc);

alter table public.user_past_searches enable row level security;

drop policy if exists "past_searches_select_own" on public.user_past_searches;
create policy "past_searches_select_own" on public.user_past_searches
  for select using (auth.uid() = user_id);

drop policy if exists "past_searches_insert_own" on public.user_past_searches;
create policy "past_searches_insert_own" on public.user_past_searches
  for insert with check (auth.uid() = user_id);

drop policy if exists "past_searches_update_own" on public.user_past_searches;
create policy "past_searches_update_own" on public.user_past_searches
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "past_searches_delete_own" on public.user_past_searches;
create policy "past_searches_delete_own" on public.user_past_searches
  for delete using (auth.uid() = user_id);
