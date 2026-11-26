import { describe, expect, it } from 'vitest';
import { buildWhatsAppOrderMessage, normalizeWhatsAppNumber, productVariation, WHATSAPP_NUMBER, whatsappOrderUrl } from '../src/lib/whatsapp';
import type { Product } from '../src/types';

const product: Product = {
  id: 'product-1',
  name: 'Server Essentials',
  slug: 'server-essentials',
  description: 'Plugin utilitas server.',
  price: 49000,
  category_slug: 'plugins',
  category_name: 'Plugins',
  minecraft_version: '1.20–1.21.x',
  platform: 'Paper / Spigot',
};

describe('WhatsApp checkout', () => {
  it('mengubah nomor lokal menjadi format internasional', () => {
    expect(normalizeWhatsAppNumber('0881-5825-403')).toBe(WHATSAPP_NUMBER);
    expect(normalizeWhatsAppNumber('+62 881 5825 403')).toBe(WHATSAPP_NUMBER);
  });

  it('menyusun variasi dari metadata produk', () => {
    expect(productVariation(product)).toBe('1.20–1.21.x · Paper / Spigot');
  });

  it('memasukkan seluruh informasi pesanan ke pesan', () => {
    const message = buildWhatsAppOrderMessage({
      buyerName: 'Budi Santoso',
      buyerPhone: '08123456789',
      address: 'Jl. Contoh No. 1, Bandung',
      notes: 'Minta versi 1.21',
      items: [{ product, quantity: 2 }],
    });

    expect(message).toContain('Budi Santoso');
    expect(message).toContain('08123456789');
    expect(message).toContain('Jl. Contoh No. 1, Bandung');
    expect(message).toContain('Minta versi 1.21');
    expect(message).toContain(product.name);
    expect(message).toContain('Variasi: 1.20–1.21.x · Paper / Spigot');
    expect(message).toContain('Jumlah: 2');
    expect(message).toContain('Harga satuan');
    expect(message).toContain('49.000');
    expect(message).toContain('Total');
    expect(message).toContain('98.000');
  });

  it('membuat URL wa.me yang ter-encode dengan benar', () => {
    const message = buildWhatsAppOrderMessage({
      buyerName: 'Budi & Siti',
      items: [{ product, quantity: 1 }],
    });
    const url = whatsappOrderUrl(message);

    expect(url.startsWith(`https://wa.me/${WHATSAPP_NUMBER}?text=`)).toBe(true);
    expect(url).not.toMatch(/\s/);
    expect(decodeURIComponent(url.split('?text=')[1])).toBe(message);
    expect(url).toContain('%26');
  });

  it('menghitung total dari harga satuan dan jumlah', () => {
    const message = buildWhatsAppOrderMessage({
      buyerName: 'Budi',
      items: [{ product, quantity: 3 }],
    });
    expect(message).toContain('147.000');
  });
});
