import { supabase } from '../lib/supabase';
import { productVariation } from '../lib/whatsapp';
import type { CartItem, OrderStatus, OrderSummary } from '../types';

export type WhatsAppOrderInput = {
  buyerName: string;
  buyerPhone?: string;
  address?: string;
  notes?: string;
  items: CartItem[];
};

export type WhatsAppOrderResult = {
  order_id: string;
  order_number: string;
  total_amount: number;
};

/**
 * Simpan pesanan WhatsApp ke database. Harga selalu dihitung ulang oleh
 * fungsi PostgreSQL `create_whatsapp_order`, bukan dari nilai di browser.
 * Checkout tetap bisa berjalan tanpa login; pesanan tamu disimpan dengan
 * user_id NULL dan hanya dapat dibaca admin.
 */
export async function createWhatsAppOrder(input: WhatsAppOrderInput): Promise<WhatsAppOrderResult | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('create_whatsapp_order', {
    p_buyer_name: input.buyerName.trim(),
    p_buyer_phone: input.buyerPhone?.trim() || null,
    p_shipping_address: input.address?.trim() || null,
    p_notes: input.notes?.trim() || null,
    p_items: input.items.map(({ product, quantity }) => ({
      product_id: product.id,
      quantity,
      variant: productVariation(product) || null,
    })),
  });
  if (error) throw error;
  return data as WhatsAppOrderResult;
}

export async function getMyOrders(): Promise<OrderSummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('orders')
    .select('id,order_number,status,total_amount,created_at,channel,buyer_name,buyer_phone,shipping_address,notes')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrderSummary[];
}

/** Dipakai admin. RLS membatasi perubahan hanya untuk role admin/owner. */
export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
  const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
  if (error) throw error;
}
