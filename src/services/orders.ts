import { supabase } from '../lib/supabase';
import type { CartItem } from '../types';

export async function createPayment(items: CartItem[]) {
  if (!supabase) throw new Error('Hubungkan Supabase terlebih dahulu. Mode preview tidak memproses pembayaran.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Silakan login sebelum checkout.');
  const response = await supabase.functions.invoke('create-payment', {
    body: { items: items.map(({ product, quantity }) => ({ product_id: product.id, quantity })) },
  });
  if (response.error) throw new Error(response.error.message || 'Gagal membuat pembayaran.');
  return response.data as { order_id: string; order_number: string; total_amount: number; qr_code_url?: string | null; qr_string?: string | null; expires_at?: string; environment?: 'sandbox' | 'production' };
}

export async function verifyPayment(orderId: string) {
  if (!supabase) return null;
  const response = await supabase.functions.invoke('verify-payment', { body: { order_id: orderId } });
  if (response.error) throw new Error(response.error.message);
  return response.data as { status: string; paid: boolean };
}

export async function getMyOrders() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('orders')
    .select('id,order_number,status,total_amount,created_at').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
