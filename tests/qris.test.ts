import { describe, expect, it } from 'vitest';
import {
  buildCreateQrisFields,
  checkQrisWebhookAmounts,
  isTestValue,
  mapProviderStatus,
  normalizeQrisAmount,
  verifyWebhookSignature,
  type QrisConfig,
} from '../supabase/functions/_shared/qris';

const config: QrisConfig = {
  accountId: 'account-test',
  secretToken: 'secret-test',
  webhookSecret: 'webhook-test',
  mode: 'sandbox',
  baseUrl: 'https://api.buatqris.site',
  qrisMethod: 'qris_two',
  umkmName: 'Shop rakDEV',
};

async function signature(body: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const value = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('QRIS checkout', () => {
  it('memetakan status provider ke status pembayaran dan pesanan', () => {
    expect(mapProviderStatus('success')).toEqual({ paymentStatus: 'success', orderStatus: 'paid' });
    expect(mapProviderStatus('pending')).toEqual({ paymentStatus: 'pending', orderStatus: 'pending' });
    expect(mapProviderStatus('expired')).toEqual({ paymentStatus: 'expired', orderStatus: 'expired' });
    expect(mapProviderStatus('failed')).toEqual({ paymentStatus: 'failed', orderStatus: 'failed' });
    expect(mapProviderStatus(undefined)).toEqual({ paymentStatus: 'pending', orderStatus: 'pending' });
  });

  it('menormalkan nominal dan menolak nilai tidak valid', () => {
    expect(normalizeQrisAmount('25000')).toBe(25000);
    expect(normalizeQrisAmount(25000.4)).toBe(25000);
    expect(normalizeQrisAmount(0)).toBeNull();
    expect(normalizeQrisAmount('abc')).toBeNull();
    expect(normalizeQrisAmount(-1)).toBeNull();
  });

  it('mendeteksi penanda transaksi sandbox dari berbagai tipe payload', () => {
    expect(isTestValue(true)).toBe(true);
    expect(isTestValue('true')).toBe(true);
    expect(isTestValue(1)).toBe(true);
    expect(isTestValue('1')).toBe(true);
    expect(isTestValue(false)).toBe(false);
    expect(isTestValue('false')).toBe(false);
    expect(isTestValue(undefined)).toBe(false);
  });

  it('memvalidasi nominal webhook terhadap nominal dasar dan total yang harus dibayar', () => {
    const base = 25000;
    const payable = 25500;
    expect(checkQrisWebhookAmounts({ amount: 25000 }, base, base, payable, true)).toEqual({ ok: true });
    expect(checkQrisWebhookAmounts({ amount: 25500 }, base, base, payable, true)).toEqual({ ok: true });
    expect(checkQrisWebhookAmounts({ amount: 25000, total_amount: 25500 }, base, base, payable, true)).toEqual({ ok: true });
    expect(checkQrisWebhookAmounts({ amount: 25000 }, base, base, undefined, true)).toEqual({ ok: true });
    expect(checkQrisWebhookAmounts({ amount: 26000 }, base, base, payable, true)).toEqual({ ok: false, reason: 'amount' });
    expect(checkQrisWebhookAmounts({ total_amount: 26000 }, base, base, payable, true)).toEqual({ ok: false, reason: 'total' });
    expect(checkQrisWebhookAmounts({}, base, base, payable, true)).toEqual({ ok: false, reason: 'missing' });
    expect(checkQrisWebhookAmounts({}, base, base, payable, false)).toEqual({ ok: true });
    expect(checkQrisWebhookAmounts({ amount: 25000 }, base, 24000, payable, true)).toEqual({ ok: false, reason: 'order' });
  });

  it('mengirim test=1 hanya pada mode sandbox', () => {
    const sandbox = buildCreateQrisFields(config, {
      amount: 25000,
      description: 'Shop rakDEV QR-1',
      callbackUrl: 'https://example.com/webhook',
    });
    expect(sandbox.test).toBe('1');
    expect(sandbox.amount).toBe('25000');
    expect(sandbox.callback_url).toBe('https://example.com/webhook');

    const production = buildCreateQrisFields({ ...config, mode: 'production' }, {
      amount: 25000,
      description: 'Shop rakDEV QR-1',
      callbackUrl: 'https://example.com/webhook',
    });
    expect(production.test).toBeUndefined();
  });

  it('memverifikasi signature webhook HMAC-SHA256', async () => {
    const body = JSON.stringify({ event: 'payment.success', transaction_id: '1001', amount: 25000 });
    const digest = await signature(body, config.webhookSecret);

    await expect(verifyWebhookSignature(body, `sha256=${digest}`, config.webhookSecret)).resolves.toBe(true);
    await expect(verifyWebhookSignature(body, digest, config.webhookSecret)).resolves.toBe(true);
    await expect(verifyWebhookSignature(body, `sha256=${digest.toUpperCase()}`, config.webhookSecret)).resolves.toBe(true);
    await expect(verifyWebhookSignature(body, `sha256=${'0'.repeat(64)}`, config.webhookSecret)).resolves.toBe(false);
    await expect(verifyWebhookSignature(`${body} `, `sha256=${digest}`, config.webhookSecret)).resolves.toBe(false);
  });
});
