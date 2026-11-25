import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { useCart } from '../app/CartProvider';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { createPayment } from '../services/orders';
import { rupiah } from '../lib/format';
import { demoMode } from '../lib/env';

export default function CheckoutPage() {
  const { user } = useAuth(); const { items, subtotal, clear } = useCart(); const [loading, setLoading] = useState(false); const { toast } = useToast(); const navigate = useNavigate();
  if (!user) return <Navigate to="/login?next=/checkout" replace/>;
  if (!items.length) return <Navigate to="/cart" replace/>;
  const submit = async () => {
    if (demoMode) { toast('Hubungkan Supabase dan deploy fungsi pembayaran untuk mengaktifkan checkout.', 'info'); return; }
    setLoading(true);
    try {
      const payment = await createPayment(items);
      sessionStorage.setItem(`rakdev-payment-${payment.order_id}`, JSON.stringify({ ...payment, amount: payment.total_amount }));
      clear(); navigate(`/payment/${payment.order_id}`);
    } catch (error) { toast(error instanceof Error ? error.message : 'Gagal membuat pesanan.', 'error'); }
    finally { setLoading(false); }
  };
  return <div className="page-container checkout-page"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><Link to="/cart">Keranjang</Link><span>/</span><b>Checkout</b></div><div className="page-title-row"><div><div className="eyebrow">SECURE CHECKOUT</div><h1>Complete your <em>order.</em></h1><p>Periksa kembali produk sebelum membuat pembayaran.</p></div></div>
    <div className="checkout-grid"><section className="checkout-main"><div className="checkout-panel"><div className="checkout-panel-title"><span className="step-badge">01</span><div><h3>Informasi akun</h3><p>Produk akan terhubung dengan akun ini.</p></div></div><div className="account-checkout"><span className="account-avatar">{(user.email ?? 'U').slice(0,1).toUpperCase()}</span><span><b>{user.email}</b><small>Akun pelanggan</small></span><ShieldCheck size={18}/></div></div>
      <div className="checkout-panel"><div className="checkout-panel-title"><span className="step-badge">02</span><div><h3>Metode pembayaran</h3><p>Pembayaran digital melalui QRIS.</p></div></div><div className="payment-method-selected"><div className="qris-symbol">QR</div><span><b>QRIS via Midtrans</b><small>Scan menggunakan aplikasi pembayaran yang mendukung QRIS.</small></span><span className="selected-check">✓</span></div></div>
      <div className="checkout-info"><LockKeyhole size={17}/><span>Data pembayaran diproses melalui Midtrans. Shop rakDEV tidak menyimpan detail akun pembayaran kamu.</span></div>
    </section><aside className="order-summary checkout-summary"><span className="eyebrow">ORDER DETAILS</span><h3>Pesanan kamu</h3>{items.map(({ product, quantity }) => <div className="checkout-product" key={product.id}><div><b>{product.name}</b><small>{quantity} × {rupiah(product.price)}</small></div><strong>{rupiah(product.price * quantity)}</strong></div>)}<div className="summary-line"><span>Subtotal</span><b>{rupiah(subtotal)}</b></div><div className="summary-line"><span>Biaya</span><b>Gratis</b></div><div className="summary-total"><span>Total pembayaran</span><strong>{rupiah(subtotal)}</strong></div><Button full onClick={submit} loading={loading} disabled={demoMode}>Buat pembayaran <ArrowRight size={16}/></Button>{demoMode && <small className="muted-note">Mode preview: transaksi belum diaktifkan.</small>}<Link to="/cart" className="back-to-cart"><ArrowLeft size={14}/> Kembali ke keranjang</Link></aside></div>
  </div>;
}
