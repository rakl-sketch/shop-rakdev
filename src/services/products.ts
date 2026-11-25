import { supabase } from '../lib/supabase';
import type { Product, ProductCategory } from '../types';

export const previewProducts: Product[] = [
  {
    id: 'preview-plugin-01', name: 'Server Essentials', slug: 'server-essentials',
    description: 'Contoh tampilan produk plugin untuk melihat format informasi, kompatibilitas, dan detail produk di Shop rakDEV.',
    short_description: 'Paket plugin utilitas server untuk kebutuhan dasar.', price: 49000, compare_at_price: 65000,
    category_slug: 'plugins', category_name: 'Plugins', minecraft_version: '1.20–1.21.x', platform: 'Paper / Spigot',
    file_size: '2.4 MB', rating: 4.9, review_count: 18, is_featured: true, is_new: false, demo: true,
    image_url: 'https://images.unsplash.com/photo-1627856013091-fed6e4e30025?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'preview-skript-01', name: 'Advanced Economy Skript', slug: 'advanced-economy-skript',
    description: 'Contoh tampilan produk Skript. Detail final dan file unduhan akan dikelola melalui dashboard admin.',
    short_description: 'Contoh sistem ekonomi berbasis Skript.', price: 35000,
    category_slug: 'skript', category_name: 'Skript', minecraft_version: '1.20–1.21.x', platform: 'Paper + Skript',
    file_size: '180 KB', rating: 4.8, review_count: 12, is_featured: true, is_new: true, demo: true,
    image_url: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'preview-map-01', name: 'Emerald Valley Spawn', slug: 'emerald-valley-spawn',
    description: 'Contoh halaman penjualan map. Foto, deskripsi, dan kompatibilitas bisa diperbarui oleh admin.',
    short_description: 'Contoh map spawn bernuansa alam untuk server.', price: 79000,
    category_slug: 'maps', category_name: 'Maps', minecraft_version: '1.21.x', platform: 'Java Edition',
    file_size: '84 MB', rating: 5, review_count: 9, is_featured: true, is_new: false, demo: true,
    image_url: 'https://images.unsplash.com/photo-1607513746994-51f730a44832?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'preview-backup-01', name: 'Survival Server Backup', slug: 'survival-server-backup',
    description: 'Contoh produk backup server. Halaman produksi dapat menampilkan isi arsip, ukuran, versi, dan panduan restore.',
    short_description: 'Contoh arsip world dan data server untuk dipulihkan.', price: 59000,
    category_slug: 'server-backup', category_name: 'Server Backup', minecraft_version: '1.21.x', platform: 'Paper',
    file_size: '320 MB', rating: 4.9, review_count: 7, is_featured: false, is_new: true, demo: true,
    image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=85',
  },
];

function mapProduct(row: Record<string, unknown>): Product {
  const category = row.categories as { slug?: string; name?: string } | null;
  return {
    ...(row as unknown as Product),
    category_slug: (category?.slug ?? 'plugins') as ProductCategory,
    category_name: category?.name ?? 'Produk',
  };
}

export async function getProducts(options?: { category?: string; search?: string; featured?: boolean; limit?: number }) {
  if (!supabase) return previewProducts.filter((product) => {
    const categoryMatch = !options?.category || product.category_slug === options.category;
    const query = options?.search?.toLowerCase().trim();
    const searchMatch = !query || `${product.name} ${product.description} ${product.category_name}`.toLowerCase().includes(query);
    const featuredMatch = !options?.featured || product.is_featured;
    return categoryMatch && searchMatch && featuredMatch;
  });

  let query = supabase.from('products')
    .select('id,name,slug,description,short_description,price,compare_at_price,image_url,minecraft_version,platform,file_size,is_featured,is_new,is_published,categories!inner(name,slug)')
    .eq('is_published', true).order('created_at', { ascending: false });
  if (options?.category) query = query.eq('categories.slug', options.category);
  if (options?.featured) query = query.eq('is_featured', true);
  if (options?.search) query = query.ilike('name', `%${options.search}%`);
  if (options?.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapProduct(row as unknown as Record<string, unknown>));
}

export async function getProductBySlug(slug: string) {
  if (!supabase) return previewProducts.find((product) => product.slug === slug) ?? null;
  const { data, error } = await supabase.from('products')
    .select('id,name,slug,description,short_description,price,compare_at_price,image_url,minecraft_version,platform,file_size,is_featured,is_new,is_published,categories(name,slug)')
    .eq('slug', slug).eq('is_published', true).maybeSingle();
  if (error) throw error;
  return data ? mapProduct(data as unknown as Record<string, unknown>) : null;
}
