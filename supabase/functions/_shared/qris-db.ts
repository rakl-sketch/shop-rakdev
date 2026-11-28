import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { mapProviderStatus, type QrisMappedStatus } from './qris.ts';

export type QrisPaymentRow = {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  provider: string;
  provider_order_id: string;
  provider_transaction_id: string | null;
  is_test: boolean;
  provider_response?: Record<string, unknown> | null;
};

export type QrisOrderRow = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  user_id: string | null;
  buyer_name: string | null;
  channel: string | null;
};

const paymentColumns = 'id,order_id,amount,status,provider,provider_order_id,provider_transaction_id,is_test,provider_response';

function sanitizeProviderResponse(payload: Record<string, unknown>): Record<string, unknown> {
  const {
    qris_image: _qrisImage,
    secret_token: _secretToken,
    account_id: _accountId,
    ...rest
  } = payload;
  return rest;
}

export async function findPaymentByTransaction(
  client: SupabaseClient,
  transactionId: string,
): Promise<QrisPaymentRow | null> {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(transactionId)) {
    throw new Error('Transaction ID tidak valid.');
  }

  const { data, error } = await client
    .from('payments')
    .select(paymentColumns)
    .eq('provider', 'buatqris')
    .eq('provider_transaction_id', transactionId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as QrisPaymentRow;

  const { data: fallback, error: fallbackError } = await client
    .from('payments')
    .select(paymentColumns)
    .eq('provider', 'buatqris')
    .eq('provider_order_id', transactionId)
    .limit(1)
    .maybeSingle();
  if (fallbackError) throw fallbackError;
  return (fallback as QrisPaymentRow | null) ?? null;
}

export async function applyPaymentStatus(
  client: SupabaseClient,
  payment: QrisPaymentRow,
  order: QrisOrderRow,
  providerStatus: unknown,
  payload: Record<string, unknown> | null,
  options: { isTest?: boolean } = {},
): Promise<QrisMappedStatus> {
  const mapped = mapProviderStatus(providerStatus);
  const currentPaymentStatus = mapProviderStatus(payment.status).paymentStatus;
  const wouldDowngrade = (currentPaymentStatus === 'success' && mapped.paymentStatus !== 'success')
    || (currentPaymentStatus !== 'pending' && mapped.paymentStatus === 'pending')
    || (order.status === 'paid' && currentPaymentStatus !== 'success' && mapped.paymentStatus !== 'success');

  if (wouldDowngrade) {
    return {
      paymentStatus: currentPaymentStatus,
      orderStatus: order.status as QrisMappedStatus['orderStatus'],
    };
  }

  const now = new Date().toISOString();
  const paymentPatch: Record<string, unknown> = {
    status: mapped.paymentStatus,
    updated_at: now,
  };

  if (mapped.paymentStatus === 'success') paymentPatch.paid_at = now;
  if (payload) {
    paymentPatch.provider_response = {
      ...(payment.provider_response ?? {}),
      ...sanitizeProviderResponse(payload),
    };
  }
  if (typeof options.isTest === 'boolean') paymentPatch.is_test = options.isTest;
  if (!payment.provider_transaction_id && typeof payload?.transaction_id === 'string') {
    paymentPatch.provider_transaction_id = payload.transaction_id;
  }

  const { error: paymentError } = await client
    .from('payments')
    .update(paymentPatch)
    .eq('id', payment.id);
  if (paymentError) throw paymentError;

  const canChangeOrder = mapped.orderStatus !== 'pending'
    && mapped.orderStatus !== order.status
    && ['pending', 'expired', 'failed'].includes(order.status);

  if (canChangeOrder) {
    const { error: orderError } = await client
      .from('orders')
      .update({ status: mapped.orderStatus })
      .eq('id', order.id);
    if (orderError) throw orderError;
  }

  return mapped;
}
