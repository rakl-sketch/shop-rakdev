import { adminClient, corsHeaders, jsonResponse } from '../_shared/common.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  try {
    const body = await request.json();
    const endpoint = body?.subscription?.endpoint ?? body?.endpoint;
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > 2048) {
      return jsonResponse(request, { error: 'Endpoint tidak valid.' }, 400);
    }
    const client = adminClient();
    if (body.action === 'unsubscribe') {
      await client.from('push_subscriptions').delete().eq('endpoint', endpoint);
      return jsonResponse(request, { ok: true });
    }
    const p256dh = body.subscription?.keys?.p256dh;
    const auth = body.subscription?.keys?.auth;
    if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 256 || auth.length > 128) {
      return jsonResponse(request, { error: 'Kunci langganan tidak valid.' }, 400);
    }
    const { error } = await client.from('push_subscriptions').upsert({ endpoint, p256dh, auth }, { onConflict: 'endpoint' });
    if (error) throw error;
    return jsonResponse(request, { ok: true });
  } catch (error) {
    console.error('push-subscribe error', error instanceof Error ? error.message : 'unknown');
    return jsonResponse(request, { error: 'Gagal menyimpan langganan.' }, 400);
  }
});
