import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

export const corsHeaders = (request: Request) => {
  const configuredOrigin = Deno.env.get('APP_ORIGIN') ?? 'http://localhost:5173';
  const allowedOrigin = configuredOrigin;
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
};

export function jsonResponse(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function resolveSecretKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>;
      const match = parsed.service_role ?? parsed.default ?? Object.values(parsed)[0];
      if (match) return match;
    } catch { /* ignore invalid optional JSON */ }
  }
  throw new Error('Supabase secret key belum dikonfigurasi di Edge Function.');
}

export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) throw new Error('SUPABASE_URL tidak tersedia.');
  return createClient(url, resolveSecretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function authenticate(request: Request, client: SupabaseClient) {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('Sesi login diperlukan.');
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error('Sesi tidak valid atau sudah kedaluwarsa.');
  return data.user;
}

export function midtransBaseUrl() {
  return Deno.env.get('MIDTRANS_IS_PRODUCTION') === 'true'
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com';
}

export function midtransAuthHeader() {
  const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
  if (!serverKey) throw new Error('MIDTRANS_SERVER_KEY belum dikonfigurasi.');
  return `Basic ${btoa(`${serverKey}:`)}`;
}

export async function fetchMidtransStatus(orderNumber: string) {
  const response = await fetch(`${midtransBaseUrl()}/v2/${encodeURIComponent(orderNumber)}/status`, {
    method: 'GET', headers: { Authorization: midtransAuthHeader(), Accept: 'application/json' },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Midtrans status check gagal (${response.status}).`);
  return result as Record<string, unknown>;
}

function amountAsInteger(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? '0'));
  return Number.isFinite(parsed) ? Math.round(parsed) : -1;
}

export async function applyVerifiedMidtransStatus(client: SupabaseClient, providerOrderId: string, remote: Record<string, unknown>) {
  const { data: payment, error: paymentError } = await client.from('payments')
    .select('id,order_id,amount,orders(id,user_id,status)').eq('provider_order_id', providerOrderId).maybeSingle();
  if (paymentError || !payment) throw new Error('Referensi pembayaran tidak ditemukan.');

  const amount = amountAsInteger(remote.gross_amount);
  if (amount !== Number(payment.amount)) throw new Error('Nominal transaksi tidak cocok dengan pesanan.');

  const transactionStatus = String(remote.transaction_status ?? 'pending');
  const fraudStatus = String(remote.fraud_status ?? '');
  const isPaid = transactionStatus === 'settlement' || (transactionStatus === 'capture' && fraudStatus === 'accept');
  const currentOrder = Array.isArray(payment.orders) ? payment.orders[0] : payment.orders;
  // Ignore stale/out-of-order notifications after a purchase has already been confirmed.
  if (currentOrder?.status === 'paid' && !isPaid) return { status: 'paid', paid: true };
  const nextStatus = isPaid ? 'paid'
    : transactionStatus === 'expire' ? 'expired'
    : transactionStatus === 'cancel' ? 'cancelled'
    : transactionStatus === 'deny' || transactionStatus === 'failure' ? 'failed'
    : 'pending';

  const updatePayment = await client.from('payments').update({
    status: transactionStatus,
    provider_transaction_id: String(remote.transaction_id ?? ''),
    provider_response: remote,
  }).eq('id', payment.id);
  if (updatePayment.error) throw updatePayment.error;

  const updateOrder = await client.from('orders').update({ status: nextStatus }).eq('id', payment.order_id);
  if (updateOrder.error) throw updateOrder.error;

  if (isPaid) {
    const { data: order, error: orderError } = await client.from('orders').select('id,user_id').eq('id', payment.order_id).single();
    if (orderError || !order) throw new Error('Data pesanan tidak ditemukan.');
    const { data: items, error: itemsError } = await client.from('order_items').select('product_id').eq('order_id', payment.order_id);
    if (itemsError) throw itemsError;
    const purchases = (items ?? []).map((item: { product_id: string }) => ({
      user_id: order.user_id, order_id: order.id, product_id: item.product_id,
    }));
    if (purchases.length) {
      const { error: purchaseError } = await client.from('purchases').upsert(purchases, { onConflict: 'user_id,order_id,product_id', ignoreDuplicates: true });
      if (purchaseError) throw purchaseError;
    }
  }
  return { status: nextStatus, paid: isPaid };
}

export function hexEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

export async function sha512Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-512', data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
