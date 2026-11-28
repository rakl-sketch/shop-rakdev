import { adminClient, authenticate, corsHeaders, jsonResponse } from '../_shared/common.ts';
import { applyPaymentStatus, type QrisOrderRow, type QrisPaymentRow } from '../_shared/qris-db.ts';
import { checkQrisTransaction, isTestValue, qrisConfig, qrisMode } from '../_shared/qris.ts';

type RequestBody = { order_id?: unknown };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Method not allowed.' }, 405);

  try {
    const client = adminClient();
    const user = await authenticate(request, client);
    const body = await request.json() as RequestBody;
    const orderId = typeof body.order_id === 'string' ? body.order_id : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
      return jsonResponse(request, { error: 'Order ID tidak valid.' }, 400);
    }

    const { data: orderData, error: orderError } = await client
      .from('orders')
      .select('id,order_number,status,total_amount,user_id,buyer_name,channel')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!orderData) return jsonResponse(request, { error: 'Pesanan tidak ditemukan.' }, 404);
    const order = orderData as QrisOrderRow;

    const { data: profile } = await client
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';
    if (order.user_id !== user.id && !isAdmin) {
      return jsonResponse(request, { error: 'Akses pembayaran ditolak.' }, 403);
    }

    const { data: paymentData, error: paymentError } = await client
      .from('payments')
      .select('id,order_id,amount,status,provider,provider_order_id,provider_transaction_id,is_test,provider_response')
      .eq('order_id', orderId)
      .eq('provider', 'buatqris')
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!paymentData) return jsonResponse(request, { error: 'Pembayaran QRIS tidak ditemukan.' }, 404);
    const payment = paymentData as QrisPaymentRow;
    if (qrisMode() === 'production' && payment.is_test) {
      return jsonResponse(request, { error: 'Pembayaran sandbox tidak dapat diproses di mode production.' }, 400);
    }

    if (payment.status === 'success') {
      if (order.status !== 'paid' && ['pending', 'expired', 'failed'].includes(order.status)) {
        const { error: repairError } = await client.from('orders').update({ status: 'paid' }).eq('id', order.id);
        if (repairError) throw repairError;
        order.status = 'paid';
      }
      return jsonResponse(request, {
        order_status: order.status,
        payment_status: payment.status,
        synced: false,
        is_test: payment.is_test,
      });
    }

    if (order.status === 'paid') {
      return jsonResponse(request, {
        order_status: order.status,
        payment_status: payment.status,
        synced: false,
        is_test: payment.is_test,
      });
    }

    const config = qrisConfig();
    const transactionId = payment.provider_transaction_id || payment.provider_order_id;
    const provider = await checkQrisTransaction(config, transactionId);
    const providerStatus = typeof provider.status === 'string' ? provider.status : 'pending';
    const providerIsTest = isTestValue(provider.is_test);
    if (qrisMode() === 'production' && providerIsTest) {
      return jsonResponse(request, { error: 'BuatQris mengembalikan status sandbox di mode production.' }, 400);
    }
    const isTest = providerIsTest || payment.is_test;
    const mapped = await applyPaymentStatus(client, payment, order, providerStatus, provider, {
      isTest,
    });

    const { data: refreshed } = await client
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .maybeSingle();

    return jsonResponse(request, {
      order_status: refreshed?.status ?? order.status,
      payment_status: mapped.paymentStatus,
      provider_status: providerStatus,
      synced: true,
      is_test: isTest,
    });
  } catch (error) {
    console.error('[qris-status]', error instanceof Error ? error.message : error);
    const message = error instanceof Error ? error.message : 'Gagal memeriksa status pembayaran.';
    return jsonResponse(request, { error: message }, 400);
  }
});
