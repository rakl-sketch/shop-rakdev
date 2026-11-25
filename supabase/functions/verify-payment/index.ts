import { adminClient, applyVerifiedMidtransStatus, authenticate, corsHeaders, fetchMidtransStatus, jsonResponse } from '../_shared/common.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  try {
    const client = adminClient();
    const user = await authenticate(request, client);
    const { order_id: orderId } = await request.json();
    if (typeof orderId !== 'string') return jsonResponse(request, { error: 'Order ID tidak valid.' }, 400);
    const { data: order, error } = await client.from('orders').select('id,user_id,order_number,status').eq('id', orderId).eq('user_id', user.id).maybeSingle();
    if (error || !order) return jsonResponse(request, { error: 'Pesanan tidak ditemukan.' }, 404);
    if (order.status === 'paid') return jsonResponse(request, { status: 'paid', paid: true });
    const remote = await fetchMidtransStatus(order.order_number);
    const result = await applyVerifiedMidtransStatus(client, order.order_number, remote);
    return jsonResponse(request, result);
  } catch (error) {
    console.error('verify-payment error', error instanceof Error ? error.message : 'unknown');
    return jsonResponse(request, { error: error instanceof Error ? error.message : 'Gagal memeriksa pembayaran.' }, 400);
  }
});
