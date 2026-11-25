import { adminClient, authenticate, corsHeaders, jsonResponse, midtransAuthHeader, midtransBaseUrl } from '../_shared/common.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  try {
    const client = adminClient();
    const user = await authenticate(request, client);
    const body = await request.json();
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length || rawItems.length > 10) return jsonResponse(request, { error: 'Keranjang harus berisi 1–10 jenis produk.' }, 400);

    // Rate limit payment creation per account to reduce order spam.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentOrders } = await client.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since);
    if ((recentOrders ?? 0) >= 8) return jsonResponse(request, { error: 'Batas pembuatan pesanan sementara tercapai. Coba lagi nanti.' }, 429);

    const quantities = new Map<string, number>();
    for (const item of rawItems) {
      if (typeof item.product_id !== 'string') continue;
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return jsonResponse(request, { error: 'Jumlah produk tidak valid.' }, 400);
      quantities.set(item.product_id, Math.min(10, (quantities.get(item.product_id) ?? 0) + quantity));
    }
    const productIds = [...quantities.keys()];
    if (!productIds.length || rawItems.some((item: { product_id?: unknown }) => typeof item.product_id !== 'string')) return jsonResponse(request, { error: 'Data keranjang tidak valid.' }, 400);

    const { data: products, error: productsError } = await client.from('products')
      .select('id,name,price,is_published').in('id', productIds);
    if (productsError) throw productsError;
    if (!products || products.length !== productIds.length) return jsonResponse(request, { error: 'Sebagian produk tidak ditemukan.' }, 400);
    const { data: files, error: filesError } = await client.from('product_files').select('product_id').in('product_id', productIds).eq('is_current', true);
    if (filesError) throw filesError;
    const readyIds = new Set((files ?? []).map((file: { product_id: string }) => file.product_id));
    if (products.some((product: { is_published: boolean; id: string }) => !product.is_published || !readyIds.has(product.id))) {
      return jsonResponse(request, { error: 'Ada produk yang belum tersedia untuk dibeli.' }, 400);
    }

    const productById = new Map(products.map((product: { id: string; name: string; price: number }) => [product.id, product]));
    const orderItems = productIds.map((id) => {
      const product = productById.get(id)!;
      const quantity = quantities.get(id)!;
      const unitPrice = Number(product.price);
      return { product_id: id, product_name: product.name, unit_price: unitPrice, quantity, line_total: unitPrice * quantity };
    });
    const total = orderItems.reduce((sum, item) => sum + item.line_total, 0);
    if (!Number.isSafeInteger(total) || total < 1000 || total > 100000000) return jsonResponse(request, { error: 'Total pembayaran di luar batas yang didukung.' }, 400);

    const orderNumber = `RK${Date.now()}${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
    const { data: order, error: orderError } = await client.from('orders').insert({
      order_number: orderNumber, user_id: user.id, status: 'pending', subtotal_amount: total, total_amount: total,
    }).select('id,order_number').single();
    if (orderError || !order) throw orderError ?? new Error('Gagal membuat pesanan.');
    const { error: itemsError } = await client.from('order_items').insert(orderItems.map((item) => ({ ...item, order_id: order.id })));
    if (itemsError) throw itemsError;

    const isProduction = Deno.env.get('MIDTRANS_IS_PRODUCTION') === 'true';
    const acquirer = Deno.env.get('MIDTRANS_QRIS_ACQUIRER') ?? 'gopay';
    const displayName = String(user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'Customer').slice(0, 40);
    const midtransBody = {
      payment_type: 'qris',
      transaction_details: { order_id: orderNumber, gross_amount: total },
      item_details: orderItems.map((item) => ({ id: item.product_id, price: item.unit_price, quantity: item.quantity, name: item.product_name.slice(0, 50) })),
      customer_details: { first_name: displayName, email: user.email ?? '' },
      qris: { acquirer },
    };
    const response = await fetch(`${midtransBaseUrl()}/v2/charge`, {
      method: 'POST',
      headers: { Authorization: midtransAuthHeader(), 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(midtransBody),
    });
    const result = await response.json();
    if (!response.ok) {
      await client.from('orders').update({ status: 'failed' }).eq('id', order.id);
      console.error('Midtrans charge failed', response.status, result.status_message ?? result.message ?? 'unknown');
      return jsonResponse(request, { error: 'Midtrans tidak dapat membuat QRIS. Periksa konfigurasi merchant dan metode pembayaran.' }, 502);
    }
    const actions = Array.isArray(result.actions) ? result.actions as Array<{ name: string; url: string }> : [];
    const qrAction = actions.find((action) => action.name === 'generate-qr-code-v2') ?? actions.find((action) => action.name === 'generate-qr-code');
    const qrCodeUrl = qrAction?.url ?? null;
    const expiresAt = result.expiry_time ? new Date(String(result.expiry_time)).toISOString() : new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error: paymentError } = await client.from('payments').insert({
      order_id: order.id, provider: 'midtrans', provider_order_id: orderNumber,
      provider_transaction_id: String(result.transaction_id ?? ''), status: String(result.transaction_status ?? 'pending'),
      amount: total, qr_code_url: qrCodeUrl, qr_string: result.qr_string ?? null, expires_at: expiresAt, provider_response: result,
    });
    if (paymentError) throw paymentError;
    return jsonResponse(request, { order_id: order.id, order_number: orderNumber, qr_code_url: qrCodeUrl, qr_string: result.qr_string ?? null, expires_at: expiresAt, total_amount: total, environment: isProduction ? 'production' : 'sandbox' }, 200);
  } catch (error) {
    console.error('create-payment error', error instanceof Error ? error.message : 'unknown');
    return jsonResponse(request, { error: error instanceof Error ? error.message : 'Terjadi kesalahan pada server.' }, 400);
  }
});
