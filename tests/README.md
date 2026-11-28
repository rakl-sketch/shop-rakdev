# Pre-launch test matrix

Run these checks in a non-production Supabase project before publishing. The automated WhatsApp and QRIS helper tests run with `npm test`.

## Authentication and authorization
- New signup always creates `profiles.role = customer`, even if a client sends `role=owner` in metadata.
- A customer cannot update `profiles.role` through the Data API.
- A customer cannot read another user's orders, notifications, purchases, download logs, or profile.
- A customer cannot read private `product_files` metadata or list the `product-files` bucket.
- A non-admin cannot insert/update/delete products, categories, coupons, banners, or product files.
- Only admin/owner can update order status.

## WhatsApp checkout
- Guest checkout works without login; the order is stored with `user_id = NULL`.
- Logged-in checkout links the order to the current account.
- Change the price in browser DevTools: the `create_whatsapp_order` RPC still uses the database price.
- Submit an unpublished product: the RPC rejects the order.
- Submit an invalid quantity, duplicate product, or oversized cart: the RPC rejects the request.
- The generated `wa.me/628815825403?text=...` message contains product name, variation, quantity, unit price, line subtotal, total, buyer name, address, and notes.
- The message URL is correctly percent-encoded (newlines, `&`, spaces).
- The cart total and the message total match.
- Checkout opens WhatsApp on Android and desktop; the cart clears after the message is opened.
- If the RPC fails, WhatsApp still opens and the UI shows a clear warning instead of pretending the order was saved.

## QRIS checkout (BuatQris)
- With `VITE_QRIS_ENABLED` unset/false, checkout defaults to WhatsApp and the QRIS option is disabled with a "segera aktif" note.
- Set `VITE_QRIS_ENABLED=true` in GitHub Actions variables and redeploy only after the secrets below are configured.
- QRIS checkout is blocked for guests; WhatsApp checkout remains available.
- The `create-qris` Edge Function rejects a missing/invalid session.
- Change the price in browser DevTools: `create_qris_order` still uses the database price.
- Submit an unpublished product or a product without an active file: the RPC rejects the order.
- Sandbox requests include `test=1`; production requests do not.
- The QRIS amount sent to BuatQris equals the server-calculated order total.
- `/payment/:orderId` shows the sandbox badge, QR/payment link, total, and timer.
- When the 15-minute timer reaches zero, the QR is hidden and the page asks the buyer to create a new order.
- If BuatQris returns `total_amount` with a unique code/fee, the payment page shows the payable total separately from the order subtotal.
- Webhook with a bad signature returns 401 and does not change the order.
- Webhook with a mismatched amount returns 400 and does not change the order.
- Duplicate `payment.success` callbacks do not duplicate purchases or notifications.
- `payment.expired` and `payment.failed` close the order without unlocking downloads.
- A paid QRIS order creates exactly one purchase per product and unlocks Download Center.
- Production mode rejects webhooks with `is_test: true` and status checks for payment rows created in sandbox mode.
- BuatQris secrets are present only in Edge Function secrets, never in the browser bundle.

## Orders and purchases
- A new order creates one notification for every admin/owner.
- A status change creates one notification for the buyer (account orders only).
- Marking an order `paid` creates exactly one purchase per user/order/product.
- Repeating the same status update does not create duplicate purchases or duplicate notifications.
- A pending, expired, cancelled, or failed order never unlocks a download.
- A paid order unlocks only the products in that order.
- Guest orders are visible to admins but not to other customers.

## Notifications
- The bell shows product announcements and account notifications.
- Unread count decreases after opening the panel.
- Realtime inserts appear without a page refresh.
- The same realtime event does not toast repeatedly.
- Browser push permission denied/unsupported states are explained in the panel.
- Push subscriptions can be created and removed.
- Notification panel and toasts are usable on mobile widths.

## File delivery
- A user without a purchase cannot call `download-product` for that product.
- A valid buyer receives a short-lived signed URL.
- The URL expires and cannot be used as a permanent public link.
- Repeated download attempts hit the endpoint limit.
- Review uploaded archives and confirm map/backup restore instructions before publishing.

## Historical data
- The `payments` table remains readable by admins for old Midtrans records and new QRIS records.
- No migration drops tables or deletes existing rows.
