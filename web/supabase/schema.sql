-- Run this in the Supabase SQL editor (Dashboard → SQL) after creating a project.
-- Smouk: profiles + product catalog + RLS.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  username text not null,
  phone text,
  style_passport jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_unique unique (username)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  brand text,
  category text,
  price_cents int not null,
  currency text not null default 'USD',
  sizes text[],
  image_url text,
  in_stock boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category);
create index if not exists products_brand_idx on public.products (brand);

alter table public.profiles enable row level security;
alter table public.products enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "products_read_auth" on public.products;
create policy "products_read_auth" on public.products
  for select to authenticated using (true);

-- Create profile when a new auth user is created (works even if email confirmation is on).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, username, phone, style_passport)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1)),
    nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), ''),
    '{}'::jsonb
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seed sample products (replace or extend later)
insert into public.products (title, description, brand, category, price_cents, currency, sizes, in_stock)
values
  ('Linen blend shirt', 'Relaxed fit, breathable linen blend.', 'North & Co.', 'tops', 8900, 'USD', array['XS','S','M','L'], true),
  ('High-rise straight jeans', 'Vintage wash, rigid denim.', 'River Denim', 'bottoms', 12800, 'USD', array['24','26','28','30','32'], true),
  ('Leather loafers', 'Minimal apron toe, leather sole.', 'Atelier Step', 'shoes', 19500, 'USD', array['6','7','8','9','10'], true),
  ('Wool crewneck', 'Fine merino, ribbed cuffs.', 'North & Co.', 'tops', 11000, 'USD', array['S','M','L','XL'], true),
  ('Pleated midi skirt', 'Pressed pleats, side zip.', 'Lumen', 'bottoms', 7600, 'USD', array['XS','S','M','L'], true),
  ('Canvas tote', 'Structured carryall, reinforced handles.', 'Field Goods', 'accessories', 4800, 'USD', array['ONE'], true)
;

-- Per-user saved ASOS brands ("brand portfolio")
create table if not exists public.user_brand_portfolio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_name text not null,
  created_at timestamptz not null default now(),
  constraint user_brand_portfolio_user_brand_unique unique (user_id, brand_name)
);

create index if not exists user_brand_portfolio_user_idx on public.user_brand_portfolio (user_id);

alter table public.user_brand_portfolio enable row level security;

drop policy if exists "portfolio_select_own" on public.user_brand_portfolio;
create policy "portfolio_select_own" on public.user_brand_portfolio
  for select using (auth.uid() = user_id);

drop policy if exists "portfolio_insert_own" on public.user_brand_portfolio;
create policy "portfolio_insert_own" on public.user_brand_portfolio
  for insert with check (auth.uid() = user_id);

drop policy if exists "portfolio_delete_own" on public.user_brand_portfolio;
create policy "portfolio_delete_own" on public.user_brand_portfolio
  for delete using (auth.uid() = user_id);
