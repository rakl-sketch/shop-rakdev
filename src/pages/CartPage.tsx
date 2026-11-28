import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from '../app/CartProvider';
import { rupiah } from '../lib/format';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/shared/EmptyState';
import { qrisEnabled } from '../lib/env';

export default function CartPage() {
  const { items, subtotal, remove, changeQuantity } = useCart(); const navigate = useNavigate();
  if (!items.length) return <div className="page-container page-empty"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><b>Keranjang</b></div><EmptyState title="Keranjang masih kosong" description="Produk yang kamu tambahkan akan muncul di sini." action={<Link to="/shop"><Button>Mulai belanja <ArrowRight size={16}/></Button></Link>}/></div>;
  return <div className="page-container cart-page"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><b>Keranjang</b></div><div className="page-title-row"><div><div className="eyebrow">YOUR SELECTION</div><h1>Shopping <em>cart.</em></h1><p>{items.length} produk di keranjang kamu.</p></div><Link to="/shop" className="arrow-link"><ArrowLeft size={15}/> Lanjut belanja</Link></div>
    <div className="cart-layout"><div className="cart-items">{items.map(({ product, quantity }) => <article className="cart-item" key={product.id}><Link to={`/product/${product.slug}`} className="cart-item-image">{product.image_url ? <img src={product.image_url} alt={product.name} width={144} height={136} loading="lazy" decoding="async"/> : <div className="image-placeholder" aria-hidden="true"><span>{product.category_name?.toUpperCase()}</span></div>}</Link><div className="cart-item-info"><span className="product-category">{product.category_name}</span><Link to={`/product/${product.slug}`}><b>{product.name}</b></Link><small>{product.minecraft_version ?? 'Minecraft product'}</small><div className="cart-quantity"><button aria-label="Kurangi" onClick={() => changeQuantity(product.id, quantity - 1)}><Minus size={13}/></button><span>{quantity}</span><button aria-label="Tambah" onClick={() => changeQuantity(product.id, quantity + 1)}><Plus size={13}/></button></div></div><div className="cart-item-end"><b>{rupiah(product.price * quantity)}</b><button className="remove-button" onClick={() => remove(product.id)}><Trash2 size={15}/> Hapus</button></div></article>)}</div>
      <aside className="order-summary"><span className="eyebrow">ORDER SUMMARY</span><h3>Ringkasan pesanan</h3><div className="summary-line"><span>Subtotal</span><b>{rupiah(subtotal)}</b></div><div className="summary-line"><span>Biaya pengiriman</span><b>Gratis · digital</b></div><div className="summary-total"><span>Total</span><strong>{rupiah(subtotal)}</strong></div><Button full onClick={() => navigate('/checkout')}>Lanjut checkout <ArrowRight size={16}/></Button><p className="summary-security">{qrisEnabled ? 'Bayar otomatis dengan QRIS, atau konfirmasi manual melalui WhatsApp.' : 'Konfirmasi pembayaran manual melalui WhatsApp bersama admin.'}</p></aside>
    </div>
  </div>;
}
