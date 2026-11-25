import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowUpRight, Download, FileBox, LogOut, ReceiptText, UserRound, Save } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { supabase } from '../lib/supabase';
import { shortDate, rupiah } from '../lib/format';
import { useToast } from '../components/ui/Toast';
import { EmptyState } from '../components/shared/EmptyState';
import { Button } from '../components/ui/Button';
import { getMyOrders } from '../services/orders';
import type { OrderSummary } from '../types';

const accountNav = [{ to: '/account', label: 'Ringkasan', icon: UserRound, end: true }, { to: '/account/profile', label: 'Profil', icon: UserRound }, { to: '/account/purchases', label: 'Pembelian', icon: FileBox }, { to: '/account/downloads', label: 'Download Center', icon: Download }, { to: '/account/transactions', label: 'Transaksi', icon: ReceiptText }];
export function AccountLayout() {
  const { user, profile, signOut } = useAuth(); const { toast } = useToast(); const location = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace/>;
  return <div className="page-container account-page"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><b>Akun Saya</b></div><div className="account-heading"><div><div className="eyebrow">CUSTOMER SPACE</div><h1>My <em>account.</em></h1><p>Kelola pembelian dan file digital kamu.</p></div><button className="account-logout" onClick={async () => { await signOut(); toast('Kamu telah logout.', 'success'); }}><LogOut size={15}/> Keluar</button></div><div className="account-shell"><aside className="account-sidebar"><div className="account-user"><span className="account-avatar account-avatar-large">{(profile?.display_name || user.email || 'U').slice(0,1).toUpperCase()}</span><b>{profile?.display_name || 'Member rakDEV'}</b><small>{user.email}</small></div><nav>{accountNav.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end}><Icon size={17}/>{label}<ArrowUpRight size={14}/></NavLink>)}</nav><div className="account-side-note">YOUR DIGITAL COLLECTION<br/><b>All in one place.</b></div></aside><section className="account-content"><Outlet/></section></div></div>;
}
export function AccountOverview() {
  const { user, profile } = useAuth(); const [orders, setOrders] = useState<OrderSummary[]>([]);
  useEffect(() => { getMyOrders().then(setOrders).catch(() => setOrders([])); }, []);
  return <><div className="content-title"><div><span className="eyebrow">OVERVIEW</span><h2>Halo, {profile?.display_name || 'Member'}.</h2><p>Selamat datang kembali di Shop rakDEV.</p></div></div><div className="account-stats"><div><span>TOTAL PESANAN</span><strong>{orders.length}</strong></div><div><span>EMAIL AKUN</span><strong className="account-email-stat">{user?.email}</strong></div></div><div className="account-section-title"><h3>Pesanan terbaru</h3><Link to="/account/transactions">Lihat semua <ArrowUpRight size={14}/></Link></div>{orders.length ? <div className="account-order-list">{orders.slice(0,4).map((order) => <div className="account-order-row" key={order.id}><div><b>{order.order_number}</b><small>{shortDate(order.created_at)}</small></div><span className={`status-pill status-${order.status}`}>{order.status}</span><strong>{rupiah(order.total_amount)}</strong></div>)}</div> : <EmptyState title="Belum ada pesanan" description="Pesanan yang kamu buat akan muncul di bagian ini." action={<Link to="/shop"><Button variant="outline">Jelajahi produk</Button></Link>}/>}</>;
}
export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  useEffect(() => setDisplayName(profile?.display_name ?? ''), [profile?.display_name]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ display_name: displayName.trim() }).eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast('Profil berhasil diperbarui.', 'success');
    } catch (error) { toast(error instanceof Error ? error.message : 'Gagal menyimpan profil.', 'error'); }
    finally { setSaving(false); }
  };
  return <><div className="content-title"><div><span className="eyebrow">ACCOUNT SETTINGS</span><h2>Profile details.</h2><p>Perbarui informasi dasar akun Shop rakDEV.</p></div></div><form className="profile-form" onSubmit={save}><label>Nama tampilan<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={60} required/></label><label>Email akun<input value={user?.email ?? ''} readOnly/></label><div className="profile-security-note">Role akun tidak dapat diubah dari halaman profil. Perubahan hak akses hanya dapat dilakukan oleh project owner.</div><Button type="submit" loading={saving}><Save size={15}/> Simpan perubahan</Button></form></>;
}

export function PurchasesPage() {
  const [rows, setRows] = useState<Array<{ id: string; order_id: string; product_id: string; product?: { name: string; image_url: string | null }; created_at: string }>>([]);
  useEffect(() => { if (supabase) void supabase.from('purchases').select('id,order_id,product_id,created_at,products(name,image_url)').order('created_at', { ascending: false }).then(({ data }) => setRows((data ?? []) as unknown as typeof rows)); }, []);
  return <><div className="content-title"><div><span className="eyebrow">MY LIBRARY</span><h2>My purchases.</h2><p>Produk yang sudah berhasil kamu beli.</p></div></div>{rows.length ? <div className="library-list">{rows.map((row) => <div className="library-row" key={row.id}><div className="library-thumb">{row.product?.image_url && <img src={row.product.image_url} alt=""/>}</div><div><b>{row.product?.name ?? 'Produk digital'}</b><small>Dibeli {shortDate(row.created_at)}</small></div><Link to="/account/downloads">Buka download <ArrowUpRight size={14}/></Link></div>)}</div> : <EmptyState title="Library masih kosong" description="Setelah pembayaran sukses, produk akan tersedia di sini." action={<Link to="/shop"><Button variant="outline">Lihat produk</Button></Link>}/>}</>;
}
export function DownloadsPage() {
  const [rows, setRows] = useState<Array<{ id: string; product_id: string; created_at: string; product?: { name: string; image_url: string | null } }>>([]); const { toast } = useToast();
  useEffect(() => { if (supabase) void supabase.from('purchases').select('id,product_id,created_at,products(name,image_url)').order('created_at', { ascending: false }).then(({ data }) => setRows((data ?? []) as unknown as typeof rows)); }, []);
  const download = async (productId: string) => { if (!supabase) return; try { const { data, error } = await supabase.functions.invoke('download-product', { body: { product_id: productId } }); if (error) throw error; if (!data?.download_url) throw new Error('Link download tidak tersedia.'); window.location.assign(data.download_url); } catch (error) { toast(error instanceof Error ? error.message : 'Download gagal.', 'error'); } };
  return <><div className="content-title"><div><span className="eyebrow">DIGITAL DELIVERY</span><h2>Download center.</h2><p>Unduh kembali produk yang sudah menjadi milik akunmu.</p></div></div>{rows.length ? <div className="library-list">{rows.map((row) => <div className="library-row" key={row.id}><div className="library-thumb">{row.product?.image_url && <img src={row.product.image_url} alt=""/>}</div><div><b>{row.product?.name ?? 'Produk digital'}</b><small>Download aman melalui link sementara</small></div><Button onClick={() => download(row.product_id)}><Download size={15}/> Download</Button></div>)}</div> : <EmptyState title="Belum ada file untuk diunduh" description="Produk akan muncul setelah pembayaran diverifikasi."/>}</>;
}
export function TransactionsPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  useEffect(() => { getMyOrders().then(setOrders).catch(() => setOrders([])); }, []);
  return <><div className="content-title"><div><span className="eyebrow">ORDER HISTORY</span><h2>Transactions.</h2><p>Riwayat pesanan dan status pembayarannya.</p></div></div>{orders.length ? <div className="account-order-list">{orders.map((order) => <div className="account-order-row" key={order.id}><div><b>{order.order_number}</b><small>{shortDate(order.created_at)}</small></div><span className={`status-pill status-${order.status}`}>{order.status}</span><strong>{rupiah(order.total_amount)}</strong></div>)}</div> : <EmptyState title="Belum ada transaksi" description="Riwayat transaksi akan ditampilkan setelah kamu membuat pesanan."/>}</>;
}
