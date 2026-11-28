import { adminClient, jsonResponse } from '../_shared/common.ts';
import { applyPaymentStatus, findPaymentByTransaction, type QrisOrderRow } from '../_shared/qris-db.ts';
import { checkQrisWebhookAmounts, isTestValue, qrisConfig, verifyWebhookSignature } from '../_shared/qris.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok');
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Method not allowed.' }, 405);

  try {
    const rawBody = await request.text();
    const signature = request.headers.get('X-BuatQris-Signature') ?? '';
    const config = qrisConfig();

    if (!(await verifyWebhookSignature(rawBody, signature, config.webhookSecret))) {
      return jsonResponse(request, { error: 'Signature webhook tidak valid.' }, 401);
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const event = typeof payload.event === 'string' ? payload.event : '';
    if (!event.startsWith('payment.')) {
      return jsonResponse(request, { ok: true, ignored: true });
    }

    if (config.mode === 'production' && isTestValue(payload.is_test)) {
      return jsonResponse(request, { error: 'Webhook sandbox ditolak di mode production.' }, 400);
    }

    const transactionId = String(payload.transaction_id ?? '');
    if (!transactionId) return jsonResponse(request, { error: 'transaction_id tidak tersedia.' }, 400);

    const client = adminClient();
    const payment = await findPaymentByTransaction(client, transactionId);
    if (!payment) return jsonResponse(request, { error: 'Pembayaran tidak ditemukan.' }, 404);
    if (config.mode === 'production' && payment.is_test) {
      return jsonResponse(request, { error: 'Pembayaran sandbox ditolak di mode production.' }, 400);
    }

    const { data: orderData, error: orderError } = await client
      .from('orders')
      .select('id,order_number,status,total_amount,user_id,buyer_name,channel')
      .eq('id', payment.order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!orderData) return jsonResponse(request, { error: 'Pesanan tidak ditemukan.' }, 404);
    const order = orderData as QrisOrderRow;

    const amountCheck = checkQrisWebhookAmounts(
      payload,
      Number(order.total_amount),
      Number(payment.amount),
      payment.provider_response?.total_amount,
      event === 'payment.success',
    );
    if (!amountCheck.ok) {
      const messages = {
        order: 'Nominal pesanan tidak konsisten.',
        missing: 'Nominal webhook pembayaran sukses tidak tersedia.',
        amount: 'Nominal webhook tidak cocok dengan pesanan.',
        total: 'Total webhook tidak cocok dengan pesanan.',
      };
      return jsonResponse(request, { error: messages[amountCheck.reason] }, 400);
    }

    const providerStatus = typeof payload.status === 'string'
      ? payload.status
      : event.slice('payment.'.length);
    const mapped = await applyPaymentStatus(client, payment, order, providerStatus, payload, {
      isTest: isTestValue(payload.is_test),
    });

    return jsonResponse(request, {
      ok: true,
      order_status: mapped.orderStatus,
      payment_status: mapped.paymentStatus,
    });
  } catch (error) {
    console.error('[qris-webhook]', error instanceof Error ? error.message : error);
    return jsonResponse(request, { error: 'Webhook gagal diproses.' }, 500);
  }
});
