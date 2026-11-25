import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { getProducts } from '../services/products';
import type { Product } from '../types';
import { ProductCard } from '../components/shared/ProductCard';
import { EmptyState } from '../components/shared/EmptyState';
import { Button } from '../components/ui/Button';
import { demoMode } from '../lib/env';

const categories = [{ label: 'Semua', value: '' }, { label: 'Plugins', value: 'plugins' }, { label: 'Skript', value: 'skript' }, { label: 'Maps', value: 'maps' }, { label: 'Server Backup', value: 'server-backup' }];
export default function ShopPage() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]); const [loading, setLoading] = useState(true);
  const category = params.get('category') ?? ''; const query = params.get('q') ?? '';
  const [search, setSearch] = useState(query); const [sort, setSort] = useState('newest');
  useEffect(() => { let active = true; setLoading(true); getProducts({ category: category || undefined, search: query || undefined }).then((data) => { if (active) setProducts(data); }).catch(() => { if (active) setProducts([]); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [category, query]);
  const sorted = useMemo(() => [...products].sort((a,b) => sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : sort === 'name' ? a.name.localeCompare(b.name) : 0), [products, sort]);
  const updateCategory = (value: string) => { const next = new URLSearchParams(params); if (value) next.set('category', value); else next.delete('category'); setParams(next); };
  const submitSearch = (event: FormEvent) => { event.preventDefault(); const next = new URLSearchParams(params); if (search.trim()) next.set('q', search.trim()); else next.delete('q'); setParams(next); };
  return <div className="page-container shop-page">
    <div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><b>Shop</b></div>
    {demoMode && <div className="preview-banner preview-banner-inline"><span className="preview-dot"/> PREVIEW CATALOGUE <span>Produk contoh — checkout belum aktif.</span></div>}
    <div className="shop-heading"><div><div className="eyebrow">THE COLLECTION</div><h1>Shop <em>all products.</em></h1><p>Temukan resource yang cocok untuk server dan project kamu.</p></div><span className="product-count">{products.length.toString().padStart(2,'0')} PRODUCTS</span></div>
    <div className="shop-toolbar"><div className="filter-pills">{categories.map((item) => <button key={item.value} className={category === item.value ? 'filter-pill active' : 'filter-pill'} onClick={() => updateCategory(item.value)}>{item.label}</button>)}</div>
      <div className="shop-controls"><form className="shop-search" onSubmit={submitSearch}><Search size={16}/><input placeholder="Cari produk..." value={search} onChange={(e) => setSearch(e.target.value)}/>{search && <button type="button" onClick={() => { setSearch(''); const next = new URLSearchParams(params); next.delete('q'); setParams(next); }}><X size={14}/></button>}</form><label className="sort-select"><SlidersHorizontal size={15}/><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Terbaru</option><option value="low">Harga terendah</option><option value="high">Harga tertinggi</option><option value="name">Nama A–Z</option></select></label></div>
    </div>
    {loading ? <div className="product-grid">{[1,2,3,4].map((x) => <div className="product-skeleton" key={x}/>)}</div> : sorted.length ? <div className="product-grid">{sorted.map((product) => <ProductCard key={product.id} product={product}/>)}</div> : <EmptyState title="Produk belum ditemukan" description="Coba kata kunci atau kategori yang berbeda." action={<Button variant="outline" onClick={() => { setSearch(''); setParams({}); }}>Reset filter</Button>}/>}
  </div>;
}
