-- Shop rakDEV — WhatsApp checkout + unified notifications
-- Jalankan SETELAH:
--   1) 202611210001_shop_rakdev.sql
--   2) 202611240001_announcements_push.sql
--
-- Migration ini tidak menghapus tabel/data. Tabel payments lama tetap disimpan
-- sebagai riwayat transaksi Midtrans.

begin;

-- ---------------------------------------------------------------------------
-- 1. Data pesanan WhatsApp (guest checkout tetap didukung)
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists channel text not null default 'midtrans',
  add column if not exists buyer_name text,
  add column if not exists buyer_phone text,
  add column if not exists shipping_address text,
  add column if not exists notes text;

alter table public.orders alter column user_id drop not null;
alter table public.order_items add column if not exists variant text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_channel_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_channel_check check (channel in ('midtrans', 'whatsapp', 'manual'));
  end if;
end $$;

create index if not exists orders_status_created_idx on public.orders(status, created_at desc);
create index if not exists orders_channel_created_idx on public.orders(channel, created_at desc);
create index if not exists orders_buyer_phone_created_idx on public.orders(buyer_phone, created_at desc) where buyer_phone is not null;

-- Admin perlu mengubah status pesanan (pending -> paid, dsb). RLS tetap
-- membatasi perubahan hanya untuk role admin/owner.
grant update on public.orders to authenticated;
drop policy if exists "admins update orders" on public.orders;
create policy "admins update orders" on public.orders for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- 2. Tabel notifikasi akun (admin & customer)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audience text not null default 'user' check (audience in ('user', 'admin')),
  type text not null,
  title text not null,
  body text,
  link text,
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "users mark own notifications read" on public.notifications;
create policy "users mark own notifications read" on public.notifications for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Realtime untuk lonceng notifikasi.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'announcements'
  ) then
    alter publication supabase_realtime add table public.announcements;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Trigger: pesanan baru -> notifikasi admin
-- ---------------------------------------------------------------------------
create or replace function private.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, audience, type, title, body, link, order_id)
  select
    p.id,
    'admin',
    'order_new',
    'Pesanan baru ' || new.order_number,
    coalesce(nullif(new.buyer_name, ''), 'Pelanggan')
      || ' · ' || coalesce(new.channel, 'whatsapp')
      || ' · Rp ' || new.total_amount::text,
    '/admin/orders',
    new.id
  from public.profiles p
  where p.role in ('admin', 'owner');
  return new;
end;
$$;
revoke all on function private.notify_new_order() from public, anon, authenticated;

drop trigger if exists orders_notify_new on public.orders;
create trigger orders_notify_new
after insert on public.orders
for each row execute function private.notify_new_order();

-- ---------------------------------------------------------------------------
-- 4. Trigger: status pesanan berubah -> notifikasi pembeli
-- ---------------------------------------------------------------------------
create or replace function private.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null and new.status is distinct from old.status then
    insert into public.notifications (user_id, audience, type, title, body, link, order_id)
    values (
      new.user_id,
      'user',
      'order_status',
      'Status pesanan diperbarui',
      'Pesanan ' || new.order_number || ' sekarang berstatus ' || new.status || '.',
      '/account/transactions',
      new.id
    );
  end if;
  return new;
end;
$$;
revoke all on function private.notify_order_status() from public, anon, authenticated;

drop trigger if exists orders_notify_status on public.orders;
create trigger orders_notify_status
after update of status on public.orders
for each row execute function private.notify_order_status();

-- ---------------------------------------------------------------------------
-- 5. Trigger: pesanan lunas -> buat purchases (hanya untuk pesanan berakun)
-- ---------------------------------------------------------------------------
create or replace function private.grant_purchases_on_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid' and new.user_id is not null then
    if tg_op = 'INSERT' then
      insert into public.purchases (user_id, order_id, product_id)
      select new.user_id, new.id, oi.product_id
      from public.order_items oi
      where oi.order_id = new.id
      on conflict (user_id, order_id, product_id) do nothing;
    elsif old.status is distinct from 'paid' then
      insert into public.purchases (user_id, order_id, product_id)
      select new.user_id, new.id, oi.product_id
      from public.order_items oi
      where oi.order_id = new.id
      on conflict (user_id, order_id, product_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.grant_purchases_on_paid() from public, anon, authenticated;

drop trigger if exists orders_grant_purchases on public.orders;
create trigger orders_grant_purchases
after insert or update of status on public.orders
for each row execute function private.grant_purchases_on_paid();

-- ---------------------------------------------------------------------------
-- 6. RPC checkout WhatsApp
--    Harga SELALU dihitung ulang dari public.products, bukan dari browser.
--    Bisa dipanggil anon (guest) maupun authenticated.
-- ---------------------------------------------------------------------------
create or replace function public.create_whatsapp_order(
  p_buyer_name text,
  p_buyer_phone text default null,
  p_shipping_address text default null,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_item jsonb;
  v_product record;
  v_product_id uuid;
  v_quantity integer;
  v_items jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_line_total bigint;
  v_order_id uuid;
  v_order_number text;
  v_duplicate boolean;
  v_recent integer := 0;
begin
  if p_buyer_name is null or char_length(btrim(p_buyer_name)) < 2 then
    raise exception 'Nama pembeli wajib diisi minimal 2 karakter.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Keranjang tidak valid.';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    raise exception 'Keranjang tidak valid.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    begin
      v_product_id := (v_item->>'product_id')::uuid;
    exception when others then
      raise exception 'Product ID tidak valid.';
    end;

    v_quantity := coalesce((v_item->>'quantity')::integer, 0);
    if v_quantity < 1 or v_quantity > 10 then
      raise exception 'Jumlah produk harus antara 1 dan 10.';
    end if;

    select id, name, price, is_published
      into v_product
      from public.products
      where id = v_product_id;
    if not found or not v_product.is_published then
      raise exception 'Produk tidak ditemukan atau belum dipublikasikan.';
    end if;

    select exists (
      select 1 from jsonb_array_elements(v_items) x
      where (x->>'product_id')::uuid = v_product_id
    ) into v_duplicate;
    if v_duplicate then
      raise exception 'Produk duplikat dalam keranjang.';
    end if;

    v_line_total := v_product.price::bigint * v_quantity;
    v_total := v_total + v_line_total;
    v_items := v_items || jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'unit_price', v_product.price,
      'quantity', v_quantity,
      'line_total', v_line_total,
      'variant', nullif(btrim(coalesce(v_item->>'variant', '')), '')
    );
  end loop;

  if v_total < 1000 then
    raise exception 'Total pesanan tidak valid.';
  end if;
  if v_total > 100000000 then
    raise exception 'Total pesanan melebihi batas yang didukung.';
  end if;

  if v_user is not null then
    select count(*) into v_recent
    from public.orders
    where user_id = v_user and created_at > now() - interval '1 hour';
    if v_recent >= 8 then
      raise exception 'Batas pembuatan pesanan sementara tercapai. Coba lagi nanti.';
    end if;
  elsif nullif(btrim(coalesce(p_buyer_phone, '')), '') is not null then
    select count(*) into v_recent
    from public.orders
    where buyer_phone = btrim(p_buyer_phone) and created_at > now() - interval '10 minutes';
    if v_recent >= 3 then
      raise exception 'Terlalu banyak pesanan dengan nomor ini. Coba lagi beberapa menit lagi.';
    end if;
  end if;

  v_order_number := 'WA' || to_char(now(), 'YYYYMMDDHH24MISS')
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.orders (
    order_number, user_id, status, currency, subtotal_amount, total_amount,
    channel, buyer_name, buyer_phone, shipping_address, notes
  ) values (
    v_order_number, v_user, 'pending', 'IDR', v_total, v_total,
    'whatsapp',
    left(btrim(p_buyer_name), 120),
    left(nullif(btrim(coalesce(p_buyer_phone, '')), ''), 30),
    left(nullif(btrim(coalesce(p_shipping_address, '')), ''), 500),
    left(nullif(btrim(coalesce(p_notes, '')), ''), 1000)
  ) returning id into v_order_id;

  insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, line_total, variant)
  select
    v_order_id,
    (x->>'product_id')::uuid,
    x->>'product_name',
    (x->>'unit_price')::bigint,
    (x->>'quantity')::integer,
    (x->>'line_total')::bigint,
    nullif(x->>'variant', '')
  from jsonb_array_elements(v_items) x;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_total
  );
end;
$$;
revoke all on function public.create_whatsapp_order(text, text, text, text, jsonb) from public;
grant execute on function public.create_whatsapp_order(text, text, text, text, jsonb) to anon, authenticated;

comment on function public.create_whatsapp_order(text, text, text, text, jsonb)
  is 'Membuat pesanan checkout WhatsApp dengan harga yang dihitung ulang dari tabel products.';

commit;
