-- Shop rakDEV — QRIS checkout via BuatQris
-- Jalankan SETELAH:
--   1) 202611210001_shop_rakdev.sql
--   2) 202611240001_announcements_push.sql
--   3) 202611260001_whatsapp_checkout_notifications.sql
--
-- Migration ini tidak menghapus data. Tabel payments lama tetap disimpan.
-- Kredensial BuatQris TIDAK disimpan di database; letakkan di Edge Function secrets.

begin;

-- ---------------------------------------------------------------------------
-- 1. Channel pesanan QRIS
-- ---------------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_channel_check;
alter table public.orders
  add constraint orders_channel_check
  check (channel in ('midtrans', 'whatsapp', 'manual', 'qris'));

-- ---------------------------------------------------------------------------
-- 2. Metadata pembayaran QRIS
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists payment_url text,
  add column if not exists is_test boolean not null default false,
  add column if not exists paid_at timestamptz;

create index if not exists payments_provider_transaction_idx
  on public.payments(provider, provider_transaction_id);
create index if not exists payments_pending_expiry_idx
  on public.payments(status, expires_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- 3. Notifikasi status yang lebih jelas + notifikasi admin saat lunas
-- ---------------------------------------------------------------------------
create or replace function private.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_body text;
  v_link text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.user_id is not null then
    if new.status = 'paid' then
      v_title := 'Pembayaran berhasil';
      v_body := 'Pesanan ' || new.order_number || ' sudah dibayar. Produk digital siap diunduh dari akunmu.';
      v_link := '/account/downloads';
    elsif new.status = 'expired' then
      v_title := 'Pembayaran kedaluwarsa';
      v_body := 'Pesanan ' || new.order_number || ' kedaluwarsa. Silakan buat pesanan baru.';
      v_link := '/shop';
    elsif new.status = 'failed' then
      v_title := 'Pembayaran gagal';
      v_body := 'Pembayaran pesanan ' || new.order_number || ' gagal. Silakan coba lagi.';
      v_link := '/shop';
    elsif new.status = 'cancelled' then
      v_title := 'Pesanan dibatalkan';
      v_body := 'Pesanan ' || new.order_number || ' dibatalkan.';
      v_link := '/account/transactions';
    elsif new.status = 'refunded' then
      v_title := 'Pesanan direfund';
      v_body := 'Pesanan ' || new.order_number || ' telah direfund.';
      v_link := '/account/transactions';
    else
      v_title := 'Status pesanan diperbarui';
      v_body := 'Pesanan ' || new.order_number || ' sekarang berstatus ' || new.status || '.';
      v_link := '/account/transactions';
    end if;

    insert into public.notifications (user_id, audience, type, title, body, link, order_id)
    values (new.user_id, 'user', 'order_status', v_title, v_body, v_link, new.id);
  end if;

  if new.status = 'paid' then
    insert into public.notifications (user_id, audience, type, title, body, link, order_id)
    select
      p.id,
      'admin',
      'order_paid',
      'Pembayaran diterima ' || new.order_number,
      coalesce(nullif(new.buyer_name, ''), 'Pelanggan')
        || ' · ' || coalesce(new.channel, 'qris')
        || ' · Rp ' || new.total_amount::text,
      '/admin/orders',
      new.id
    from public.profiles p
    where p.role in ('admin', 'owner');
  end if;

  return new;
end;
$$;
revoke all on function private.notify_order_status() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. RPC checkout QRIS
--    QRIS hanya untuk akun login agar purchases + download otomatis aman.
--    Harga SELALU dihitung ulang dari public.products, bukan dari browser.
-- ---------------------------------------------------------------------------
create or replace function public.create_qris_order(
  p_buyer_name text,
  p_buyer_phone text default null,
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
  if v_user is null then
    raise exception 'Login diperlukan untuk pembayaran QRIS otomatis.';
  end if;
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
    if not found then
      raise exception 'Produk tidak ditemukan atau belum dipublikasikan.';
    end if;
    if not v_product.is_published then
      raise exception 'Produk tidak ditemukan atau belum dipublikasikan.';
    end if;

    if not exists (
      select 1 from public.product_files pf
      where pf.product_id = v_product_id and pf.is_current = true
    ) then
      raise exception 'File produk belum tersedia.';
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
      'variant', left(nullif(btrim(coalesce(v_item->>'variant', '')), ''), 100)
    );
  end loop;

  if v_total < 1000 then
    raise exception 'Total pesanan tidak valid.';
  end if;
  if v_total > 100000000 then
    raise exception 'Total pesanan melebihi batas yang didukung.';
  end if;

  select count(*) into v_recent
  from public.orders
  where user_id = v_user and created_at > now() - interval '1 hour';
  if v_recent >= 8 then
    raise exception 'Batas pembuatan pesanan sementara tercapai. Coba lagi nanti.';
  end if;

  v_order_number := 'QR' || to_char(now(), 'YYYYMMDDHH24MISS')
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.orders (
    order_number, user_id, status, currency, subtotal_amount, total_amount,
    channel, buyer_name, buyer_phone, notes
  ) values (
    v_order_number, v_user, 'pending', 'IDR', v_total, v_total,
    'qris',
    left(btrim(p_buyer_name), 120),
    left(nullif(btrim(coalesce(p_buyer_phone, '')), ''), 30),
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
revoke all on function public.create_qris_order(text, text, text, jsonb) from public, anon;
grant execute on function public.create_qris_order(text, text, text, jsonb) to authenticated;

comment on function public.create_qris_order(text, text, text, jsonb)
  is 'Membuat pesanan QRIS berakun dengan harga yang dihitung ulang dari tabel products.';

commit;
