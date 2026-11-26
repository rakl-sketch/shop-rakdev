import type { CartItem, Product } from '../types';
import { rupiah } from './format';

/**
 * Nomor WhatsApp resmi Shop rakDEV dalam format internasional tanpa tanda "+".
 * 0881-5825-403 -> 628815825403
 */
export const WHATSAPP_NUMBER = '628815825403';
export const WHATSAPP_DISPLAY = '0881-5825-403';

export type WhatsAppOrderDetails = {
  buyerName: string;
  buyerPhone?: string;
  address?: string;
  notes?: string;
  items: CartItem[];
};

export const normalizeWhatsAppNumber = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  return digits;
};

/** Variasi produk yang tersedia dari data katalog (versi Minecraft / platform). */
export const productVariation = (product: Product) =>
  [product.minecraft_version, product.platform].map((value) => value?.trim()).filter(Boolean).join(' · ');

export function buildWhatsAppOrderMessage({ buyerName, buyerPhone, address, notes, items }: WhatsAppOrderDetails): string {
  const lines: string[] = ['*PESANAN BARU - Shop rakDEV*', ''];
  lines.push(`Nama pembeli: ${buyerName.trim()}`);
  if (buyerPhone?.trim()) lines.push(`Nomor WhatsApp: ${buyerPhone.trim()}`);
  if (address?.trim()) lines.push(`Alamat pengiriman: ${address.trim()}`);
  if (notes?.trim()) lines.push(`Catatan pesanan: ${notes.trim()}`);

  lines.push('', '*Detail produk:*');
  let total = 0;
  items.forEach((item, index) => {
    const lineTotal = item.product.price * item.quantity;
    total += lineTotal;
    lines.push(`${index + 1}. ${item.product.name}`);
    const variation = item.variant?.trim() || productVariation(item.product);
    if (variation) lines.push(`   Variasi: ${variation}`);
    lines.push(`   Jumlah: ${item.quantity}`);
    lines.push(`   Harga satuan: ${rupiah(item.product.price)}`);
    lines.push(`   Subtotal: ${rupiah(lineTotal)}`);
  });

  lines.push('', `*Total: ${rupiah(total)}*`, '');
  lines.push('Mohon konfirmasi ketersediaan produk dan instruksi pembayaran. Terima kasih.');
  return lines.join('\n');
}

export function whatsappOrderUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function whatsappChatUrl(phone: string, message?: string): string {
  const number = normalizeWhatsAppNumber(phone);
  return message ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : `https://wa.me/${number}`;
}
