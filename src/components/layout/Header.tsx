import { useEffect, useRef, useState } from 'react';
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
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const trigger = menuTriggerRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const focusTimer = window.setTimeout(() => {
      drawerRef.current?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus();
    }, 0);
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      trigger?.focus();
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!categoryOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!categoryRef.current?.contains(event.target as Node)) setCategoryOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setCategoryOpen(false);
      categoryTriggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [categoryOpen]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    navigate(`/shop?q=${encodeURIComponent(search)}`);
    setMenuOpen(false);
  };

  const closeMenu = () => setMenuOpen(false);

  const logout = async () => {
    try {
      await signOut();
      toast('Berhasil keluar dari akun.', 'success');
      navigate('/');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Gagal keluar.', 'error');
    } finally {
      closeMenu();
    }
  };

  return <>
    <header className="site-header">
      <div className="header-main page-container">
        <button
          ref={menuTriggerRef}
          className="icon-button mobile-menu-trigger"
          aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X size={18}/> : <Menu size={18}/>}
        </button>
        <Link to="/" className="brand" aria-label="Shop rakDEV beranda" onClick={closeMenu}>
          <span className="brand-mark">r<span>.</span></span>
          <span className="brand-word">rakDEV<small>digital shop</small></span>
        </Link>
        <form className="header-search" onSubmit={submitSearch}>
          <Search size={16}/>
          <input aria-label="Cari produk" placeholder="Cari plugin, skript, map..." value={search} onChange={(e) => setSearch(e.target.value)}/>
          <kbd>ENTER</kbd>
        </form>
        <div className="header-actions">
          <NotificationBell/>
          <Link className="header-account" to={user ? '/account' : '/login'}>
            <UserRound size={17}/>
            <span>{user ? (profile?.display_name || 'Akun') : 'Masuk'}</span>
          </Link>
          {profile && ['admin', 'owner'].includes(profile.role) && (
            <Link className="header-admin" to="/admin" title="Admin"><ShieldCheck size={17}/></Link>
          )}
          <Link to="/cart" className="cart-link" aria-label={`Keranjang, ${count} produk`}>
            <ShoppingBag size={18}/>
            {count > 0 && <span className="cart-count">{count}</span>}
          </Link>
        </div>
      </div>

      <nav className="category-nav" aria-label="Navigasi utama">
        <div className="page-container category-nav-inner">
          {nav.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'}>{item.label}</NavLink>)}
          <div
            ref={categoryRef}
            className={`nav-dropdown ${categoryOpen ? 'is-open' : ''}`}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setCategoryOpen(false);
            }}
          >
            <button
              ref={categoryTriggerRef}
              type="button"
              className="nav-dropdown-trigger"
              aria-expanded={categoryOpen}
              aria-controls="category-menu"
              onClick={() => setCategoryOpen((value) => !value)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown') return;
                event.preventDefault();
                setCategoryOpen(true);
                window.setTimeout(() => categoryMenuRef.current?.querySelector<HTMLElement>('a')?.focus(), 0);
              }}
            >
              Kategori <ChevronDown size={13}/>
            </button>
            <div ref={categoryMenuRef} className="dropdown-menu" id="category-menu">
              {categories.map((item) => <Link key={item.slug} to={`/shop?category=${item.slug}`} onClick={() => setCategoryOpen(false)}>{item.label}</Link>)}
            </div>
          </div>
          <Link to="/about">Tentang</Link>
          {user && <button className="nav-logout" onClick={logout}>Keluar</button>}
        </div>
      </nav>
    </header>

    {menuOpen && <button type="button" className="mobile-drawer-backdrop" aria-label="Tutup menu" onClick={closeMenu}/>}
    <aside
      ref={drawerRef}
      id="mobile-navigation"
      className={`mobile-drawer ${menuOpen ? 'is-open' : ''}`}
      aria-hidden={!menuOpen}
      aria-label="Navigasi utama"
      inert={!menuOpen}
    >
      <div className="mobile-drawer-header">
        <Link to="/" className="brand" onClick={closeMenu}>
          <span className="brand-mark">r<span>.</span></span>
          <span className="brand-word">rakDEV<small>digital shop</small></span>
        </Link>
        <button className="icon-button" aria-label="Tutup menu" onClick={closeMenu}><X size={18}/></button>
      </div>
      <nav className="mobile-drawer-nav">
        <div className="mobile-nav-group">
          <span className="mobile-nav-label">Menu</span>
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={closeMenu} className={({ isActive }) => isActive ? 'is-active' : ''}>
              {item.label}
            </NavLink>
          ))}
          <Link to="/about" onClick={closeMenu}>Tentang</Link>
        </div>
        <div className="mobile-nav-group">
          <span className="mobile-nav-label">Kategori</span>
          {categories.map((item) => (
            <Link key={item.slug} to={`/shop?category=${item.slug}`} onClick={closeMenu}>{item.label}</Link>
          ))}
        </div>
        <div className="mobile-nav-group">
          <span className="mobile-nav-label">Akun</span>
          <Link to={user ? '/account' : '/login'} onClick={closeMenu}>
            {user ? (profile?.display_name || 'Akun') : 'Masuk'}
          </Link>
          {profile && ['admin', 'owner'].includes(profile.role) && (
            <Link to="/admin" onClick={closeMenu}>Admin Dashboard</Link>
          )}
          {user && <button type="button" className="mobile-nav-logout" onClick={logout}>Keluar</button>}
        </div>
      </nav>
    </aside>
  </>;
}