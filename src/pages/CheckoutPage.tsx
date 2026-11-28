import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, LockKeyhole, MapPin, MessageCircle, Phone, QrCode, ShieldCheck, StickyNote, UserRound } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { useCart } from '../app/CartProvider';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { createQrisOrder, createWhatsAppOrder } from '../services/orders';
import { rupiah } from '../lib/format';
import { buildWhatsAppOrderMessage, productVariation, WHATSAPP_DISPLAY, whatsappOrderUrl } from '../lib/whatsapp';
import { qrisEnabled, supabaseConfigured } from '../lib/env';

export default function CheckoutPage() {
  const { user, profile } = useAuth();
  const { items, subtotal, clear } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [method, setMethod] = useState<'qris' | 'whatsapp'>(qrisEnabled ? 'qris' : 'whatsapp');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const qrisMethodRef = useRef<HTMLButtonElement>(null);
  const whatsappMethodRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const chooseMethod = (next: 'qris' | 'whatsapp') => {
    if (next === 'qris' && !qrisEnabled) return;
    setMethod(next);
    (next === 'qris' ? qrisMethodRef : whatsappMethodRef).current?.focus();
  };

  const validateName = () => {
    if (buyerName.trim().length >= 2) {
      setNameError('');
      return true;
    }
    setNameError('Nama pembeli wajib diisi minimal 2 karakter.');
    nameRef.current?.focus();
    return false;
  };

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

    if (method === 'qris' && !user) {
      toast('Login diperlukan agar produk bisa dikirim ke akunmu setelah pembayaran.', 'info');
      navigate(`/login?next=${encodeURIComponent('/checkout')}`);
      return;
    }
    if (!validateName()) return;

    if (method === 'qris') {
      if (!supabaseConfigured) {
        toast('Pembayaran QRIS belum dikonfigurasi.', 'error');
        return;
      }

      setSaving(true);
      try {
        const order = await createQrisOrder({ buyerName, buyerPhone, notes, items });
        toast(`Pesanan ${order.order_number} dibuat. Selesaikan pembayaran QRIS.`, 'success');
        navigate(`/payment/${order.order_id}`, { replace: true });
        clear();
      } catch (error) {
        console.error('[Shop rakDEV] Gagal membuat pembayaran QRIS:', error);
        toast(error instanceof Error ? error.message : 'Gagal membuat pembayaran QRIS.', 'error');
      } finally {
        setSaving(false);
      }
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
        <div className="eyebrow">{method === 'qris' ? 'QRIS CHECKOUT' : 'WHATSAPP CHECKOUT'}</div>
        <h1>Complete your <em>order.</em></h1>
        <p>{method === 'qris'
          ? 'Bayar dulu dengan QRIS. Setelah pembayaran sukses, produk digital otomatis tersedia di akunmu.'
          : 'Isi data pesanan, lalu lanjutkan konfirmasi langsung dengan admin melalui WhatsApp.'}</p>
      </div>
      <Link to="/cart" className="arrow-link"><ArrowLeft size={15}/> Kembali ke keranjang</Link>
    </div>

    <div className="checkout-grid">
      <section className="checkout-main">
        <form id="checkout-form" className="checkout-panel checkout-form" onSubmit={submit} noValidate>
          <div className="checkout-panel-title">
            <span className="step-badge">01</span>
            <div><h3>Data pembeli</h3><p>{method === 'qris' ? 'Data ini dipakai untuk pesanan dan notifikasi pembayaran QRIS.' : 'Data ini akan dimasukkan otomatis ke pesan WhatsApp.'}</p></div>
          </div>

          <div className="checkout-account-row">
            <span className="account-avatar"><UserRound size={16}/></span>
            <span>
              <b>{user ? (profile?.display_name || user.email) : 'Checkout tanpa login'}</b>
              <small>{user
                ? (method === 'qris' ? 'Produk otomatis dikirim ke akun ini setelah pembayaran sukses.' : 'Pesanan akan tersimpan di akun ini.')
                : 'Login agar produk bisa dikirim otomatis ke akunmu.'}</small>
            </span>
            {!user && <Link to="/login?next=/checkout">Masuk</Link>}
            {user && <ShieldCheck size={18}/>}
          </div>

          <div
            className="checkout-methods"
            role="radiogroup"
            aria-label="Metode pembayaran"
            onKeyDown={(event) => {
              if (['ArrowLeft', 'ArrowUp', 'Home'].includes(event.key)) {
                event.preventDefault();
                chooseMethod('qris');
              } else if (['ArrowRight', 'ArrowDown', 'End'].includes(event.key)) {
                event.preventDefault();
                chooseMethod('whatsapp');
              }
            }}
          >
            <button
              ref={qrisMethodRef}
              type="button"
              className={`checkout-method ${method === 'qris' ? 'is-active' : ''}`}
              role="radio"
              aria-checked={method === 'qris'}
              aria-disabled={!qrisEnabled}
              aria-describedby={qrisEnabled && method === 'qris' && !user ? 'qris-login-note' : undefined}
              disabled={!qrisEnabled}
              tabIndex={qrisEnabled && method === 'qris' ? 0 : -1}
              onClick={() => chooseMethod('qris')}
            >
              <span className="checkout-method-icon"><QrCode size={18}/></span>
              <span><b>QRIS otomatis</b><small>{qrisEnabled ? 'Bayar dulu, produk langsung tersedia di akun setelah pembayaran sukses.' : 'Segera aktif. Untuk sekarang, gunakan WhatsApp admin.'}</small></span>
              {qrisEnabled ? method === 'qris' && <ShieldCheck size={16}/> : <span className="checkout-method-badge">SOON</span>}
            </button>
            <button
              ref={whatsappMethodRef}
              type="button"
              className={`checkout-method ${method === 'whatsapp' ? 'is-active' : ''}`}
              role="radio"
              aria-checked={method === 'whatsapp'}
              tabIndex={method === 'whatsapp' ? 0 : -1}
              onClick={() => chooseMethod('whatsapp')}
            >
              <span className="checkout-method-icon"><MessageCircle size={18}/></span>
              <span><b>WhatsApp admin</b><small>Konfirmasi manual dengan admin. Bisa tanpa login.</small></span>
              {method === 'whatsapp' && <ShieldCheck size={16}/>}
            </button>
          </div>

          {method === 'qris' && !user && <div className="checkout-login-note" id="qris-login-note">
            <LockKeyhole size={16}/>
            <span>QRIS otomatis memerlukan akun agar produk bisa dikirim ke Download Center. <Link to={`/login?next=${encodeURIComponent('/checkout')}`}>Masuk</Link> atau <Link to="/register">daftar</Link>.</span>
          </div>}

          <div className="checkout-fields">
            <label className="checkout-field">
              <span><UserRound size={14}/> Nama pembeli <b>*</b></span>
              <input
                ref={nameRef}
                value={buyerName}
                onChange={(event) => {
                  setBuyerName(event.target.value);
                  if (nameError) setNameError('');
                }}
                placeholder="Nama lengkap"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? 'buyer-name-error' : undefined}
              />
              {nameError && <small className="checkout-field-error" id="buyer-name-error" role="alert">{nameError}</small>}
            </label>
            <label className="checkout-field">
              <span><Phone size={14}/> Nomor WhatsApp <small>opsional</small></span>
              <input value={buyerPhone} onChange={(event) => setBuyerPhone(event.target.value)} placeholder="08xxxxxxxxxx" maxLength={30} inputMode="tel" autoComplete="tel"/>
            </label>
            {method === 'whatsapp' && <label className="checkout-field checkout-field-full">
              <span><MapPin size={14}/> Alamat pengiriman <small>opsional</small></span>
              <textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Alamat atau keterangan pengiriman jika diperlukan" rows={2} maxLength={500} autoComplete="street-address"/>
            </label>}
            <label className="checkout-field checkout-field-full">
              <span><StickyNote size={14}/> Catatan pesanan <small>opsional</small></span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contoh: minta versi Minecraft tertentu, jam konfirmasi, atau catatan lain" rows={3} maxLength={1000}/>
            </label>
          </div>

          <div className="checkout-info">
            {method === 'qris' ? <QrCode size={17}/> : <MessageCircle size={17}/>}
            <span>{method === 'qris'
              ? 'Total pesanan dihitung ulang di server, lalu dikirim ke BuatQris untuk membuat QRIS. Pembayaran diproses di halaman QRIS.'
              : <>Pesanan dikirim ke WhatsApp admin <b>{WHATSAPP_DISPLAY}</b>. Pembayaran dan konfirmasi dilakukan langsung melalui WhatsApp, bukan melalui website.</>}</span>
          </div>
        </form>

        <div className="checkout-panel checkout-steps">
          <div className="checkout-panel-title">
            <span className="step-badge">02</span>
            <div><h3>{method === 'qris' ? 'Cara bayar' : 'Cara pesan'}</h3><p>{method === 'qris' ? 'Alur singkat setelah tombol QRIS ditekan.' : 'Alur singkat setelah tombol WhatsApp ditekan.'}</p></div>
          </div>
          <ol className="checkout-step-list">
            {method === 'qris' ? <>
              <li><span>1</span><div><b>Pesanan & QRIS dibuat</b><small>Harga dihitung ulang di server, lalu nominalnya dikirim ke BuatQris.</small></div></li>
              <li><span>2</span><div><b>Scan dan bayar</b><small>Scan QR atau buka halaman pembayaran. QRIS berlaku 15 menit.</small></div></li>
              <li><span>3</span><div><b>Produk otomatis tersedia</b><small>Setelah pembayaran sukses, file muncul di Download Center akunmu.</small></div></li>
            </> : <>
              <li><span>1</span><div><b>Pesan otomatis terisi</b><small>Nama produk, variasi, jumlah, harga, total, nama, alamat, dan catatan sudah disusun.</small></div></li>
              <li><span>2</span><div><b>Konfirmasi dengan admin</b><small>Admin memeriksa ketersediaan produk dan memberikan instruksi pembayaran.</small></div></li>
              <li><span>3</span><div><b>Terima produk</b><small>Setelah pembayaran dikonfirmasi, produk digital dikirim atau dibuka di akun.</small></div></li>
            </>}
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
        {method === 'qris' && !user
          ? <Link to={`/login?next=${encodeURIComponent('/checkout')}`} className="button button-primary button-full">
              <LockKeyhole size={17}/> Login untuk bayar QRIS <ArrowRight size={16}/>
            </Link>
          : <Button full type="submit" form="checkout-form" loading={saving} className={method === 'whatsapp' ? 'button-whatsapp' : ''}>
              {method === 'qris'
                ? <><QrCode size={17}/> Bayar dengan QRIS <ArrowRight size={16}/></>
                : <><MessageCircle size={17}/> Pesan via WhatsApp <ArrowRight size={16}/></>}
            </Button>}

        <p className="summary-security">{method === 'qris'
          ? 'Pembayaran QRIS diproses oleh BuatQris. Produk dikirim otomatis setelah pembayaran sukses.'
          : 'Tidak ada pembayaran otomatis di website. Konfirmasi akhir dilakukan melalui WhatsApp.'}</p>
        <Link to="/cart" className="back-to-cart"><ArrowLeft size={14}/> Kembali ke keranjang</Link>
      </aside>
    </div>
  </div>;
}
