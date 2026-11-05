-- Wholesale inventory schema. Run once in Supabase: SQL Editor > New query > Run.
-- Safe to re-run.

create extension if not exists pgcrypto;

-- Admins: only users listed here can read or write products.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- A signed-in user may only see whether they themselves are an admin.
drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 200),
  -- جملة الجملة: supplier bulk price (what we pay)
  purchase_price numeric(12, 2) not null check (purchase_price >= 0),
  -- جملة: wholesale sale price
  wholesale_price numeric(12, 2) not null check (wholesale_price >= 0),
  -- مفرق: retail sale price
  retail_price numeric(12, 2) not null check (retail_price >= 0),
  quantity integer check (quantity is null or quantity >= 0),
  wholesale_profit numeric(12, 2) generated always as (wholesale_price - purchase_price) stored,
  retail_profit numeric(12, 2) generated always as (retail_price - purchase_price) stored,
  image_url text,
  image_public_id text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_created_at_idx on public.products (created_at desc);

-- Fast "contains" search on product name
create extension if not exists pg_trgm;
create index if not exists products_name_trgm_idx on public.products using gin (name gin_trgm_ops);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

drop policy if exists "admins select products" on public.products;
create policy "admins select products" on public.products
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "admins insert products" on public.products;
create policy "admins insert products" on public.products
  for insert to authenticated with check ((select public.is_admin()));

drop policy if exists "admins update products" on public.products;
create policy "admins update products" on public.products
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admins delete products" on public.products;
create policy "admins delete products" on public.products
  for delete to authenticated using ((select public.is_admin()));

-- Anonymous visitors get nothing.
revoke all on public.products from anon;
revoke all on public.admins from anon;

-- ---------------------------------------------------------------------------
-- After creating your user in Authentication > Users, make it an admin:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com';
-- ---------------------------------------------------------------------------
