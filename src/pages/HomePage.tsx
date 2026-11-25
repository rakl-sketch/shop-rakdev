import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Blocks, Boxes, ChevronRight, Code2, Download, ShieldCheck, Sparkles, Terminal, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getProducts } from '../services/products';
import type { Product } from '../types';
import { ProductCard } from '../components/shared/ProductCard';
import { SectionHeading } from '../components/shared/SectionHeading';
import { EmptyState } from '../components/shared/EmptyState';
import { Button } from '../components/ui/Button';
import { demoMode } from '../lib/env';

const categories = [
  { slug: 'plugins', name: 'Plugins', caption: 'Ekstensi server', icon: Blocks, number: '01' },
  { slug: 'skript', name: 'Skript', caption: 'Automasi & sistem', icon: Terminal, number: '02' },
  { slug: 'maps', name: 'Maps', caption: 'World & environment', icon: Boxes, number: '03' },
  { slug: 'server-backup', name: 'Server Backup', caption: 'Arsip siap restore', icon: Download, number: '04' },
];
export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getProducts({ featured: true, limit: 4 }).then(setProducts).catch(() => setProducts([])).finally(() => setLoading(false)); }, []);
  return <>
    {demoMode && <div className="preview-banner"><span className="preview-dot"/> MODE PREVIEW <span>Data katalog di bawah adalah contoh tampilan. Hubungkan Supabase untuk mengaktifkan katalog asli.</span></div>}
    <section className="hero-section">
      <div className="page-container hero-grid">
        <div className="hero-copy">
          <div className="hero-eyebrow"><span><Sparkles size={14}/></span> MINECRAFT DIGITAL MARKETPLACE</div>
          <h1>Everything your<br/><em>server needs.</em></h1>
          <p>Temukan plugin, skript, map, dan backup server pilihan untuk membawa pengalaman Minecraft ke level berikutnya.</p>
          <div className="hero-actions"><Link to="/shop"><Button>Jelajahi produk <ArrowRight size={17}/></Button></Link><Link className="text-link" to="/shop">Lihat semua produk <ArrowUpRight size={15}/></Link></div>
          <div className="hero-proof"><div className="proof-icon"><ShieldCheck size={17}/></div><span><strong>Transaksi terverifikasi</strong><small>File digital tersedia di akun setelah pembayaran berhasil.</small></span></div>
        </div>
        <div className="hero-art">
          <div className="hero-art-glow"/>
          <div className="hero-art-frame"><img src="https://images.unsplash.com/photo-1607513746994-51f730a44832?auto=format&fit=crop&w=1200&q=90" alt="World Minecraft dengan landscape hijau"/><div className="hero-art-overlay"/></div>
          <div className="floating-card floating-card-top"><span className="floating-icon"><Code2 size={17}/></span><span><b>Built for creators</b><small>Tools for your world</small></span><span className="floating-check"><Zap size={14}/></span></div>
          <div className="floating-card floating-card-bottom"><div className="mini-stack"><i/><i/><i/></div><span><b>Digital delivery</b><small>Download in one place</small></span><ArrowUpRight size={16}/></div>
          <div className="hero-vertical-label">RAKDEV / DIGITAL GOODS</div>
        </div>
      </div>
      <div className="hero-bottom-line page-container"><span>TOOLS. WORLDS. POSSIBILITIES.</span><span>01 — 04 / CATEGORIES</span></div>
    </section>

    <section className="category-section page-container section-space">
      <SectionHeading eyebrow="BROWSE BY CATEGORY" title="Find what you need." description="Produk digital yang dikurasi untuk berbagai kebutuhan server Minecraft." action={<Link to="/shop" className="arrow-link">Semua kategori <ArrowUpRight size={16}/></Link>}/>
      <div className="category-grid">{categories.map(({ slug, name, caption, icon: Icon, number }) => <Link to={`/shop?category=${slug}`} className="category-tile" key={slug}>
        <span className="category-number">{number}</span><span className="category-icon"><Icon size={23}/></span><span className="category-info"><strong>{name}</strong><small>{caption}</small></span><span className="category-arrow"><ArrowUpRight size={17}/></span>
      </Link>)}</div>
    </section>

    <section className="featured-section section-space">
      <div className="page-container"><SectionHeading eyebrow="SELECTED FOR YOU" title="Featured products." description="Pilihan produk yang ditampilkan oleh tim Shop rakDEV." action={<Link to="/shop" className="arrow-link">Lihat katalog <ArrowUpRight size={16}/></Link>}/>
        {loading ? <div className="product-grid">{[1,2,3,4].map((x) => <div className="product-skeleton" key={x}/>)}</div> : products.length ? <div className="product-grid">{products.map((product) => <ProductCard product={product} key={product.id}/>)}</div> : <EmptyState title="Belum ada produk unggulan" description="Produk yang dipublikasikan admin akan tampil di bagian ini." action={<Link to="/shop"><Button variant="outline">Lihat katalog</Button></Link>}/>}
      </div>
    </section>

    <section className="promise-section page-container section-space">
      <div className="promise-heading"><div className="eyebrow">SHOP WITH CONFIDENCE</div><h2>Simple process.<br/><em>Ready to build.</em></h2><p>Pengalaman belanja digital yang jelas dari memilih produk sampai file siap diunduh.</p></div>
      <div className="promise-list"><div><span>01</span><div><b>Pilih produk</b><p>Periksa deskripsi, versi Minecraft, platform, dan detail file sebelum membeli.</p></div><ChevronRight/></div><div><span>02</span><div><b>Bayar dengan QRIS</b><p>Pembayaran diproses melalui Midtrans dan diverifikasi di server.</p></div><ChevronRight/></div><div><span>03</span><div><b>Download dari akun</b><p>Produk yang sudah dibayar tersedia di halaman pembelian akun kamu.</p></div><ChevronRight/></div></div>
    </section>
    <section className="cta-band"><div className="page-container cta-inner"><div><span className="eyebrow">YOUR NEXT BUILD STARTS HERE</span><h2>Make your server<br/><em>stand out.</em></h2></div><Link to="/shop"><Button variant="light">Explore the shop <ArrowUpRight size={17}/></Button></Link></div></section>
  </>;
}
