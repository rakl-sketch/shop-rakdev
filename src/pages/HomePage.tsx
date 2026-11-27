import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Blocks, Boxes, ChevronRight, Download, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getProducts } from '../services/products';
import type { Product } from '../types';
import { ProductCard } from '../components/shared/ProductCard';
import { SectionHeading } from '../components/shared/SectionHeading';
import { Button } from '../components/ui/Button';

const categories = [
  { slug: 'plugins', name: 'Plugins', caption: 'Ekstensi server', icon: Blocks },
  { slug: 'skript', name: 'Skript', caption: 'Automasi & sistem', icon: Terminal },
  { slug: 'maps', name: 'Maps', caption: 'World & environment', icon: Boxes },
  { slug: 'server-backup', name: 'Server Backup', caption: 'Arsip siap restore', icon: Download },
];
export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getProducts({ featured: true, limit: 4 }).then(setProducts).catch(() => setProducts([])).finally(() => setLoading(false)); }, []);
  return <>
    <section className="hero-section">
      <div className="page-container hero-grid">
        <div className="hero-copy">
          <div className="hero-eyebrow">MINECRAFT DIGITAL MARKETPLACE</div>
          <h1>Everything your<br/><em>server needs.</em></h1>
          <p>Plugin, Skript, map, dan backup server yang siap dipakai untuk membangun server Minecraft yang lebih rapi.</p>
          <div className="hero-actions">
            <Link to="/shop"><Button>Jelajahi produk <ArrowRight size={16}/></Button></Link>
            <Link className="text-link" to="/shop">Lihat katalog <ArrowUpRight size={14}/></Link>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-art-frame">
            <img src="https://images.unsplash.com/photo-1607513746994-51f730a44832?auto=format&fit=crop&w=1400&q=90" alt="World Minecraft dengan landscape hijau"/>
            <div className="hero-art-overlay"/>
          </div>
        </div>
      </div>
    </section>

    <section className="category-section page-container section-space">
      <SectionHeading eyebrow="BROWSE BY CATEGORY" title="Jelajahi kategori" description="Resource digital yang dikurasi untuk kebutuhan server Minecraft." action={<Link to="/shop" className="arrow-link">Semua kategori <ArrowUpRight size={15}/></Link>}/>
      <div className="category-grid">{categories.map(({ slug, name, caption, icon: Icon }) => <Link to={`/shop?category=${slug}`} className="category-tile" key={slug}>
        <span className="category-icon"><Icon size={18}/></span>
        <span className="category-info"><strong>{name}</strong><small>{caption}</small></span>
        <span className="category-arrow"><ArrowUpRight size={14}/></span>
      </Link>)}</div>
    </section>

    {(loading || products.length > 0) && <section className="featured-section section-space">
      <div className="page-container">
        <SectionHeading eyebrow="FEATURED PRODUCTS" title="Produk unggulan" description="Produk yang dipilih dan dikelola admin Shop rakDEV." action={<Link to="/shop" className="arrow-link">Lihat katalog <ArrowUpRight size={15}/></Link>}/>
        {loading ? <div className="product-grid">{[1,2,3,4].map((x) => <div className="product-skeleton" key={x}/>)}</div> : <div className="product-grid">{products.map((product) => <ProductCard product={product} key={product.id}/>)}</div>}
      </div>
    </section>}

    <section className="promise-section page-container section-space">
      <div className="promise-heading">
        <div className="eyebrow">SHOP WITH CONFIDENCE</div>
        <h2>Proses belanja yang jelas.<br/><em>Siap dibangun.</em></h2>
        <p>Pilih produk, pesan via WhatsApp, lalu terima produk setelah pembayaran dikonfirmasi.</p>
      </div>
      <div className="promise-list">
        <div><span>01</span><div><b>Pilih produk</b><p>Periksa deskripsi, versi Minecraft, platform, dan detail file sebelum membeli.</p></div><ChevronRight size={15}/></div>
        <div><span>02</span><div><b>Pesan via WhatsApp</b><p>Keranjang dan data pembeli otomatis disusun menjadi pesan WhatsApp untuk admin.</p></div><ChevronRight size={15}/></div>
        <div><span>03</span><div><b>Konfirmasi &amp; terima produk</b><p>Setelah pembayaran dikonfirmasi, produk digital dikirim atau dibuka di akun kamu.</p></div><ChevronRight size={15}/></div>
      </div>
    </section>

    <section className="cta-band">
      <div className="page-container cta-inner">
        <div>
          <span className="eyebrow">YOUR NEXT BUILD STARTS HERE</span>
          <h2>Siap membangun server<br/><em>yang lebih baik?</em></h2>
        </div>
        <Link to="/shop"><Button variant="light">Jelajahi shop <ArrowUpRight size={16}/></Button></Link>
      </div>
    </section>
  </>;
}
