export type ProductCategory = 'plugins' | 'skript' | 'maps' | 'server-backup';
export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description?: string | null;
  price: number;
  compare_at_price?: number | null;
  category_slug: ProductCategory;
  category_name?: string;
  image_url?: string | null;
  minecraft_version?: string | null;
  platform?: string | null;
  file_size?: string | null;
  rating?: number | null;
  review_count?: number | null;
  is_featured?: boolean;
  is_new?: boolean;
  is_published?: boolean;
  demo?: boolean;
};

export type CartItem = {
  product: Product;
  quantity: number;
  /** Optional variant selected by the buyer, e.g. a specific Minecraft version. */
  variant?: string | null;
};

export type Profile = { id: string; display_name: string | null; role: 'customer' | 'admin' | 'owner' };

export type OrderStatus = 'pending' | 'paid' | 'expired' | 'failed' | 'cancelled' | 'refunded';

export type OrderSummary = {
  id: string;
  order_number: string;
  status: OrderStatus | string;
  total_amount: number;
  created_at: string;
  channel?: string | null;
  buyer_name?: string | null;
  buyer_phone?: string | null;
  shipping_address?: string | null;
  notes?: string | null;
};
