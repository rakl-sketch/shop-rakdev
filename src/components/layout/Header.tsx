import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, Search, ShoppingBag, UserRound, X, ChevronDown, ShieldCheck } from 'lucide-react';
import { useCart } from '../../app/CartProvider';
import { useAuth } from '../../app/AuthProvider';
import { useToast } from '../ui/Toast';
import { NotificationBell } from '../../features/notifications/NotificationBell';

const nav = [{ label: 'Beranda', to: '/' }, { label: 'Semua Produk', to: '/shop' }];
const categories = [
  { label: 'Plugins', slug: 'plugins' }, { label: 'Skript', slug: 'skript' },
  { label: 'Maps', slug: 'maps' }, { label: 'Server Backup', slug: 'server-backup' },
];
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { count } = useCart();
  const { user, profile, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const submitSearch = (event: FormEvent) => { event.preventDefault(); navigate(`/shop?q=${encodeURIComponent(search)}`); setMenuOpen(false); };
  const logout = async () => { try { await signOut(); toast('Berhasil keluar dari akun.', 'success'); navigate('/'); } catch (error) { toast(error instanceof Error ? error.message : 'Gagal keluar.', 'error'); } };
  return <>
    <div className="announcement"><span>Marketplace kebutuhan Minecraft</span><span className="announcement-dot"/> <span>Produk digital • Download setelah pembayaran</span></div>
    <header className="site-header">
      <div className="header-main page-container">
        <button className="icon-button mobile-menu-trigger" aria-label="Buka menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
        <Link to="/" className="brand" aria-label="Shop rakDEV beranda"><span className="brand-mark">r<span>.</span></span><span className="brand-word">rakDEV<small>digital shop</small></span></Link>
        <form className="header-search" onSubmit={submitSearch}><Search size={17}/><input aria-label="Cari produk" placeholder="Cari plugin, skript, map..." value={search} onChange={(e) => setSearch(e.target.value)}/><kbd>ENTER</kbd></form>
        <div className="header-actions">
          <NotificationBell/>
          <Link className="header-account" to={user ? '/account' : '/login'}><UserRound size={18}/><span>{user ? (profile?.display_name || 'Akun') : 'Masuk'}</span></Link>
          {profile && ['admin', 'owner'].includes(profile.role) && <Link className="header-admin" to="/admin" title="Admin"><ShieldCheck size={18}/></Link>}
          <Link to="/cart" className="cart-link" aria-label={`Keranjang, ${count} produk`}><ShoppingBag size={20}/><span className="cart-count">{count}</span></Link>
        </div>
      </div>
      <nav className={`category-nav ${menuOpen ? 'category-nav-open' : ''}`}>
        <div className="page-container category-nav-inner">
          {nav.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMenuOpen(false)}>{item.label}</NavLink>)}
          <div className="nav-dropdown"><span>Kategori <ChevronDown size={14}/></span><div className="dropdown-menu">{categories.map((item) => <Link key={item.slug} to={`/shop?category=${item.slug}`} onClick={() => setMenuOpen(false)}>{item.label}</Link>)}</div></div>
          <Link to="/about" onClick={() => setMenuOpen(false)}>Tentang</Link>
          {user && <button className="nav-logout" onClick={logout}>Keluar</button>}
        </div>
      </nav>
    </header>
  </>;
}
