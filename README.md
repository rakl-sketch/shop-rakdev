# Shop rakDEV

Minecraft digital marketplace built with React + Vite + TypeScript, Supabase, WhatsApp checkout, and QRIS checkout via BuatQris.

The storefront is public at `/`; the admin control panel is at `/admin`. Checkout supports two paths: automatic QRIS payment (logged-in buyers, feature-flagged by `VITE_QRIS_ENABLED`) and manual WhatsApp confirmation (guest or logged-in). Orders, payments, purchases, notifications, and digital delivery are recorded in PostgreSQL.

## Stack

- React 19 + Vite 7 + TypeScript
- React Router 7 (GitHub Pages SPA fallback via `404.html`)
- Supabase Auth, PostgreSQL, Storage, Realtime, Edge Functions
- WhatsApp checkout via `wa.me`
- QRIS checkout via BuatQris REST API + signed webhook
- GitHub Pages + GitHub Actions

## Local development

Requirements: Node.js `>=22.12.0` and npm (matches the GitHub Actions Node 22 runtime and Vitest 5).

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

Only the Supabase publishable key belongs in the Vite environment. Never put a Supabase secret/service-role key or payment credential in a `VITE_` variable.

Without Supabase variables the storefront shows a clearly labelled preview catalogue. Checkout is not enabled in that preview mode.

## Supabase setup

Run the migrations in this order from the Supabase SQL Editor or with the Supabase CLI:

1. `supabase/migrations/202611210001_shop_rakdev.sql` — base schema, RLS, Storage buckets, categories.
2. `supabase/migrations/202611240001_announcements_push.sql` — product announcements and Web Push subscriptions.
3. `supabase/migrations/202611260001_whatsapp_checkout_notifications.sql` — WhatsApp orders, guest checkout, order notifications, purchase grants, and the `create_whatsapp_order` RPC.
4. `supabase/migrations/202611270001_qris_checkout.sql` — QRIS orders, payment metadata, paid-order notifications, and the `create_qris_order` RPC.

> The migrations are additive and non-destructive. The `payments` table is retained for historical Midtrans data. No existing table or row is deleted.

After registering the first account, grant the owner role manually in SQL Editor:

```sql
update public.profiles
set role = 'owner'
where id = 'YOUR_AUTH_USER_UUID';
```

This manual role assignment is intentional. Customer signup metadata cannot set an admin role, and profile updates do not allow role changes.

Storage buckets created by the base migration:

- `product-previews`: public read, admin-only upload, image-only, 10 MB limit.
- `product-files`: private, admin-only upload/read. Customer downloads are issued by the `download-product` Edge Function as short-lived signed URLs.

## WhatsApp checkout

The official number is **0881-5825-403** (international: **628815825403**). It is defined in `src/lib/whatsapp.ts`.

Flow:

1. Customer adds products to the local cart.
2. `/checkout` collects buyer name, optional WhatsApp number, optional shipping address, and optional order notes.
3. The browser builds a `wa.me/628815825403?text=...` URL containing:
   - product names,
   - product variations (Minecraft version / platform when available),
   - quantity,
   - unit price,
   - line subtotal and order total,
   - buyer name,
   - shipping address and order notes when provided.
4. The message is URL-encoded with `encodeURIComponent`.
5. The order is saved through the `create_whatsapp_order` RPC. The RPC recalculates every price from `public.products`; browser-supplied prices are never trusted.
6. Logged-in buyers have the order linked to their account. Guest orders are stored with `user_id = NULL` and are visible to admins only.
7. Admin changes the order status in `/admin/orders`. Marking an order `paid` creates purchase rows for logged-in buyers and unlocks downloads.

Checkout works on Android and desktop. On mobile, `wa.me` opens the WhatsApp app; on desktop it opens WhatsApp Web or the installed app.

## QRIS checkout (BuatQris)

QRIS is the automatic payment path. It requires a logged-in account so the paid order can create `purchases` and unlock the private download in `/account/downloads`.

The checkout UI keeps QRIS disabled by default (`VITE_QRIS_ENABLED=false`) so an unconfigured payment method is not offered to buyers. Set `VITE_QRIS_ENABLED=true` in the GitHub Actions variables and redeploy the Pages build only after the Edge Function secrets below are configured and sandbox-tested. The WhatsApp path remains available in both modes.

Flow:

1. Admin uploads a product, its price, and its file in `/admin/products`.
2. Logged-in buyer chooses **QRIS otomatis** at `/checkout`.
3. The browser calls the `create-qris` Edge Function. The Edge Function calls `create_qris_order`, which recalculates every price from `public.products` and checks that an active `product_files` row exists.
4. The Edge Function sends the server-calculated total to BuatQris `api_create_qris` and stores the returned transaction in `public.payments`.
5. Buyer scans the QR or opens the BuatQris payment page. `/payment/:orderId` polls status through the `qris-status` Edge Function.
6. BuatQris calls `qris-webhook`. The function verifies `X-BuatQris-Signature` (HMAC-SHA256), checks the nominal against the order, and updates payment + order status idempotently.
7. When the order becomes `paid`, the existing database trigger creates `purchases`, sends the buyer notification, and the file appears in Download Center.

Sandbox first:

```bash
supabase secrets set \
  BUATQRIS_ACCOUNT_ID=your_account_id \
  BUATQRIS_SECRET_TOKEN=your_secret_token \
  BUATQRIS_WEBHOOK_SECRET=your_signing_secret \
  BUATQRIS_MODE=sandbox \
  BUATQRIS_QRIS_METHOD=qris_two \
  BUATQRIS_UMKM_NAME="Shop rakDEV"
```

`BUATQRIS_MODE` defaults to `sandbox` when unset. In sandbox mode the API request includes `test=1`; production mode omits it. Production webhooks with `is_test: true` are rejected.

Webhook URL:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/qris-webhook
```

The function passes this URL as `callback_url` on every transaction, so a global dashboard callback is optional. Set `BUATQRIS_WEBHOOK_SECRET` to the signing secret shown in the BuatQris Open API dashboard; if BuatQris uses the same value as the secret token, the function falls back to `BUATQRIS_SECRET_TOKEN`.

Sandbox test:

1. Create a QRIS order from `/checkout` with a published product that has an active file.
2. Open `/payment/:orderId` and confirm the sandbox badge, QR, total, and 15-minute timer.
3. Complete the sandbox payment from the BuatQris dashboard/API Tester (`test_pay` for the transaction id).
4. Confirm the webhook returns 200, the order becomes `paid`, the buyer notification appears, and the file is available in Download Center.
5. Switch `BUATQRIS_MODE=production` only after the sandbox webhook, amount check, and delivery are verified.

Never put `BUATQRIS_ACCOUNT_ID`, `BUATQRIS_SECRET_TOKEN`, or the webhook signing secret in a `VITE_` variable or in the browser bundle.

## Notifications

`NotificationsProvider` combines two sources:

- **Product announcements** from `public.announcements` (public, realtime).
- **Account notifications** from `public.notifications` (per-user, RLS-protected, realtime).

Database triggers create notifications for:

- every new order → one notification per admin/owner,
- every order status change → the buyer (when the order belongs to an account),
- every paid order → one admin/owner notification and a buyer notification with a direct Download Center link.

The bell in the header and admin top bar shows unread counts. Opening the panel marks visible notifications as read. Realtime events are deduplicated by notification id so the same event does not toast repeatedly.

Browser push is optional and uses the existing `push-subscribe` and `notify-product` Edge Functions plus `public/sw.js`. If VAPID keys are not configured, in-app notifications still work.

Push setup:

1. Generate VAPID keys: `npx web-push generate-vapid-keys`.
2. Add `VITE_VAPID_PUBLIC_KEY` as a GitHub repository variable.
3. Add these Edge Function secrets in Supabase:

```text
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:email-kamu@contoh.com
PUSH_WEBHOOK_SECRET=string-acak-panjang
```

4. Deploy `push-subscribe` and `notify-product`.
5. Create a Database Webhook on `announcements` (event **Insert**) that POSTs to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-product` with header `x-webhook-secret: <PUSH_WEBHOOK_SECRET>`.

## Edge Functions

Remaining functions:

- `download-product` — verifies a purchase, rate-limits downloads, and returns a 60-second signed URL.
- `push-subscribe` — stores/removes browser push subscriptions.
- `notify-product` — sends Web Push for a new product announcement (Database Webhook, secret header).
- `create-qris` — authenticated; creates a server-priced QRIS order and BuatQris transaction.
- `qris-status` — authenticated; checks BuatQris status and syncs payment/order state.
- `qris-webhook` — public endpoint with HMAC-SHA256 signature verification for BuatQris callbacks.

Removed Midtrans functions: `create-payment`, `verify-payment`, `midtrans-webhook`.

Set `APP_ORIGIN` in Supabase Edge Function secrets to the deployed site origin, for example `https://shop.rakdev.web.id` (no trailing slash).

## Deployment (GitHub Pages + Actions)

### 1. Enable Pages

Settings → Pages → **Source: GitHub Actions**.

### 2. Repository secrets and variables

Secrets:

| Name | Description |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase personal access token |
| `SUPABASE_PROJECT_REF` | Supabase project ref |

Variables:

| Name | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (browser-safe) |
| `VITE_VAPID_PUBLIC_KEY` | Optional VAPID public key for Web Push |

### 3. Workflows

- `.github/workflows/deploy-pages.yml`: push to `main` → `npm ci` → typecheck → unit tests → build → deploy `dist/`.
- `.github/workflows/deploy-functions.yml`: changes under `supabase/functions/**` or `supabase/config.toml` → deploy Edge Functions.
- `.github/workflows/apply-migration.yml`: manual dispatch only; applies one SQL file through the Supabase Management API using the existing repository secrets.

SPA fallback uses `404.html` (a copy of `index.html`, generated at build time). The app uses the root path with the custom domain, so `/shop`, `/product/:slug`, `/checkout`, `/payment/:orderId`, `/account`, and `/admin` can be opened or refreshed directly.

### 4. Custom domain

1. GitHub repository → **Settings → Pages**.
2. Set **Custom domain** to `shop.rakdev.web.id`.
3. Point the `shop` DNS CNAME to `rakl-sketch.github.io`.
4. After DNS verification, enable **Enforce HTTPS**.

`public/CNAME` already contains `shop.rakdev.web.id` and is published with the build.

## Testing

```bash
npm run typecheck
npm test
npm run build
```

`tests/whatsapp.test.ts` covers the WhatsApp message content, variation formatting, total calculation, number normalization, and URL encoding. `tests/qris.test.ts` covers QRIS status mapping, amount normalization, webhook amount validation, sandbox detection, and HMAC signature verification.

The pre-launch database/RLS checklist is in `tests/README.md`.

## Security rules

- Never commit `.env.local`, Supabase secret keys, or service-role keys.
- Customer-facing reads are protected by RLS. Order creation goes through `create_whatsapp_order` or `create_qris_order`; purchase grants and notifications are database triggers.
- The browser never supplies a trusted price. The RPCs reload current published product prices and calculate totals themselves.
- QRIS secrets stay in Supabase Edge Function secrets. The webhook verifies HMAC-SHA256 and rejects sandbox callbacks in production.
- QRIS webhook updates are idempotent: amount mismatch is rejected, duplicate success callbacks do not create duplicate purchases or notifications.
- Admin roles are granted manually by a trusted project owner.
- Product archives stay in the private `product-files` bucket. Downloads require a matching purchase and receive a short-lived signed URL.
- Upload only products you own or are authorized to distribute. Inspect archives and test restores for backup products.
- The historical `payments` table is retained and now also stores QRIS payment metadata.

## Current scope

Implemented: storefront, four product categories, product detail, local cart, WhatsApp checkout (guest or logged-in), QRIS checkout with automatic delivery (logged-in), Supabase Auth screens, account profile/purchases/downloads/transactions, admin overview, product create/edit/publish, category create, order status management, QRIS/payment view, database schema/RLS/Storage, product announcements, order notifications, and browser push support.

Before production: apply all four migrations, grant the owner role, configure GitHub variables/secrets, set BuatQris Edge Function secrets, verify the sandbox flow end-to-end, upload real products and files, and complete the store's final terms/privacy/contact content.
