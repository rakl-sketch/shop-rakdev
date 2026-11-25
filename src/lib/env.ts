const cleanEnvValue = (value: string | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().replace(/^['\"]|['\"]$/g, '').trim();
  return cleaned || undefined;
};

const rawSupabaseUrl = cleanEnvValue(import.meta.env.VITE_SUPABASE_URL);
const isValidSupabaseUrl = (value: string | undefined): value is string => {
  if (!value || !value.startsWith('https://') || value.endsWith('/')) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) && (parsed.pathname === '/' || parsed.pathname === '');
  } catch {
    return false;
  }
};

if (rawSupabaseUrl && !isValidSupabaseUrl(rawSupabaseUrl)) {
  console.error('[Shop rakDEV] VITE_SUPABASE_URL tidak valid. Gunakan URL HTTPS tanpa trailing slash. Aplikasi berjalan dalam mode demo.');
}
export const supabaseUrl = isValidSupabaseUrl(rawSupabaseUrl) ? rawSupabaseUrl : undefined;
export const supabaseKey = cleanEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);
export const demoMode = !supabaseConfigured;
