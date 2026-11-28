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

export type QrisOrderInput = {
  buyerName: string;
  buyerPhone?: string;
  notes?: string;
  items: CartItem[];
};

export type QrisPayment = {
  id: string;
  provider: string;
  status: string;
  amount: number;
  qr_code_url: string | null;
  payment_url: string | null;
  expires_at: string | null;
  is_test: boolean;
  provider_response?: Record<string, unknown> | null;
};

export type QrisOrder = OrderSummary & {
  order_items: Array<{
    product_name: string;
    unit_price: number;
    quantity: number;
    line_total: number;
    variant?: string | null;
  }>;
  payments: QrisPayment | null;
};

export type QrisOrderResult = {
  order_id: string;
  order_number: string;
  total_amount: number;
  payment: {
    transaction_id: string;
    qr_url: string | null;
    qris_image: string | null;
    payment_url: string | null;
    status: string;
    expires_at: string;
    is_test: boolean;
  };
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

async function readFunctionError(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const body = await context.json() as { error?: unknown; message?: unknown };
        if (typeof body.error === 'string') return body.error;
        if (typeof body.message === 'string') return body.message;
      } catch { /* ignore non-JSON response */ }
    }
  }
  return error instanceof Error ? error.message : 'Terjadi kesalahan saat menghubungi server.';
}

/**
 * Membuat pesanan QRIS lewat Edge Function. Harga dihitung ulang di database,
 * lalu nominal tersebut dikirim ke BuatQris. Wajib login agar purchases dan
 * download otomatis terhubung ke akun pembeli.
 */
export async function createQrisOrder(input: QrisOrderInput): Promise<QrisOrderResult> {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
  const { data, error } = await supabase.functions.invoke('create-qris', {
    body: {
      buyer_name: input.buyerName.trim(),
      buyer_phone: input.buyerPhone?.trim() || null,
      notes: input.notes?.trim() || null,
      items: input.items.map(({ product, quantity }) => ({
        product_id: product.id,
        quantity,
        variant: productVariation(product) || null,
      })),
    },
  });
  if (error) throw new Error(await readFunctionError(error));
  const result = data as QrisOrderResult | null;
  if (!result?.order_id) throw new Error('Pesanan QRIS gagal dibuat.');
  return result;
}

export async function getQrisOrder(orderId: string): Promise<QrisOrder | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('orders')
    .select('id,order_number,status,total_amount,created_at,channel,buyer_name,buyer_phone,notes,order_items(product_name,unit_price,quantity,line_total,variant),payments(id,provider,status,amount,qr_code_url,payment_url,expires_at,is_test,provider_response)')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const record = data as unknown as QrisOrder & { payments?: QrisPayment | QrisPayment[] | null };
  const payments = Array.isArray(record.payments) ? record.payments[0] ?? null : record.payments ?? null;
  return { ...record, payments } as QrisOrder;
}

export async function checkQrisStatus(orderId: string): Promise<{
  order_status: string;
  payment_status: string;
  provider_status?: string;
  synced: boolean;
  is_test?: boolean;
}> {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
  const { data, error } = await supabase.functions.invoke('qris-status', { body: { order_id: orderId } });
  if (error) throw new Error(await readFunctionError(error));
  return data as {
    order_status: string;
    payment_status: string;
    provider_status?: string;
    synced: boolean;
    is_test?: boolean;
  };
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
