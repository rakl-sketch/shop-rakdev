# Pre-launch test matrix

Run these checks in a non-production Supabase project and Midtrans Sandbox before enabling production payments.

## Authentication and authorization
- New signup always creates `profiles.role = customer`, even if a client tries to send `role=owner` in metadata.
- A customer cannot update `profiles.role` through the Data API.
- A customer cannot read another user's orders, payments, purchases, download logs, or profile.
- A customer cannot read private `product_files` metadata or list the `product-files` bucket.
- A non-admin cannot insert/update/delete products, categories, coupons, banners, or product files.

## Checkout and Midtrans
- Change the price in browser DevTools: backend still calculates using database price.
- Submit an unpublished product or a product without a current file: checkout is rejected.
- Invalid quantity, duplicate order flood, and oversized cart: request is rejected.
- Invalid webhook signature: no order status changes and no purchase row is created.
- Valid signed notification with wrong amount: no purchase row is created.
- Replayed valid notification: exactly one purchase per user/order/product.
- A pending, expired, cancelled, or denied transaction never unlocks a download.
- A paid QRIS transaction unlocks only the products in that order.

## File delivery
- A user without a purchase cannot call `download-product` for that product.
- A valid buyer receives a short-lived signed URL.
- The URL expires and cannot be used as a permanent public link.
- Repeated download attempts hit the endpoint limit.
- Review uploaded archives and confirm map/backup restore instructions before publishing.
