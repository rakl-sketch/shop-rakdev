import { adminClient, authenticate, corsHeaders, jsonResponse, userClient } from '../_shared/common.ts';
import { createQrisTransaction, isTestValue, qrisConfig } from '../_shared/qris.ts';

type RequestBody = {
  buyer_name?: unknown;
  buyer_phone?: unknown;
  notes?: unknown;
  items?: unknown;
};

type RequestItem = {
  product_id: string;
  quantity: number;
  variant: string | null;
};

function readItems(value: unknown): RequestItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new Error('Keranjang tidak valid.');
  }

  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Keranjang tidak valid.');
    const record = item as Record<string, unknown>;
    const productId = typeof record.product_id === 'string' ? record.product_id : '';
    const quantity = Number(record.quantity);
    const variant = typeof record.variant === 'string' ? record.variant.trim().slice(0, 100) : null;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)) {
      throw new Error('Product ID tidak valid.');
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new Error('Jumlah produk harus antara 1 dan 10.');
    }
    return { product_id: productId, quantity, variant };
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Method not allowed.' }, 405);

  try {
    const admin = adminClient();
    await authenticate(request, admin);
    const body = await request.json() as RequestBody;
    const buyerName = typeof body.buyer_name === 'string' ? body.buyer_name.trim() : '';
    if (buyerName.length < 2) {
      return jsonResponse(request, { error: 'Nama pembeli wajib diisi minimal 2 karakter.' }, 400);
    }

    const items = readItems(body.items);
    const config = qrisConfig();
    const buyerPhone = typeof body.buyer_phone === 'string' ? body.buyer_phone.trim().slice(0, 30) : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) : '';

    const userSupabase = userClient(request);
    const { data: orderData, error: orderError } = await userSupabase.rpc('create_qris_order', {
      p_buyer_name: buyerName,
      p_buyer_phone: buyerPhone || null,
      p_notes: notes || null,
      p_items: items,
    });
    if (orderError) throw orderError;

    const order = orderData as { order_id?: string; order_number?: string; total_amount?: number } | null;
    if (!order?.order_id || !order.order_number) throw new Error('Pesanan QRIS gagal dibuat.');
    const totalAmount = Number(order.total_amount);
    if (!Number.isFinite(totalAmount) || totalAmount < 1000) throw new Error('Total pesanan QRIS tidak valid.');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!supabaseUrl) throw new Error('SUPABASE_URL tidak tersedia.');

    let transaction;
    try {
      transaction = await createQrisTransaction(config, {
        amount: totalAmount,
        description: `Shop rakDEV ${order.order_number}`,
        callbackUrl: `${supabaseUrl}/functions/v1/qris-webhook`,
      });
    } catch (error) {
      await admin.from('orders').update({ status: 'failed' }).eq('id', order.order_id);
      throw error;
    }

    if (!transaction.qr_url && !transaction.payment_url) {
      await admin.from('orders').update({ status: 'failed' }).eq('id', order.order_id);
      throw new Error('BuatQris tidak mengembalikan QR atau halaman pembayaran.');
    }

    const providerIsTest = isTestValue(transaction.is_test);
    if (config.mode === 'production' && providerIsTest) {
      await admin.from('orders').update({ status: 'failed' }).eq('id', order.order_id);
      throw new Error('BuatQris mengembalikan transaksi sandbox di mode production.');
    }

    const isTest = config.mode === 'sandbox' || providerIsTest;
    const transactionId = String(transaction.transaction_id);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const {
      qris_image: _qrisImage,
      secret_token: _secretToken,
      account_id: _accountId,
      ...providerData
    } = transaction;
    const { error: paymentError } = await admin.from('payments').insert({
      order_id: order.order_id,
      provider: 'buatqris',
      provider_order_id: transactionId,
      provider_transaction_id: transactionId,
      status: 'pending',
      amount: totalAmount,
      qr_code_url: transaction.qr_url ?? null,
      qr_string: null,
      payment_url: transaction.payment_url ?? null,
      expires_at: expiresAt,
      is_test: isTest,
      provider_response: { ...providerData, mode: config.mode },
    });
    if (paymentError) {
      await admin.from('orders').update({ status: 'failed' }).eq('id', order.order_id);
      throw new Error(paymentError.message);
    }

    return jsonResponse(request, {
      order_id: order.order_id,
      order_number: order.order_number,
      total_amount: totalAmount,
      payment: {
        transaction_id: transactionId,
        qr_url: transaction.qr_url ?? null,
        qris_image: _qrisImage ?? null,
        payment_url: transaction.payment_url ?? null,
        status: transaction.status ?? 'pending',
        expires_at: expiresAt,
        is_test: isTest,
      },
    });
  } catch (error) {
    console.error('[create-qris]', error instanceof Error ? error.message : error);
    const message = error instanceof Error ? error.message : 'Gagal membuat pembayaran QRIS.';
    return jsonResponse(request, { error: message }, 400);
  }
});
