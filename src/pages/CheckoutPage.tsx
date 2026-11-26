import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MapPin, MessageCircle, Phone, ShieldCheck, StickyNote, UserRound } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { useCart } from '../app/CartProvider';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { createWhatsAppOrder } from '../services/orders';
import { rupiah } from '../lib/format';
import { buildWhatsAppOrderMessage, productVariation, WHATSAPP_DISPLAY, whatsappOrderUrl } from '../lib/whatsapp';
import { supabaseConfigured } from '../lib/env';

export default function CheckoutPage() {
  const { user, profile } = useAuth();
  const { items, subtotal, clear } = useCart();
  const { toast } = useToast();
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBuyerName((current) => current || profile?.display_name || String(user?.user_metadata?.display_name ?? '') || '');
  }, [profile?.display_name, user]);

  if (!items.length) return <Navigate to="/cart" replace/>;

  const openWhatsApp = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (buyerName.trim().length < 2) {
      toast('Nama pembeli wajib diisi minimal 2 karakter.', 'error');
      return;
    }

    const message = buildWhatsAppOrderMessage({ buyerName, buyerPhone, address, notes, items });
    openWhatsApp(whatsappOrderUrl(message));

    if (!supabaseConfigured) {
      clear();
      toast('Pesanan dibuka di WhatsApp. Pencatatan database belum aktif.', 'info');
      return;
    }

    setSaving(true);
    try {
      const order = await createWhatsAppOrder({ buyerName, buyerPhone, address, notes, items });
      if (order) toast(`Pesanan ${order.order_number} tercatat. Lanjutkan konfirmasi di WhatsApp.`, 'success');
      else toast('Pesanan dibuka di WhatsApp. Lanjutkan konfirmasi dengan admin.', 'success');
    } catch (error) {
      console.error('[Shop rakDEV] Gagal menyimpan pesanan WhatsApp:', error);
      toast('Pesanan sudah dibuka di WhatsApp, tetapi pencatatan ke database gagal. Admin tetap bisa memproses pesanmu.', 'error');
    } finally {
      setSaving(false);
      clear();
    }
  };

  return <div className="page-container checkout-page">
    <div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><Link to="/cart">Keranjang</Link><span>/</span><b>Checkout</b></div>
    <div className="page-title-row">
      <div>
        <div className="eyebrow">WHATSAPP CHECKOUT</div>
        <h1>Complete your <em>order.</em></h1>
        <p>Isi data pesanan, lalu lanjutkan konfirmasi langsung dengan admin melalui WhatsApp.</p>
      </div>
      <Link to="/cart" className="arrow-link"><ArrowLeft size={15}/> Kembali ke keranjang</Link>
    </div>

    <div className="checkout-grid">
      <section className="checkout-main">
        <form id="checkout-form" className="checkout-panel checkout-form" onSubmit={submit}>
          <div className="checkout-panel-title">
            <span className="step-badge">01</span>
            <div><h3>Data pembeli</h3><p>Data ini akan dimasukkan otomatis ke pesan WhatsApp.</p></div>
          </div>

          <div className="checkout-account-row">
            <span className="account-avatar"><UserRound size={16}/></span>
            <span>
              <b>{user ? (profile?.display_name || user.email) : 'Checkout tanpa login'}</b>
              <small>{user ? 'Pesanan akan tersimpan di akun ini.' : 'Login agar pesanan tersimpan di akun dan mudah dilacak.'}</small>
            </span>
            {!user && <Link to="/login?next=/checkout">Masuk</Link>}
            {user && <ShieldCheck size={18}/>}
          </div>

          <div className="checkout-fields">
            <label className="checkout-field">
              <span><UserRound size={14}/> Nama pembeli <b>*</b></span>
              <input value={buyerName} onChange={(event) => setBuyerName(event.target.value)} placeholder="Nama lengkap" required minLength={2} maxLength={120} autoComplete="name"/>
            </label>
            <label className="checkout-field">
              <span><Phone size={14}/> Nomor WhatsApp <small>opsional</small></span>
              <input value={buyerPhone} onChange={(event) => setBuyerPhone(event.target.value)} placeholder="08xxxxxxxxxx" maxLength={30} inputMode="tel" autoComplete="tel"/>
            </label>
            <label className="checkout-field checkout-field-full">
              <span><MapPin size={14}/> Alamat pengiriman <small>opsional</small></span>
              <textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Alamat atau keterangan pengiriman jika diperlukan" rows={2} maxLength={500} autoComplete="street-address"/>
            </label>
            <label className="checkout-field checkout-field-full">
              <span><StickyNote size={14}/> Catatan pesanan <small>opsional</small></span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contoh: minta versi Minecraft tertentu, jam konfirmasi, atau catatan lain" rows={3} maxLength={1000}/>
            </label>
          </div>

          <div className="checkout-info">
            <MessageCircle size={17}/>
            <span>Pesanan dikirim ke WhatsApp admin <b>{WHATSAPP_DISPLAY}</b>. Pembayaran dan konfirmasi dilakukan langsung melalui WhatsApp, bukan melalui website.</span>
          </div>
        </form>

        <div className="checkout-panel checkout-steps">
          <div className="checkout-panel-title">
            <span className="step-badge">02</span>
            <div><h3>Cara pesan</h3><p>Alur singkat setelah tombol WhatsApp ditekan.</p></div>
          </div>
          <ol className="checkout-step-list">
            <li><span>1</span><div><b>Pesan otomatis terisi</b><small>Nama produk, variasi, jumlah, harga, total, nama, alamat, dan catatan sudah disusun.</small></div></li>
            <li><span>2</span><div><b>Konfirmasi dengan admin</b><small>Admin memeriksa ketersediaan produk dan memberikan instruksi pembayaran.</small></div></li>
            <li><span>3</span><div><b>Terima produk</b><small>Setelah pembayaran dikonfirmasi, produk digital dikirim atau dibuka di akun.</small></div></li>
          </ol>
        </div>
      </section>

      <aside className="order-summary checkout-summary">
        <span className="eyebrow">ORDER DETAILS</span>
        <h3>Pesanan kamu</h3>
        {items.map(({ product, quantity, variant }) => {
          const variation = variant || productVariation(product);
          return <div className="checkout-product" key={product.id}>
            <div>
              <b>{product.name}</b>
              {variation && <small className="checkout-variation">Variasi: {variation}</small>}
              <small>{quantity} × {rupiah(product.price)}</small>
            </div>
            <strong>{rupiah(product.price * quantity)}</strong>
          </div>;
        })}
        <div className="summary-line"><span>Subtotal</span><b>{rupiah(subtotal)}</b></div>
        <div className="summary-line"><span>Biaya pengiriman</span><b>Gratis · digital</b></div>
        <div className="summary-total"><span>Total pesanan</span><strong>{rupiah(subtotal)}</strong></div>
        <Button full type="submit" form="checkout-form" loading={saving} className="button-whatsapp">
          <MessageCircle size={17}/> Pesan via WhatsApp <ArrowRight size={16}/>
        </Button>
        <p className="summary-security">Tidak ada pembayaran otomatis di website. Konfirmasi akhir dilakukan melalui WhatsApp.</p>
        <Link to="/cart" className="back-to-cart"><ArrowLeft size={14}/> Kembali ke keranjang</Link>
      </aside>
    </div>
  </div>;
}
