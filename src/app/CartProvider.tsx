import { createContext, useContext, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { CartItem, Product } from '../types';

type CartContextValue = {
  items: CartItem[]; count: number; subtotal: number;
  add: (product: Product) => void; remove: (id: string) => void;
  changeQuantity: (id: string, quantity: number) => void; clear: () => void;
};
const CartContext = createContext<CartContextValue | null>(null);

function readCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem('rakdev-cart') ?? '[]') as CartItem[]; }
  catch { return []; }
}
export function CartProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<CartItem[]>(readCart);
  const update = (next: CartItem[]) => { setItems(next); localStorage.setItem('rakdev-cart', JSON.stringify(next)); };
  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    add: (product) => update(items.some((item) => item.product.id === product.id)
      ? items.map((item) => item.product.id === product.id ? { ...item, quantity: Math.min(10, item.quantity + 1) } : item)
      : [...items, { product, quantity: 1 }]),
    remove: (id) => update(items.filter((item) => item.product.id !== id)),
    changeQuantity: (id, quantity) => update(items.map((item) => item.product.id === id ? { ...item, quantity: Math.max(1, Math.min(10, quantity)) } : item)),
    clear: () => update([]),
  }), [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}
