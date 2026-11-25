# Shop rakDEV

Minecraft digital marketplace built with React + Vite + TypeScript. This project is a working application scaffold with a read-only preview catalogue when Supabase is not configured. Real accounts, products, orders, QRIS payments, admin access and downloads require the setup below.

## Stack

- React + Vite + TypeScript
- React Router
- Shared component styles with global design tokens in `src/styles/global.css`
- Supabase Auth, PostgreSQL, Storage and Edge Functions
- Midtrans Core API QRIS
- GitHub Pages + GitHub Actions

## Local development

Requirements: Node.js `>=20.19.0` and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set these browser-safe values in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Only the Supabase publishable key belongs in the Vite environment. Never put a Supabase secret/service-role key or Midtrans key in a `VITE_` variable.

Without Supabase variables the storefront shows clearly labelled preview products. Authentication, cart checkout and payment remain disabled; the preview data cannot create real transactions.

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/migrations/202611210001_shop_rakdev.sql`.
3. Add the project URL and publishable key to `.env.local` and GitHub repository variables (lihat bagian Deployment).
4. Register your owner account from the website.
5. In Supabase SQL Editor, find that user's UUID in `auth.users`, then run:

```sql
update public.profiles
set role = 'owner'
where id = 'YOUR_AUTH_USER_UUID';
```

This manual role assignment is intentional. Customer signup metadata cannot set an admin role. The project restricts profile updates so users cannot change their own role. The owner role is granted with the trusted SQL step shown below.

The migration creates these categories only: `plugins`, `skript`, `maps`, `server-backup`. It creates two Storage buckets:

- `product-previews`: public read, admin-only upload, image-only, 10 MB limit.
- `product-files`: private, admin-only upload/read. Customer downloads are issued by the `download-product` Edge Function as short-lived signed URLs.

## Midtrans setup

Use Midtrans Sandbox first. Enable QRIS for the merchant account. The current integration uses the Midtrans QRIS Core API charge endpoint (`POST /v2/charge`) and requests the `gopay` acquirer by default. Check the payment channels enabled for the merchant account before production.

Set Edge Function secrets in Supabase (never in the frontend):

```text
MIDTRANS_SERVER_KEY=...
MIDTRANS_SIGNATURE_SECRET_KEY=...
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_QRIS_ACQUIRER=gopay
APP_ORIGIN=https://shop.rakdev.my.id
```

The shared Edge Function helper reads the Supabase platform service key from `SUPABASE_SECRET_KEYS` (with a legacy `SUPABASE_SERVICE_ROLE_KEY` fallback). It is used only inside Edge Functions.

Edge Functions di-deploy otomatis oleh GitHub Actions (lihat bagian Deployment). Deploy manual:

```bash
supabase functions deploy --project-ref YOUR_PROJECT_REF
```

The webhook has JWT verification disabled because Midtrans does not send a Supabase user JWT. The handler instead verifies Midtrans `signature_key` using `MIDTRANS_SIGNATURE_SECRET_KEY`, then performs a server-to-server status lookup before changing the order or granting purchases. Do not disable signature validation.

Configure the Midtrans **Payment Notification URL** to:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/midtrans-webhook
```

Current Midtrans documentation uses the **Signature Secret Key** for the SHA-512 notification signature formula. Do not substitute the Server Key for this value. Confirm the key names shown in your Midtrans MAP before deploying production.

## Deployment (GitHub Pages + Actions)

### 1. Aktifkan Pages

Settings → Pages → **Source: GitHub Actions**.

### 2. Isi secrets & variables

Settings → Secrets and variables → Actions.

**Secrets**

| Nama | Keterangan |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Personal access token Supabase (Account → Access Tokens) |
| `SUPABASE_PROJECT_REF` | Project ref Supabase |

**Variables**

| Nama | Keterangan |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (aman untuk browser) |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key untuk notifikasi push (lihat bagian Notifikasi produk baru) |

### 3. Workflow

- `.github/workflows/deploy-pages.yml`: push ke `main` → `npm ci` → `npm run build` → deploy `dist/` ke GitHub Pages.
- `.github/workflows/deploy-functions.yml`: push ke `main` yang mengubah `supabase/functions/**` → `supabase functions deploy`.

SPA fallback memakai `404.html` (salinan `index.html`, dibuat otomatis saat build). Aplikasi memakai root path domain, sehingga URL seperti `/shop`, `/product/:slug`, dan `/admin` dapat dibuka langsung atau di-refresh.

### 4. Hubungkan custom domain

1. Buka repository GitHub → **Settings → Pages**.
2. Pada **Custom domain**, isi `shop.rakdev.my.id`, lalu simpan.
3. Pastikan DNS memiliki record CNAME `shop` yang mengarah ke `rakl-sketch.github.io`.
4. Setelah verifikasi DNS selesai, centang **Enforce HTTPS** pada pengaturan Pages.

File `public/CNAME` sudah berisi `shop.rakdev.my.id` dan ikut dipublikasikan saat build.

Set `APP_ORIGIN` di Supabase Edge Function secrets menjadi persis `https://shop.rakdev.my.id` (tanpa path dan tanpa trailing slash).

## Notifikasi produk baru

Saat produk dipublish (insert dengan `is_published = true`, atau draft → published), trigger database membuat baris di `public.announcements`.

- **Di dalam website:** semua pengunjung yang sedang membuka web menerima toast `[pp] Shop rakDEV: <nama produk>` lewat Supabase Realtime. Ikon lonceng di header menampilkan 10 produk terbaru dan badge jumlah yang belum dilihat.
- **Push browser (walau web ditutup):** pengunjung klik "Aktifkan notifikasi push" di panel lonceng. Di iPhone hanya jalan jika situs ditambahkan ke Home Screen.

Setup sekali:

1. Jalankan `supabase/migrations/202611240001_announcements_push.sql` di SQL Editor.
2. Buat VAPID keys: `npx web-push generate-vapid-keys`.
3. Isi GitHub variable `VITE_VAPID_PUBLIC_KEY` (public key) dan Edge Function secrets di Supabase:

```text
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:email-kamu@contoh.com
PUSH_WEBHOOK_SECRET=string-acak-panjang
```

4. Deploy functions (`push-subscribe`, `notify-product`) lewat workflow, lalu di Supabase buka Database → Webhooks → Create: tabel `announcements`, event **Insert**, tipe HTTP Request, `POST` ke `https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-product`, tambahkan header `x-webhook-secret` berisi nilai `PUSH_WEBHOOK_SECRET`.

Tanpa langkah 2–4, toast dan lonceng di dalam website tetap berfungsi; hanya push yang nonaktif.

## Important security rules

- Never commit `.env.local`, payment keys, Supabase service keys, or secret keys.
- Customer-facing database reads are protected by RLS. Order creation, payment status changes and purchase grants happen server-side.
- The browser never sends a trusted price. `create-payment` reloads current published product prices from PostgreSQL and calculates the total itself.
- The webhook signature is validated, then the transaction status and amount are fetched directly from Midtrans before marking an order paid.
- Duplicate notifications are safe: purchase rows have a unique constraint and use an idempotent upsert.
- File archives stay in a private bucket. Downloads require a matching purchase and receive a 60-second signed URL. The endpoint limits repeated downloads per user.
- Admin roles are granted manually by a trusted project owner. Never add a public admin-registration route.
- Before publishing, upload only products you own or are authorized to distribute. Inspect archives before uploading and test restores for backup products.
- Merchant onboarding, identity verification and payment-account ownership must follow Midtrans eligibility requirements. A minor should have a parent/guardian or other eligible adult handle any merchant account and legal/payment commitments; do not bypass age or identity checks.

## Current implementation scope

Implemented in this initial build: storefront, four product categories, product detail, local cart, Supabase Auth screens, checkout shell, Midtrans QRIS Edge Function, webhook verification, customer account pages, download endpoint, admin overview, product upload and publish/unpublish controls, database schema, RLS and Storage policies.

Before production, complete merchant onboarding, configure secrets, deploy Edge Functions, test Sandbox payments end-to-end, add real products, and complete the store's final terms/privacy/contact information. Admin category/customer/review/order screens currently provide data views; advanced CRUD/moderation workflows can be expanded in the next iteration.
