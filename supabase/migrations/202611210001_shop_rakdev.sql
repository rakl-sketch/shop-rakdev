-- Shop rakDEV initial schema
-- Run in Supabase SQL Editor or with the Supabase CLI after creating a project.

create extension if not exists pgcrypto;
create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'customer' check (role in ('customer','admin','owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Roles are never accepted from user metadata. Every new account is a customer.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60), 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_shop_rakdev on auth.users;
create trigger on_auth_user_created_shop_rakdev
after insert on auth.users
for each row execute function public.handle_new_user();

-- Needed to safely check the current user's admin role from RLS without recursive profile policies.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin','owner')
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text not null,
  short_description text,
  price bigint not null check (price >= 1000),
  compare_at_price bigint check (compare_at_price is null or compare_at_price >= price),
  image_url text,
  minecraft_version text,
  platform text,
  file_size text,
  rating numeric(2,1),
  review_count integer not null default 0 check (review_count >= 0),
  is_featured boolean not null default false,
  is_new boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_published_idx on public.products(category_id, is_published);
create index if not exists products_published_created_idx on public.products(is_published, created_at desc);

create table if not exists public.product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  bucket_id text not null default 'product-files',
  file_path text not null,
  file_name text not null,
  file_size bigint not null check (file_size > 0),
  version_label text not null default 'v1.0.0',
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  unique(bucket_id, file_path)
);
create index if not exists product_files_current_idx on public.product_files(product_id, is_current);
create unique index if not exists product_files_one_current_per_product on public.product_files(product_id) where is_current = true;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','paid','expired','failed','cancelled','refunded')),
  currency text not null default 'IDR' check (currency = 'IDR'),
  subtotal_amount bigint not null check (subtotal_amount >= 0),
  total_amount bigint not null check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  unit_price bigint not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 10),
  line_total bigint not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  unique(order_id, product_id)
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  provider text not null default 'midtrans',
  provider_order_id text not null unique,
  provider_transaction_id text,
  status text not null default 'pending',
  amount bigint not null check (amount >= 0),
  qr_code_url text,
  qr_string text,
  expires_at timestamptz,
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_status_idx on public.payments(status);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(user_id, order_id, product_id)
);
create index if not exists purchases_user_created_idx on public.purchases(user_id, created_at desc);

create table if not exists public.download_logs (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  requested_at timestamptz not null default now()
);
create index if not exists download_logs_user_idx on public.download_logs(user_id, requested_at desc);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1500),
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique(product_id, user_id)
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percentage','fixed')),
  discount_value bigint not null check (discount_value > 0),
  max_uses integer,
  used_count integer not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on public.admin_audit_logs(created_at desc);

create or replace function private.log_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  target_id text;
begin
  if tg_op = 'INSERT' then
    new_row := to_jsonb(new);
    target_id := new_row ->> 'id';
  elsif tg_op = 'UPDATE' then
    old_row := to_jsonb(old);
    new_row := to_jsonb(new);
    target_id := new_row ->> 'id';
  else
    old_row := to_jsonb(old);
    target_id := old_row ->> 'id';
  end if;
  insert into public.admin_audit_logs (actor_id, action_type, entity_type, entity_id, old_data, new_data)
  values ((select auth.uid()), tg_op, tg_table_name, target_id, old_row, new_row);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.log_admin_change() from public, anon, authenticated;

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text,
  target_url text,
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- updated_at maintenance
 drop trigger if exists products_updated_at on public.products;
 create trigger products_updated_at before update on public.products for each row execute function private.set_updated_at();
 drop trigger if exists profiles_updated_at on public.profiles;
 create trigger profiles_updated_at before update on public.profiles for each row execute function private.set_updated_at();
 drop trigger if exists orders_updated_at on public.orders;
 create trigger orders_updated_at before update on public.orders for each row execute function private.set_updated_at();
 drop trigger if exists payments_updated_at on public.payments;
 create trigger payments_updated_at before update on public.payments for each row execute function private.set_updated_at();

-- Enable RLS on all exposed tables.
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_files enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.purchases enable row level security;
alter table public.download_logs enable row level security;
alter table public.reviews enable row level security;
alter table public.favorites enable row level security;
alter table public.coupons enable row level security;
alter table public.banners enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Remove broad profile update grants. Customers can update display_name only, never role.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy "profile owner or admin can read" on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));
create policy "profile owner can update own display name" on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Categories and product cards are public only when safe to display.
grant select on public.categories, public.products, public.banners, public.reviews to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.banners, public.reviews to authenticated;
create policy "categories are public read" on public.categories for select to anon, authenticated using (true);
create policy "admins manage categories" on public.categories for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "published products are public" on public.products for select to anon using (is_published = true);
create policy "customers read published or purchased products; admins read all" on public.products for select to authenticated
using (is_published = true or (select private.is_admin()) or exists (select 1 from public.purchases pu where pu.product_id = products.id and pu.user_id = (select auth.uid())));
create policy "admins insert products" on public.products for insert to authenticated with check ((select private.is_admin()));
create policy "admins update products" on public.products for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete products" on public.products for delete to authenticated using ((select private.is_admin()));
grant select, insert, update, delete on public.product_files to authenticated;
create policy "admins manage product file metadata" on public.product_files for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Customers can only read their own commerce records. Creation/status changes are server-side.
grant select on public.orders, public.order_items, public.payments, public.purchases, public.download_logs to authenticated;
create policy "users read own orders" on public.orders for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "users read own order items" on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select private.is_admin()))));
create policy "users read own payments" on public.payments for select to authenticated using (exists(select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select private.is_admin()))));
create policy "users read own purchases" on public.purchases for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "users read own download logs" on public.download_logs for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Reviews: public read approved reviews; a customer can submit one only after purchase.
create policy "approved reviews are public" on public.reviews for select to anon, authenticated using (is_approved = true or user_id = (select auth.uid()) or (select private.is_admin()));
create policy "purchasers can submit review" on public.reviews for insert to authenticated
with check (user_id = (select auth.uid()) and exists (select 1 from public.purchases pu where pu.user_id = (select auth.uid()) and pu.product_id = reviews.product_id));
create policy "admins moderate reviews" on public.reviews for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "users delete own reviews" on public.reviews for delete to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Favorites belong to the signed-in account.
grant select, insert, delete on public.favorites to authenticated;
create policy "users manage own favorites" on public.favorites for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Coupons are private to admins; public clients cannot inspect or change them.
alter table public.coupons enable row level security;
grant select, insert, update, delete on public.coupons to authenticated;
create policy "admins manage coupons" on public.coupons for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "active banners are public" on public.banners for select to anon, authenticated using (is_active = true or (select private.is_admin()));
create policy "admins manage banners" on public.banners for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
grant select on public.admin_audit_logs to authenticated;
create policy "admins read audit logs" on public.admin_audit_logs for select to authenticated using ((select private.is_admin()));

drop trigger if exists audit_products on public.products;
create trigger audit_products after insert or update or delete on public.products for each row execute function private.log_admin_change();
drop trigger if exists audit_categories on public.categories;
create trigger audit_categories after insert or update or delete on public.categories for each row execute function private.log_admin_change();
drop trigger if exists audit_banners on public.banners;
create trigger audit_banners after insert or update or delete on public.banners for each row execute function private.log_admin_change();
drop trigger if exists audit_coupons on public.coupons;
create trigger audit_coupons after insert or update or delete on public.coupons for each row execute function private.log_admin_change();
drop trigger if exists audit_reviews on public.reviews;
create trigger audit_reviews after insert or update or delete on public.reviews for each row execute function private.log_admin_change();

-- Storage buckets: previews are public; product archives are private and only admin-uploadable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-previews','product-previews',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
insert into storage.buckets (id, name, public, file_size_limit)
values ('product-files','product-files',false,524288000)
on conflict (id) do update set public = false, file_size_limit = 524288000;

create policy "public can view product previews" on storage.objects for select to anon, authenticated using (bucket_id = 'product-previews');
create policy "admins upload product previews" on storage.objects for insert to authenticated with check (bucket_id = 'product-previews' and (select private.is_admin()));
create policy "admins update product previews" on storage.objects for update to authenticated using (bucket_id = 'product-previews' and (select private.is_admin())) with check (bucket_id = 'product-previews' and (select private.is_admin()));
create policy "admins delete product previews" on storage.objects for delete to authenticated using (bucket_id = 'product-previews' and (select private.is_admin()));
create policy "admins manage private product files" on storage.objects for all to authenticated using (bucket_id = 'product-files' and (select private.is_admin())) with check (bucket_id = 'product-files' and (select private.is_admin()));

-- Seed exactly the four approved shop categories.
insert into public.categories (slug, name, description, sort_order) values
  ('plugins','Plugins','Plugin Minecraft Java berbentuk JAR atau ZIP.',1),
  ('skript','Skript','Skript, sistem, dan fitur server Minecraft.',2),
  ('maps','Maps','World, spawn, lobby, arena, dan map Minecraft.',3),
  ('server-backup','Server Backup','Backup world dan file server untuk dipulihkan.',4)
on conflict (slug) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

-- IMPORTANT: Grant the owner role manually only after the first account is registered.
-- Run in SQL Editor, replacing the UUID with the trusted owner's auth.users.id:
-- update public.profiles set role = 'owner' where id = 'YOUR_AUTH_USER_UUID';
