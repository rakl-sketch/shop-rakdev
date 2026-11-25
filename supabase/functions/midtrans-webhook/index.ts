import { adminClient, applyVerifiedMidtransStatus, corsHeaders, fetchMidtransStatus, hexEqual, jsonResponse, sha512Hex } from '../_shared/common.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  try {
    const notification = await request.json() as Record<string, unknown>;
    const orderId = String(notification.order_id ?? '');
    const statusCode = String(notification.status_code ?? '');
    const grossAmount = String(notification.gross_amount ?? '');
    const signature = String(notification.signature_key ?? '').toLowerCase();
    const signatureSecret = Deno.env.get('MIDTRANS_SIGNATURE_SECRET_KEY');
    if (!signatureSecret) throw new Error('MIDTRANS_SIGNATURE_SECRET_KEY belum dikonfigurasi.');
    if (!orderId || !statusCode || !grossAmount || !signature) return jsonResponse(request, { error: 'Payload notifikasi tidak lengkap.' }, 400);

    // Current Midtrans docs use the Signature Secret Key for this SHA-512 signature.
    const expected = await sha512Hex(orderId + statusCode + grossAmount + signatureSecret);
    if (!hexEqual(expected, signature)) return jsonResponse(request, { error: 'Signature not valid.' }, 401);

    const client = adminClient();
    // Do not trust notification fields alone: query the transaction from Midtrans server-to-server.
    const remote = await fetchMidtransStatus(orderId);
    const result = await applyVerifiedMidtransStatus(client, orderId, remote);
    return jsonResponse(request, { received: true, ...result });
  } catch (error) {
    console.error('midtrans-webhook error', error instanceof Error ? error.message : 'unknown');
    return jsonResponse(request, { error: 'Notification could not be processed.' }, 400);
  }
});
