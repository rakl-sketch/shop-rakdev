import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowUpRight, Check, Download, ShieldCheck, ShoppingBag, Star } from 'lucide-react';
import { getProductBySlug } from '../services/products';
import type { Product } from '../types';
import { rupiah } from '../lib/format';
import { useCart } from '../app/CartProvider';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/shared/EmptyState';
import { demoMode, qrisEnabled } from '../lib/env';

export default function ProductPage() {
  const { slug = '' } = useParams(); const [product, setProduct] = useState<Product | null>(null); const [loading, setLoading] = useState(true);
  const { add } = useCart(); const { toast } = useToast(); const navigate = useNavigate();
  useEffect(() => { getProductBySlug(slug).then(setProduct).catch(() => setProduct(null)).finally(() => setLoading(false)); }, [slug]);
  if (loading) return <div className="page-container detail-loading"><div className="product-skeleton"/><div className="product-skeleton"/></div>;
  if (!product) return <div className="page-container page-empty"><EmptyState title="Produk tidak ditemukan" description="Produk mungkin sudah dihapus atau tidak lagi dipublikasikan." action={<Link to="/shop"><Button>Kembali ke Shop</Button></Link>}/></div>;
  const canBuy = !demoMode && product.is_published !== false;
  const addToCart = () => { add(product); toast(`${product.name} ditambahkan ke keranjang.`, 'success'); };
  return <div className="page-container product-detail-page">
    <div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><Link to="/shop">Shop</Link><span>/</span><b>{product.name}</b></div>
    {demoMode && <div className="preview-banner preview-banner-inline"><span className="preview-dot"/> PREVIEW PRODUCT <span>Produk ini hanya contoh tampilan. Tidak dapat dibeli.</span></div>}
    <div className="product-detail-grid">
      <div className="detail-gallery"><div className="detail-main-image">{product.image_url ? <img src={product.image_url} alt={product.name} width={1200} height={900} loading="eager" decoding="async" fetchPriority="high"/> : <div className="image-placeholder" aria-hidden="true"><span>{product.category_name?.toUpperCase() ?? 'PRODUK'}</span></div>}<span className="detail-gallery-label">PRODUCT / {product.category_slug.toUpperCase()}</span></div><div className="detail-image-caption"><span>SHOP rakDEV / DIGITAL PRODUCT</span></div></div>
      <div className="detail-info"><div className="eyebrow">{product.category_name ?? product.category_slug}</div><h1>{product.name}</h1><div className="detail-rating"><Star size={15} fill="currentColor"/><b>{product.rating?.toFixed(1) ?? '—'}</b><span>({product.review_count ?? 0} ulasan)</span><span className="stock-indicator"><i/> Digital product</span></div>
        <div className="detail-price">{rupiah(product.price)} {product.compare_at_price && product.compare_at_price > product.price && <del>{rupiah(product.compare_at_price)}</del>}</div>
        <p className="detail-description">{product.description}</p>
        <div className="detail-specs"><div><span>VERSI MINECRAFT</span><b>{product.minecraft_version ?? 'Lihat deskripsi'}</b></div><div><span>PLATFORM</span><b>{product.platform ?? 'Sesuai deskripsi'}</b></div><div><span>UKURAN FILE</span><b>{product.file_size ?? 'Informasi belum tersedia'}</b></div><div><span>FORMAT</span><b>{product.category_slug === 'plugins' ? 'JAR / ZIP' : product.category_slug === 'skript' ? 'SK / ZIP' : 'ZIP / ARCHIVE'}</b></div></div>
        <div className="detail-buttons"><Button full onClick={addToCart} disabled={!canBuy}><ShoppingBag size={17}/> Tambah ke keranjang</Button><Button full variant="outline" onClick={() => { addToCart(); navigate('/checkout'); }} disabled={!canBuy}>Beli sekarang <ArrowUpRight size={16}/></Button></div>
        <div className="detail-assurance"><div><ShieldCheck size={18}/><span><b>{qrisEnabled ? 'QRIS atau WhatsApp' : 'WhatsApp admin'}</b><small>{qrisEnabled ? 'Bayar otomatis dengan QRIS, atau konfirmasi manual melalui WhatsApp.' : 'Konfirmasi manual dengan admin melalui WhatsApp sebelum atau sesudah checkout.'}</small></span></div><div><Download size={18}/><span><b>Download dari akun</b><small>Setelah pembayaran sukses, file tersedia di Download Center.</small></span></div></div>
        <div className="detail-note"><Check size={15}/> Pastikan kompatibilitas produk sebelum melakukan pembelian.</div>
      </div>
    </div>
    <div className="detail-lower"><div><span className="eyebrow">PRODUCT INFORMATION</span><h2>About this <em>product.</em></h2><p>{product.description}</p></div><div className="detail-help"><b>Butuh bantuan?</b><p>Periksa halaman FAQ atau hubungi tim Shop rakDEV untuk pertanyaan seputar produk.</p><Link to="/faq">Buka FAQ <ArrowUpRight size={15}/></Link></div></div>
  </div>;
}
