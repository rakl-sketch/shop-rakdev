export type QrisMode = 'sandbox' | 'production';

export type QrisConfig = {
  accountId: string;
  secretToken: string;
  webhookSecret: string;
  mode: QrisMode;
  baseUrl: string;
  qrisMethod: string;
  umkmName: string;
};

export type QrisTransaction = {
  transaction_id: string;
  qr_url?: string | null;
  qris_image?: string | null;
  payment_url?: string | null;
  amount?: number | string;
  total_amount?: number | string;
  status?: string;
  [key: string]: unknown;
};

export type QrisMappedStatus = {
  paymentStatus: 'pending' | 'success' | 'expired' | 'failed';
  orderStatus: 'pending' | 'paid' | 'expired' | 'failed' | 'cancelled' | 'refunded';
};

function env(key: string): string | undefined {
  const runtime = globalThis as typeof globalThis & {
    Deno?: { env: { get: (name: string) => string | undefined } };
  };
  return runtime.Deno?.env.get(key)?.trim() || undefined;
}

export function qrisMode(): QrisMode {
  return env('BUATQRIS_MODE')?.toLowerCase() === 'production' ? 'production' : 'sandbox';
}

export function qrisConfig(): QrisConfig {
  const accountId = env('BUATQRIS_ACCOUNT_ID');
  const secretToken = env('BUATQRIS_SECRET_TOKEN');
  if (!accountId || !secretToken) {
    throw new Error('BuatQris belum dikonfigurasi di Edge Function secrets.');
  }

  return {
    accountId,
    secretToken,
    webhookSecret: env('BUATQRIS_WEBHOOK_SECRET') || secretToken,
    mode: qrisMode(),
    baseUrl: env('BUATQRIS_BASE_URL') || 'https://api.buatqris.site',
    qrisMethod: env('BUATQRIS_QRIS_METHOD') || 'qris_two',
    umkmName: (env('BUATQRIS_UMKM_NAME') || 'Shop rakDEV').slice(0, 15),
  };
}

export function normalizeQrisAmount(value: unknown): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
}

export function isTestValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

export type QrisAmountCheckReason = 'order' | 'missing' | 'amount' | 'total';

export function checkQrisWebhookAmounts(
  payload: Record<string, unknown>,
  orderTotal: number,
  paymentAmount: number,
  providerTotal: unknown,
  requireAmount: boolean,
): { ok: true } | { ok: false; reason: QrisAmountCheckReason } {
  if (orderTotal !== paymentAmount) return { ok: false, reason: 'order' };

  const providerTotalNumber = Number(providerTotal);
  const expectedPayable = Number.isFinite(providerTotalNumber) && providerTotalNumber >= paymentAmount
    ? providerTotalNumber
    : paymentAmount;
  const amount = normalizeQrisAmount(payload.amount);
  const totalAmount = normalizeQrisAmount(payload.total_amount);

  if (amount === null && totalAmount === null) {
    return requireAmount ? { ok: false, reason: 'missing' } : { ok: true };
  }
  if (amount !== null && amount !== paymentAmount && amount !== expectedPayable) {
    return { ok: false, reason: 'amount' };
  }
  if (totalAmount !== null && totalAmount !== expectedPayable && totalAmount !== paymentAmount) {
    return { ok: false, reason: 'total' };
  }
  return { ok: true };
}

export function mapProviderStatus(value: unknown): QrisMappedStatus {
  switch (String(value ?? '').toLowerCase()) {
    case 'success':
    case 'paid':
      return { paymentStatus: 'success', orderStatus: 'paid' };
    case 'expired':
      return { paymentStatus: 'expired', orderStatus: 'expired' };
    case 'failed':
      return { paymentStatus: 'failed', orderStatus: 'failed' };
    default:
      return { paymentStatus: 'pending', orderStatus: 'pending' };
  }
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyWebhookSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const received = signature.trim().toLowerCase();
  if (!received) return false;
  const digest = await hmacHex(secret, rawBody);
  return timingSafeEqual(`sha256=${digest}`, received) || timingSafeEqual(digest, received);
}

export function buildCreateQrisFields(
  config: QrisConfig,
  input: { amount: number; description: string; callbackUrl: string },
): Record<string, string> {
  const fields: Record<string, string> = {
    action: 'api_create_qris',
    account_id: config.accountId,
    secret_token: config.secretToken,
    amount: String(Math.round(input.amount)),
    description: input.description.slice(0, 200),
    qris_method: config.qrisMethod,
    umkm_name: config.umkmName,
    callback_url: input.callbackUrl,
  };
  if (config.mode === 'sandbox') fields.test = '1';
  return fields;
}

async function postForm(baseUrl: string, fields: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Respons BuatQris tidak valid (HTTP ${response.status}).`);
  }
  const failed = data.success === false || data.success === 0 || data.success === 'false' || data.success === '0';
  if (!response.ok || failed) {
    const message = typeof data.message === 'string' ? data.message : `BuatQris HTTP ${response.status}.`;
    throw new Error(message);
  }
  return data;
}

export async function createQrisTransaction(
  config: QrisConfig,
  input: { amount: number; description: string; callbackUrl: string },
): Promise<QrisTransaction> {
  const result = await postForm(config.baseUrl, buildCreateQrisFields(config, input));
  const data = (result.data && typeof result.data === 'object' ? result.data : result) as QrisTransaction;
  if (!data || !data.transaction_id) {
    throw new Error('BuatQris tidak mengembalikan transaction_id.');
  }
  return data;
}

export async function checkQrisTransaction(config: QrisConfig, transactionId: string): Promise<Record<string, unknown>> {
  const result = await postForm(config.baseUrl, {
    action: 'api_check_status',
    account_id: config.accountId,
    secret_token: config.secretToken,
    transaction_id: transactionId,
  });
  return (result.data && typeof result.data === 'object' ? result.data : result) as Record<string, unknown>;
}
