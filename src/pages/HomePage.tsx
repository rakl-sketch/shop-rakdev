import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Blocks, Boxes, Check, Download, MessageCircle, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getProducts } from '../services/products';
import type { Product } from '../types';
import { ProductCard } from '../components/shared/ProductCard';
import { Button } from '../components/ui/Button';
import { WHATSAPP_NUMBER, whatsappChatUrl } from '../lib/whatsapp';

const categories = [
  { slug: 'plugins', name: 'Plugins', caption: 'Ekstensi server', icon: Blocks },
  { slug: 'skript', name: 'Skript', caption: 'Automasi & sistem', icon: Terminal },
  { slug: 'maps', name: 'Maps', caption: 'World & environment', icon: Boxes },
  { slug: 'server-backup', name: 'Server Backup', caption: 'Arsip siap restore', icon: Download },
];

const steps = [
  { number: '01', title: 'Pilih produk', description: 'Periksa deskripsi, versi Minecraft, platform, dan detail file sebelum membeli.' },
  { number: '02', title: 'Checkout via WhatsApp', description: 'Keranjang dan data pembeli otomatis disusun menjadi pesan WhatsApp untuk admin.' },
  { number: '03', title: 'Terima produk', description: 'Setelah pembayaran dikonfirmasi, produk digital dikirim atau dibuka di akun kamu.' },
];

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts({ featured: true, limit: 4 })
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  return <>
    <section className="home-hero">
      <div className="home-hero-media" aria-hidden="true">
        <img src="https://images.unsplash.com/photo-1607513746994-51f730a44832?auto=format&fit=crop&w=1600&q=90" alt=""/>
      </div>
      <div className="page-container home-hero-inner">
        <div className="home-hero-copy">
          <div className="home-kicker">Minecraft digital marketplace</div>
          <h1>Resource server<br/><em>yang siap pakai.</em></h1>
          <p>Plugin, Skript, map, dan backup untuk membangun server Minecraft yang lebih rapi — dipilih dan disiapkan untuk langsung dipakai.</p>
          <div className="home-hero-actions">
            <Link to="/shop"><Button>Jelajahi produk <ArrowRight size={16}/></Button></Link>
            <Link to="/shop" className="home-text-link">Lihat katalog <ArrowUpRight size={14}/></Link>
          </div>
          <div className="home-hero-meta">
            <span><Check size={14}/> File siap unduh</span>
            <span><MessageCircle size={14}/> Checkout via WhatsApp</span>
          </div>
        </div>
      </div>
    </section>

    <section className="home-section home-catalog">
      <div className="page-container">
        <div className="home-section-head">
          <div className="home-section-title">
            <div className="eyebrow">Katalog</div>
            <h2>Mulai dari kebutuhan <em>server.</em></h2>
          </div>
          <div className="home-section-aside">
            <p>Empat kategori resource digital untuk kebutuhan harian server: dari ekstensi dan automasi sampai world dan arsip.</p>
            <Link to="/shop" className="arrow-link">Lihat semua produk <ArrowUpRight size={15}/></Link>
          </div>
        </div>
        <div className="home-category-grid">
          {categories.map(({ slug, name, caption, icon: Icon }, index) => <Link to={`/shop?category=${slug}`} className="home-category" key={slug}>
            <span className="home-category-number">0{index + 1}</span>
            <span className="home-category-icon"><Icon size={19}/></span>
            <span className="home-category-copy"><strong>{name}</strong><small>{caption}</small></span>
            <ArrowUpRight className="home-category-arrow" size={16}/>
          </Link>)}
        </div>
      </div>
    </section>

    {(loading || products.length > 0) && <section className="home-section home-featured">
      <div className="page-container">
        <div className="home-section-head">
          <div className="home-section-title">
            <div className="eyebrow">Pilihan</div>
            <h2>Produk <em>unggulan.</em></h2>
          </div>
          <div className="home-section-aside">
            <p>Resource yang dipilih dan dikelola langsung oleh admin Shop rakDEV.</p>
            <Link to="/shop" className="arrow-link">Buka katalog <ArrowUpRight size={15}/></Link>
          </div>
        </div>
        {loading ? <div className="product-grid">{[1, 2, 3, 4].map((x) => <div className="product-skeleton" key={x}/>)}</div> : <div className="product-grid">{products.map((product) => <ProductCard product={product} key={product.id}/>)}</div>}
      </div>
    </section>}

    <section id="cara-belanja" className="home-section home-process">
      <div className="page-container">
        <div className="home-section-head">
          <div className="home-section-title">
            <div className="eyebrow">Cara belanja</div>
            <h2>Tiga langkah, <em>tanpa ribet.</em></h2>
          </div>
          <div className="home-section-aside">
            <p>Pilih produk, checkout lewat WhatsApp, lalu terima file setelah pembayaran dikonfirmasi.</p>
          </div>
        </div>
        <div className="home-process-grid">
          {steps.map((step) => <div className="home-step" key={step.number}>
            <span>{step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </div>)}
        </div>
        <div className="home-help">
          <span>Butuh bantuan memilih produk?</span>
          <a href={whatsappChatUrl(WHATSAPP_NUMBER, 'Halo admin Shop rakDEV, saya ingin bertanya tentang produk.')} target="_blank" rel="noreferrer">Chat admin via WhatsApp <ArrowUpRight size={14}/></a>
        </div>
      </div>
    </section>

    <section className="home-cta">
      <div className="page-container home-cta-inner">
        <div>
          <div className="eyebrow">Your next build starts here</div>
          <h2>Siap membangun server<br/><em>yang lebih baik?</em></h2>
        </div>
        <div className="home-cta-actions">
          <Link to="/shop"><Button variant="light">Jelajahi katalog <ArrowUpRight size={16}/></Button></Link>
          <a className="home-cta-link" href={whatsappChatUrl(WHATSAPP_NUMBER, 'Halo admin Shop rakDEV, saya ingin bertanya tentang produk.')} target="_blank" rel="noreferrer">Tanya admin <ArrowUpRight size={14}/></a>
        </div>
      </div>
    </section>
  </>;
}
