-- Pengumuman produk baru (realtime di website) + penyimpanan langganan Web Push.

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  product_name text not null,
  product_slug text not null,
  image_url text,
  created_at timestamptz not null default now()
);
create index if not exists announcements_created_idx on public.announcements(created_at desc);

alter table public.announcements enable row level security;
drop policy if exists "announcements are public" on public.announcements;
create policy "announcements are public" on public.announcements for select to anon, authenticated using (true);
grant select on public.announcements to anon, authenticated;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
-- Tanpa policy: hanya Edge Function (service role) yang boleh baca/tulis.
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Buat pengumuman saat produk baru dipublish (insert published, atau draft -> published).
create or replace function private.announce_published_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_published then
    if tg_op = 'INSERT' then
      insert into public.announcements (product_id, product_name, product_slug, image_url)
      values (new.id, new.name, new.slug, new.image_url);
    elsif coalesce(old.is_published, false) = false then
      insert into public.announcements (product_id, product_name, product_slug, image_url)
      values (new.id, new.name, new.slug, new.image_url);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.announce_published_product() from public, anon, authenticated;

drop trigger if exists products_announce_published on public.products;
create trigger products_announce_published
after insert or update of is_published on public.products
for each row execute function private.announce_published_product();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'announcements') then
    alter publication supabase_realtime add table public.announcements;
  end if;
end $$;
