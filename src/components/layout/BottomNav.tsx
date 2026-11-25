import { Home, LayoutGrid, ShoppingBag, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useCart } from '../../app/CartProvider';
import { useAuth } from '../../app/AuthProvider';
export function BottomNav() {
  const { count } = useCart(); const { user } = useAuth();
  return <nav className="bottom-nav">
    <NavLink to="/" end><Home size={19}/><span>Home</span></NavLink>
    <NavLink to="/shop"><LayoutGrid size={19}/><span>Shop</span></NavLink>
    <NavLink to="/cart" className="bottom-cart"><ShoppingBag size={19}/><i>{count}</i><span>Keranjang</span></NavLink>
    <NavLink to={user ? '/account' : '/login'}><UserRound size={19}/><span>Akun</span></NavLink>
  </nav>;
}
