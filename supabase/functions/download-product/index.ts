import { adminClient, authenticate, corsHeaders, jsonResponse } from '../_shared/common.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  try {
    const client = adminClient();
    const user = await authenticate(request, client);
    const { product_id: productId } = await request.json();
    if (typeof productId !== 'string') return jsonResponse(request, { error: 'Product ID tidak valid.' }, 400);

    const since = new Date(Date.now() - 60 * 1000).toISOString();
    const { count } = await client.from('download_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('requested_at', since);
    if ((count ?? 0) >= 10) return jsonResponse(request, { error: 'Batas download sementara tercapai. Coba lagi satu menit lagi.' }, 429);

    const { data: purchase, error: purchaseError } = await client.from('purchases')
      .select('id,product_id').eq('user_id', user.id).eq('product_id', productId).limit(1).maybeSingle();
    if (purchaseError || !purchase) return jsonResponse(request, { error: 'Akses download tidak tersedia untuk akun ini.' }, 403);

    const { data: file, error: fileError } = await client.from('product_files')
      .select('bucket_id,file_path,file_name').eq('product_id', productId).eq('is_current', true).maybeSingle();
    if (fileError || !file) return jsonResponse(request, { error: 'File produk belum tersedia.' }, 404);

    const { data: signed, error: signedError } = await client.storage.from(file.bucket_id).createSignedUrl(file.file_path, 60, { download: file.file_name });
    if (signedError || !signed?.signedUrl) throw signedError ?? new Error('Gagal membuat link download.');
    const { error: logError } = await client.from('download_logs').insert({ purchase_id: purchase.id, user_id: user.id, product_id: productId });
    if (logError) throw logError;
    return jsonResponse(request, { download_url: signed.signedUrl, expires_in: 60 });
  } catch (error) {
    console.error('download-product error', error instanceof Error ? error.message : 'unknown');
    return jsonResponse(request, { error: error instanceof Error ? error.message : 'Download gagal.' }, 400);
  }
});
