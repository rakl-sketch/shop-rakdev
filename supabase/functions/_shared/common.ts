import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

export const corsHeaders = (request: Request) => {
  const configuredOrigin = Deno.env.get('APP_ORIGIN') ?? 'http://localhost:5173';
  return {
    'Access-Control-Allow-Origin': configuredOrigin,
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
