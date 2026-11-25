import { ArrowUpRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Product } from '../../types';
import { rupiah } from '../../lib/format';

const categoryIcon: Record<string, string> = { plugins: 'PLUGIN', skript: 'SKRIPT', maps: 'MAP', 'server-backup': 'BACKUP' };
export function ProductCard({ product }: { product: Product }) {
  return <article className="product-card">
    <Link to={`/product/${product.slug}`} className="product-image-wrap" aria-label={`Lihat ${product.name}`}>
      {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy"/> : <div className="image-placeholder"><span>{categoryIcon[product.category_slug]}</span><b>rakDEV</b></div>}
      <div className="image-tags">{product.is_new && <span className="tag tag-new">NEW</span>}{product.is_featured && <span className="tag">PILIHAN</span>}</div>
      <span className="image-arrow"><ArrowUpRight size={17}/></span>
    </Link>
    <div className="product-card-body">
      <div className="product-category">{product.category_name ?? categoryIcon[product.category_slug]}</div>
      <Link to={`/product/${product.slug}`} className="product-title">{product.name}</Link>
      <div className="product-meta"><span><Star size={13} fill="currentColor"/> {product.rating?.toFixed(1) ?? '—'} <small>({product.review_count ?? 0})</small></span><span>{product.minecraft_version ?? 'Minecraft'}</span></div>
      <div className="product-price-row"><strong>{rupiah(product.price)}</strong>{product.compare_at_price && product.compare_at_price > product.price && <del>{rupiah(product.compare_at_price)}</del>}</div>
    </div>
  </article>;
}
