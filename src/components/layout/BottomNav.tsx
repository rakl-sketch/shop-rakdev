import { Home, LayoutGrid, ShoppingBag, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useCart } from '../../app/CartProvider';
import { useAuth } from '../../app/AuthProvider';

export function BottomNav() {
  const { count } = useCart();
  const { user } = useAuth();
  return <nav className="bottom-nav" aria-label="Navigasi bawah">
    <NavLink to="/" end><Home size={18}/><span>Beranda</span></NavLink>
    <NavLink to="/shop"><LayoutGrid size={18}/><span>Produk</span></NavLink>
    <NavLink to="/cart" className="bottom-cart">
      <ShoppingBag size={18}/>
      <span>Keranjang</span>
      {count > 0 && <span className="bottom-cart-count" aria-label={`${count} produk di keranjang`}>{count}</span>}
    </NavLink>
    <NavLink to={user ? '/account' : '/login'}><UserRound size={18}/><span>Akun</span></NavLink>
  </nav>;
}