import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Download, ExternalLink, QrCode, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/shared/EmptyState';
import { checkQrisStatus, getQrisOrder } from '../services/orders';
import type { QrisOrder } from '../services/orders';
import { orderChannelLabel, rupiah, shortDate } from '../lib/format';

const terminalOrderStatuses = ['paid', 'expired', 'failed', 'cancelled', 'refunded'];
const terminalPaymentStatuses = ['success', 'expired', 'failed'];
const closedOrderStatuses = ['cancelled', 'refunded'];

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function PaymentPage() {
  const { orderId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<QrisOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(Date.now());
  const checkingRef = useRef(false);
  const lastErrorRef = useRef<string | null>(null);

  const loadOrder = useCallback(async (showLoading = true) => {
    if (!orderId) return;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await getQrisOrder(orderId);
      setOrder(data);
      if (!data) setError('Pesanan tidak ditemukan.');
    } catch (loadError) {
      if (showLoading) setError(loadError instanceof Error ? loadError.message : 'Gagal memuat pembayaran.');
    } finally {
      if (showLoading) setLoading(false);
    }

  }, [orderId]);

  useEffect(() => {
    if (!authLoading && user) void loadOrder();
  }, [authLoading, loadOrder, user]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const orderStatus = order?.status ?? 'pending';
  const paymentStatus = order?.payments?.status ?? 'pending';
  const isPaid = orderStatus === 'paid' || (paymentStatus === 'success' && !closedOrderStatuses.includes(orderStatus));
  const isFinal = terminalOrderStatuses.includes(orderStatus) || terminalPaymentStatuses.includes(paymentStatus);
  const needsRepair = paymentStatus === 'success' && orderStatus !== 'paid' && !closedOrderStatuses.includes(orderStatus);
  const expiresAt = order?.payments?.expires_at ? new Date(order.payments.expires_at).getTime() : 0;
  const remaining = expiresAt ? Math.max(0, expiresAt - now) : 0;
  const timeExpired = expiresAt > 0 && remaining <= 0;

  const syncStatus = useCallback(async (manual = false) => {
    if (!orderId || checkingRef.current || (isFinal && !needsRepair)) return;
    checkingRef.current = true;
    setChecking(true);
    try {
      const result = await checkQrisStatus(orderId);
      if (result.order_status !== orderStatus || result.payment_status !== paymentStatus) {
        await loadOrder(false);
      }
      if (manual) {
        toast(result.order_status === 'paid' ? 'Pembayaran diterima. Produk siap diunduh.' : 'Status pembayaran masih menunggu.', result.order_status === 'paid' ? 'success' : 'info');
      }
      lastErrorRef.current = null;
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : 'Gagal memeriksa status pembayaran.';
      if (manual || lastErrorRef.current !== message) toast(message, 'error');
      lastErrorRef.current = message;
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, [isFinal, loadOrder, needsRepair, orderId, orderStatus, paymentStatus, toast]);

  useEffect(() => {
    if (!user || !order || (isFinal && !needsRepair)) return;
    const tick = () => { if (!document.hidden) void syncStatus(false); };
    tick();
    const interval = window.setInterval(tick, 5000);
    const onVisibilityChange = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isFinal, needsRepair, order, syncStatus, user]);

  if (authLoading) return <div className="admin-loading">Memeriksa akses akun…</div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(`/payment/${orderId ?? ''}`)}`} replace/>;

  if (loading) return <div className="page-container payment-page"><div className="payment-loading">Memuat pembayaran…</div></div>;

  if (error || !order || order.channel !== 'qris' || !order.payments) {
    return <div className="page-container payment-page">
      <EmptyState
        title="Pembayaran QRIS tidak ditemukan"
        description={error ?? 'Pesanan ini tidak memiliki pembayaran QRIS yang bisa dibuka.'}
        action={<Link to="/account/transactions"><Button variant="outline">Lihat riwayat transaksi</Button></Link>}
      />
    </div>;
  }

  const refunded = orderStatus === 'refunded';
  const cancelled = orderStatus === 'cancelled';
  const expired = !isPaid && (orderStatus === 'expired' || paymentStatus === 'expired' || timeExpired);
  const failed = !isPaid && (orderStatus === 'failed' || cancelled || refunded || paymentStatus === 'failed');
  const canPay = !isPaid && !expired && !failed;
  const displayStatus = isPaid ? 'paid' : cancelled ? 'cancelled' : refunded ? 'refunded' : expired ? 'expired' : order.status;
  const testMode = Boolean(order.payments.is_test);
  const providerTotal = Number(order.payments.provider_response?.total_amount);
  const payableAmount = Number.isFinite(providerTotal) && providerTotal >= order.total_amount
    ? providerTotal
    : order.total_amount;
  const providerFee = payableAmount - order.total_amount;

  return <div className="page-container payment-page">
    <div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><Link to="/account/transactions">Transaksi</Link><span>/</span><b>Pembayaran</b></div>

    <div className="page-title-row">
      <div>
        <div className="eyebrow">QRIS PAYMENT</div>
        <h1>Finish your <em>payment.</em></h1>
        <p>Pesanan {order.order_number} · {rupiah(order.total_amount)} · {shortDate(order.created_at)}</p>
      </div>
      <Link to="/account/transactions" className="arrow-link"><ArrowLeft size={15}/> Riwayat transaksi</Link>
    </div>

    <div className="payment-grid">
      <section className="payment-main">
        <div className={`payment-state ${isPaid ? 'is-paid' : expired || failed ? 'is-failed' : ''}`} aria-live="polite">
          <div className="payment-state-head">
            <div>
              <span className="eyebrow">{isPaid ? 'PAYMENT RECEIVED' : expired || failed ? 'PAYMENT CLOSED' : 'WAITING FOR PAYMENT'}</span>
              <h2>{isPaid ? 'Pembayaran berhasil.' : refunded ? 'Pesanan telah direfund.' : cancelled ? 'Pesanan dibatalkan.' : expired ? 'QRIS sudah kedaluwarsa.' : failed ? 'Pembayaran tidak berhasil.' : 'Scan QRIS untuk membayar.'}</h2>
              <p>{isPaid
                ? 'Produk digital sudah ditambahkan ke akunmu. Buka Download Center untuk mengambil file.'
                : refunded
                  ? 'Pesanan ini sudah direfund. Hubungi admin jika kamu membutuhkan bantuan lain.'
                  : cancelled
                    ? 'Pesanan ini sudah dibatalkan. Buat pesanan baru jika kamu masih ingin membeli produk.'
                    : expired || failed
                      ? 'Pesanan ini tidak dapat dibayar lagi. Buat pesanan baru dari halaman toko.'
                      : 'Selesaikan pembayaran sebelum waktu habis. Status akan diperbarui otomatis.'}</p>
            </div>
            {isPaid ? <CheckCircle2 size={34}/> : expired || failed ? <XCircle size={34}/> : <ShieldCheck size={34}/>}
          </div>

          {testMode && <div className="payment-test-note"><ShieldCheck size={14}/> Mode sandbox BuatQris · tidak ada uang asli yang ditarik.</div>}

          {isPaid ? <div className="payment-success-actions">
            <Link to="/account/downloads"><Button><Download size={16}/> Buka Download Center</Button></Link>
            <Link to="/account/transactions"><Button variant="outline">Lihat transaksi</Button></Link>
            {needsRepair && <Button variant="outline" onClick={() => void syncStatus(true)} loading={checking}><RefreshCw size={15}/> Sinkronkan akses</Button>}
          </div> : expired || failed ? <div className="payment-success-actions">
            <Link to="/shop"><Button>Kembali ke toko <ArrowRight size={16}/></Button></Link>
            <Link to="/account/transactions"><Button variant="outline">Riwayat transaksi</Button></Link>
            {!terminalOrderStatuses.includes(orderStatus) && !terminalPaymentStatuses.includes(paymentStatus) && <Button variant="outline" onClick={() => void syncStatus(true)} loading={checking}><RefreshCw size={15}/> Cek status</Button>}
          </div> : <>
            <div className="payment-qr-wrap">
              {order.payments?.qr_code_url
                ? <img className="payment-qr" src={order.payments.qr_code_url} alt={`QRIS pembayaran ${order.order_number}`} width={260} height={260}/>
                : <div className="payment-qr-empty"><QrCode size={44}/><span>QR belum tersedia. Buka halaman pembayaran.</span></div>}
              <div className="payment-qr-meta">
                <span className="payment-method-label">QRIS · semua e-wallet & m-banking</span>
                <strong>{rupiah(payableAmount)}</strong>
                {providerFee > 0 && <small className="payment-fee-note">Termasuk kode unik / fee QRIS {rupiah(providerFee)}</small>}
                <div className="payment-timer"><Clock3 size={15}/> <span>{remaining > 0 ? <>Bayar dalam <b>{formatCountdown(remaining)}</b></> : 'Waktu pembayaran habis'}</span></div>
              </div>
            </div>

            <div className="payment-actions">
              {order.payments?.payment_url && <a className="button button-outline" href={order.payments.payment_url} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Buka halaman pembayaran</a>}
              <Button variant="outline" onClick={() => void syncStatus(true)} loading={checking}><RefreshCw size={15}/> Cek status</Button>
            </div>
            <p className="payment-help">Setelah pembayaran sukses, halaman ini berubah otomatis dan file muncul di Download Center. Jika sudah membayar tetapi status belum berubah, tekan <b>Cek status</b>.</p>
          </>}
        </div>
      </section>

      <aside className="order-summary payment-summary">
        <span className="eyebrow">ORDER DETAILS</span>
        <h3>Pesanan kamu</h3>
        <div className="payment-order-meta">
          <div><span>Nomor</span><b>{order.order_number}</b></div>
          <div><span>Channel</span><b>{orderChannelLabel(order.channel)}</b></div>
          <div><span>Status</span><b><span className={`status-pill status-${displayStatus}`}>{displayStatus}</span></b></div>
        </div>
        {(order.order_items ?? []).map((item, index) => <div className="checkout-product" key={`${item.product_name}-${index}`}>
          <div>
            <b>{item.product_name}</b>
            {item.variant && <small className="checkout-variation">Variasi: {item.variant}</small>}
            <small>{item.quantity} × {rupiah(item.unit_price)}</small>
          </div>
          <strong>{rupiah(item.line_total)}</strong>
        </div>)}
        <div className="summary-line"><span>Subtotal</span><b>{rupiah(order.total_amount)}</b></div>
        <div className="summary-line"><span>Pengiriman</span><b>Digital · otomatis</b></div>
        {providerFee > 0 && <div className="summary-line"><span>Kode unik / fee QRIS</span><b>{rupiah(providerFee)}</b></div>}
        <div className="summary-total"><span>{providerFee > 0 ? 'Total dibayar' : 'Total'}</span><strong>{rupiah(payableAmount)}</strong></div>
        {canPay && <p className="summary-security">Pembayaran aman diproses oleh BuatQris. Shop rakDEV tidak menyimpan data kartu atau PIN.</p>}
      </aside>
    </div>
  </div>;
}
