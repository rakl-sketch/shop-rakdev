import webpush from 'npm:web-push@3.6.7';
import { adminClient } from '../_shared/common.ts';

// Dipanggil oleh Database Webhook (INSERT pada public.announcements).
Deno.serve(async (request) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || request.headers.get('x-webhook-secret') !== secret) return new Response('Unauthorized', { status: 401 });
  try {
    const payload = await request.json();
    const id = payload?.record?.id;
    if (typeof id !== 'string') return new Response('Bad request', { status: 400 });

    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const subject = Deno.env.get('VAPID_SUBJECT');
    if (!publicKey || !privateKey || !subject) throw new Error('VAPID secrets belum dikonfigurasi.');
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const client = adminClient();
    const { data: item } = await client.from('announcements').select('product_name,product_slug,image_url').eq('id', id).maybeSingle();
    if (!item) return new Response('Not found', { status: 404 });
    const { data: subs, error } = await client.from('push_subscriptions').select('endpoint,p256dh,auth');
    if (error) throw error;

    const message = JSON.stringify({
      title: '[pp] Shop rakDEV',
      body: item.product_name,
      path: `/product/${item.product_slug}`,
      image: item.image_url ?? undefined,
    });

    const expired: string[] = [];
    let sent = 0;
    for (let i = 0; i < (subs ?? []).length; i += 50) {
      const batch = (subs ?? []).slice(i, i + 50);
      await Promise.all(batch.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, message, { TTL: 86400 });
          sent += 1;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) expired.push(sub.endpoint);
        }
      }));
    }
    if (expired.length) await client.from('push_subscriptions').delete().in('endpoint', expired);
    return new Response(JSON.stringify({ sent, removed: expired.length }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('notify-product error', error instanceof Error ? error.message : 'unknown');
    return new Response('Error', { status: 500 });
  }
});
