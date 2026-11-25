import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Clock3, Copy, RefreshCw, ShieldCheck } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { verifyPayment } from '../services/orders';
import { supabase } from '../lib/supabase';
import { rupiah } from '../lib/format';
import { QRCodeSVG } from 'qrcode.react';

type PaymentInfo = { order_id: string; order_number: string; qr_code_url?: string; qr_string?: string; expires_at?: string; amount?: number };
export default function PaymentPage() {
  const { orderId = '' } = useParams(); const { toast } = useToast();
  const [info, setInfo] = useState<PaymentInfo | null>(() => { try { return JSON.parse(sessionStorage.getItem(`rakdev-payment-${orderId}`) ?? 'null') as PaymentInfo | null; } catch { return null; } });
  const [status, setStatus] = useState('pending'); const [checking, setChecking] = useState(false);
  useEffect(() => { if (!supabase || !orderId) return; void supabase.from('orders').select('id,order_number,total_amount,status,payments(qr_code_url,qr_string,expires_at)').eq('id', orderId).maybeSingle().then(({ data }) => {
    if (data) { setStatus(data.status); const payment = Array.isArray(data.payments) ? data.payments[0] : data.payments; setInfo((current) => ({ ...(current ?? { order_id: orderId, order_number: data.order_number }), qr_code_url: payment?.qr_code_url ?? current?.qr_code_url, qr_string: payment?.qr_string ?? current?.qr_string, expires_at: payment?.expires_at ?? current?.expires_at, amount: data.total_amount })); }
  }); }, [orderId]);
  const checkStatus = async () => { setChecking(true); try { const result = await verifyPayment(orderId); if (result) { setStatus(result.status); if (result.paid) toast('Pembayaran berhasil. Produk tersedia di akun kamu.', 'success'); else toast('Pembayaran belum terverifikasi.', 'info'); } } catch (error) { toast(error instanceof Error ? error.message : 'Gagal memeriksa pembayaran.', 'error'); } finally { setChecking(false); } };
  const copyOrder = async () => { await navigator.clipboard.writeText(info?.order_number ?? orderId); toast('Nomor pesanan disalin.', 'success'); };
  return <div className="page-container payment-page"><div className="payment-card"><div className={`payment-status-icon ${status === 'paid' ? 'paid' : ''}`}>{status === 'paid' ? <CheckCircle2 size={30}/> : <Clock3 size={30}/>}</div><div className="eyebrow">PAYMENT / {status.toUpperCase()}</div><h1>{status === 'paid' ? 'Payment confirmed.' : 'Complete your payment.'}</h1><p>{status === 'paid' ? 'Terima kasih. Produk digital kamu sekarang tersedia di halaman pembelian.' : 'Scan QRIS di bawah menggunakan aplikasi yang mendukung QRIS. Halaman ini akan menampilkan status terbaru setelah diverifikasi.'}</p>
    {info && <div className="payment-order-number"><span>ORDER NUMBER</span><b>{info.order_number}</b><button onClick={copyOrder} aria-label="Salin nomor pesanan"><Copy size={15}/></button></div>}
    {status !== 'paid' && <div className="qris-display">{info?.qr_code_url ? <img src={info.qr_code_url} alt="QRIS pembayaran Midtrans"/> : info?.qr_string ? <QRCodeSVG value={info.qr_string} size={220} level="M" includeMargin/> : <div className="qris-placeholder"><span>QRIS</span><small>QR pembayaran muncul setelah transaksi berhasil dibuat.</small></div>}</div>}
    {info?.amount && <div className="payment-total"><span>Total pembayaran</span><strong>{rupiah(info.amount)}</strong></div>}
    {status !== 'paid' && <div className="payment-instructions"><b>Petunjuk pembayaran</b><ol><li>Buka aplikasi bank atau e-wallet yang mendukung QRIS.</li><li>Pilih menu scan dan arahkan ke kode QR.</li><li>Periksa nama merchant dan nominal sebelum konfirmasi.</li><li>Tunggu pembayaran terverifikasi oleh sistem.</li></ol></div>}
    <Button full onClick={checkStatus} loading={checking} variant="outline"><RefreshCw size={16}/> Periksa status pembayaran</Button>
    {status === 'paid' ? <Link to="/account/purchases" className="payment-primary-link">Lihat produk yang dibeli <span>→</span></Link> : <Link to="/account/transactions" className="payment-primary-link">Lihat riwayat transaksi <span>→</span></Link>}
    <div className="payment-safe-note"><ShieldCheck size={15}/> Status pembayaran ditentukan oleh verifikasi server, bukan tampilan browser.</div>
  </div></div>;
}
