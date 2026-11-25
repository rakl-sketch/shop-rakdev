import { createClient } from '@supabase/supabase-js';
import { supabaseConfigured, supabaseKey, supabaseUrl } from './env';

export const supabase = (() => {
  if (!supabaseConfigured || !supabaseUrl || !supabaseKey) return null;

  try {
    const parsedUrl = new URL(supabaseUrl);
    if (parsedUrl.protocol !== 'https:' || parsedUrl.pathname !== '/' && parsedUrl.pathname !== '') {
      throw new Error('VITE_SUPABASE_URL harus berupa origin HTTPS tanpa path atau trailing slash.');
    }
    return createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { headers: { 'X-Client-Info': 'shop-rakdev-web' } },
    });
  } catch (error) {
    console.error('[Shop rakDEV] Supabase gagal diinisialisasi. Aplikasi berjalan dalam mode demo.', error);
    return null;
  }
})();
