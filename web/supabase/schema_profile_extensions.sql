-- Run in Supabase SQL editor after the base schema. Likes, albums, follows.
--
-- Optional one-time: mark all existing accounts as having seen the first-run welcome
-- (so the incomplete-profile nudge still works, and the welcome modal is skipped):
--   update public.profiles
--   set style_passport = coalesce(style_passport, '{}'::jsonb) || jsonb_build_object('sku_welcome_ack_at', '2020-01-01T00:00:00.000Z');
--
-- Tables

create table if not exists public.user_product_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  title text not null default '',
  brand text,
  price_text text,
  currency text default 'USD',
  image_url text,
  buy_url text,
  created_at timestamptz not null default now(),
  constraint user_product_likes_user_product unique (user_id, product_id)
);

create index if not exists user_product_likes_user_idx on public.user_product_likes (user_id);

create table if not exists public.user_albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists user_albums_user_idx on public.user_albums (user_id);

create table if not exists public.user_album_items (
  album_id uuid not null references public.user_albums (id) on delete cascade,
  like_id uuid not null references public.user_product_likes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (album_id, like_id)
);

-- RLS
alter table public.user_product_likes enable row level security;
alter table public.user_albums enable row level security;
alter table public.user_album_items enable row level security;

drop policy if exists "likes_select_own" on public.user_product_likes;
create policy "likes_select_own" on public.user_product_likes
  for select using (auth.uid() = user_id);
drop policy if exists "likes_insert_own" on public.user_product_likes;
create policy "likes_insert_own" on public.user_product_likes
  for insert with check (auth.uid() = user_id);
drop policy if exists "likes_delete_own" on public.user_product_likes;
create policy "likes_delete_own" on public.user_product_likes
  for delete using (auth.uid() = user_id);

drop policy if exists "albums_all_own" on public.user_albums;
create policy "albums_all_own" on public.user_albums
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "album_items_select" on public.user_album_items;
create policy "album_items_select" on public.user_album_items
  for select using (
    exists (select 1 from public.user_albums a where a.id = album_id and a.user_id = auth.uid())
  );
drop policy if exists "album_items_insert" on public.user_album_items;
create policy "album_items_insert" on public.user_album_items
  for insert with check (
    exists (select 1 from public.user_albums a where a.id = album_id and a.user_id = auth.uid())
    and exists (select 1 from public.user_product_likes l where l.id = like_id and l.user_id = auth.uid())
  );
drop policy if exists "album_items_delete" on public.user_album_items;
create policy "album_items_delete" on public.user_album_items
  for delete using (
    exists (select 1 from public.user_albums a where a.id = album_id and a.user_id = auth.uid())
  );
