import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, NavLink, Navigate, useLocation, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, ArrowUpRight, Boxes, CreditCard, FolderOpen, LayoutDashboard, LogOut, MessageCircle, PackagePlus, Pencil, ReceiptText, Settings, ShieldCheck, ShoppingBag, Star, Users, X } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { supabase } from '../lib/supabase';
import { rupiah, shortDate } from '../lib/format';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { EmptyState } from '../components/shared/EmptyState';
import { NotificationBell } from '../features/notifications/NotificationBell';
import { updateOrderStatus } from '../services/orders';
import { WHATSAPP_DISPLAY, whatsappChatUrl } from '../lib/whatsapp';
import type { OrderStatus } from '../types';

const sections = [
  { slug: 'overview', label: 'Overview', icon: LayoutDashboard },
  { slug: 'products', label: 'Products', icon: Boxes },
  { slug: 'categories', label: 'Categories', icon: FolderOpen },
  { slug: 'orders', label: 'Orders', icon: ShoppingBag },
  { slug: 'payments', label: 'Payments', icon: CreditCard },
  { slug: 'customers', label: 'Customers', icon: Users },
  { slug: 'reviews', label: 'Reviews', icon: Star },
  { slug: 'activity', label: 'Activity Log', icon: Activity },
  { slug: 'settings', label: 'Settings', icon: Settings },
];

const statusOptions: OrderStatus[] = ['pending', 'paid', 'expired', 'failed', 'cancelled', 'refunded'];

type Row = Record<string, unknown>;
type ProductForm = {
  name: string; slug: string; description: string; price: string;
  category_id: string; minecraft_version: string; platform: string;
};
type EditProductForm = ProductForm & { is_featured: boolean; is_new: boolean };
type CategoryForm = { name: string; slug: string; description: string; sort_order: string };

const emptyProductForm: ProductForm = { name: '', slug: '', description: '', price: '', category_id: '', minecraft_version: '', platform: '' };
const emptyEditProductForm: EditProductForm = { ...emptyProductForm, is_featured: false, is_new: false };
const emptyCategoryForm: CategoryForm = { name: '', slug: '', description: '', sort_order: '0' };

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function AdminPage() {
  const { section = 'overview' } = useParams();
  const location = useLocation();
  const { user, profile, loading, signOut } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<Row[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [counts, setCounts] = useState({ products: 0, orders: 0, customers: 0, paid: 0 });
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyProductForm);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditProductForm>(emptyEditProductForm);
  const [editSaving, setEditSaving] = useState(false);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);
  const [categorySaving, setCategorySaving] = useState(false);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !profile || !['admin', 'owner'].includes(profile.role)) return;
    void Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
    ]).then(([products, orders, customers, paid]) => setCounts({ products: products.count ?? 0, orders: orders.count ?? 0, customers: customers.count ?? 0, paid: paid.count ?? 0 }));
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    if (!supabase || !profile || !['admin', 'owner'].includes(profile.role)) return;
    const config: Record<string, { table: string; columns: string }> = {
      products: { table: 'products', columns: '*' },
      categories: { table: 'categories', columns: '*' },
      orders: { table: 'orders', columns: 'id,order_number,status,total_amount,created_at,user_id,channel,buyer_name,buyer_phone,shipping_address,notes' },
      payments: { table: 'payments', columns: 'id,order_id,provider,status,amount,created_at' },
      customers: { table: 'profiles', columns: 'id,display_name,role,created_at' },
      reviews: { table: 'reviews', columns: 'id,product_id,user_id,rating,comment,is_approved,created_at' },
      activity: { table: 'admin_audit_logs', columns: 'id,actor_id,action_type,entity_type,entity_id,created_at' },
    };
    const target = config[section];
    if (!target) { setRows([]); return; }
    setLoadingRows(true);
    void (async () => {
      try {
        const { data, error } = await supabase.from(target.table).select(target.columns).order('created_at', { ascending: false }).limit(100);
        if (error) toast(error.message, 'error');
        setRows((data ?? []) as unknown as Row[]);
      } finally {
        setLoadingRows(false);
      }
    })();
  }, [section, profile?.id, profile?.role, toast]);

  useEffect(() => {
    if (!supabase || !profile || !['admin', 'owner'].includes(profile.role)) return;
    void supabase.from('categories').select('id,name').order('sort_order').then(({ data }) => setCategories(data ?? []));
  }, [profile?.id, profile?.role]);

  if (loading) return <div className="admin-loading">Memeriksa akses admin…</div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace/>;
  if (!profile || !['admin', 'owner'].includes(profile.role)) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace/>;

  const togglePublish = async (productId: string, isPublished: boolean) => {
    if (!supabase) return;
    try {
      if (!isPublished) {
        const { data: file, error: fileError } = await supabase.from('product_files').select('id').eq('product_id', productId).eq('is_current', true).maybeSingle();
        if (fileError) throw fileError;
        if (!file) { toast('Tambahkan file produk aktif sebelum mempublikasikan.', 'error'); return; }
      }
      const { error } = await supabase.from('products').update({ is_published: !isPublished }).eq('id', productId);
      if (error) throw error;
      setRows((current) => current.map((row) => row.id === productId ? { ...row, is_published: !isPublished } : row));
      toast(isPublished ? 'Produk disembunyikan.' : 'Produk dipublikasikan.', 'success');
    } catch (error) { toast(error instanceof Error ? error.message : 'Gagal mengubah status produk.', 'error'); }
  };

  const createProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (!productFile) { toast('File produk wajib diunggah.', 'error'); return; }
    const allowedExtensions = ['.jar', '.sk', '.zip', '.tar', '.gz', '.mcworld', '.schem', '.litematic'];
    const extension = productFile.name.toLowerCase().slice(productFile.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(extension)) { toast('Format file tidak didukung. Gunakan JAR, SK, ZIP, TAR, GZ, MCWORLD, SCHEM, atau LITEMATIC.', 'error'); return; }
    if (productFile.size > 500 * 1024 * 1024) { toast('Ukuran file produk melebihi 500 MB.', 'error'); return; }
    setSaving(true);
    try {
      const slug = form.slug.trim() || slugify(form.name);
      let imageUrl: string | null = null;
      if (previewFile) {
        const imagePath = `${crypto.randomUUID()}-${previewFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
        const upload = await supabase.storage.from('product-previews').upload(imagePath, previewFile, { upsert: false, contentType: previewFile.type });
        if (upload.error) throw upload.error;
        imageUrl = supabase.storage.from('product-previews').getPublicUrl(imagePath).data.publicUrl;
      }
      const { data: product, error } = await supabase.from('products').insert({
        name: form.name.trim(), slug, description: form.description.trim(), price: Number(form.price),
        category_id: form.category_id, minecraft_version: form.minecraft_version.trim() || null,
        platform: form.platform.trim() || null, image_url: imageUrl,
        file_size: productFile.size >= 1073741824 ? `${(productFile.size / 1073741824).toFixed(1)} GB` : `${(productFile.size / 1048576).toFixed(1)} MB`,
        is_published: false,
      }).select('id').single();
      if (error) throw error;
      const filePath = `${product.id}/${crypto.randomUUID()}-${productFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
      const fileUpload = await supabase.storage.from('product-files').upload(filePath, productFile, { upsert: false, contentType: productFile.type || 'application/octet-stream' });
      if (fileUpload.error) throw fileUpload.error;
      const fileInsert = await supabase.from('product_files').insert({ product_id: product.id, bucket_id: 'product-files', file_path: filePath, file_name: productFile.name, file_size: productFile.size, version_label: 'v1.0.0', is_current: true });
      if (fileInsert.error) throw fileInsert.error;
      toast('Produk disimpan sebagai draft. Periksa detail sebelum dipublikasikan.', 'success');
      setShowForm(false);
      setForm(emptyProductForm);
      setProductFile(null);
      setPreviewFile(null);
      const refreshed = await supabase.from('products').select('*').order('created_at', { ascending: false }).limit(100);
      setRows((refreshed.data ?? []) as Row[]);
    } catch (error) { toast(error instanceof Error ? error.message : 'Gagal menyimpan produk.', 'error'); }
    finally { setSaving(false); }
  };

  const openEdit = (row: Row) => {
    setEditingId(String(row.id));
    setEditForm({
      name: String(row.name ?? ''),
      slug: String(row.slug ?? ''),
      description: String(row.description ?? ''),
      price: String(row.price ?? ''),
      category_id: String(row.category_id ?? ''),
      minecraft_version: String(row.minecraft_version ?? ''),
      platform: String(row.platform ?? ''),
      is_featured: Boolean(row.is_featured),
      is_new: Boolean(row.is_new),
    });
  };

  const updateProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !editingId) return;
    setEditSaving(true);
    try {
      const { error } = await supabase.from('products').update({
        name: editForm.name.trim(),
        slug: editForm.slug.trim() || slugify(editForm.name),
        description: editForm.description.trim(),
        price: Number(editForm.price),
        category_id: editForm.category_id,
        minecraft_version: editForm.minecraft_version.trim() || null,
        platform: editForm.platform.trim() || null,
        is_featured: editForm.is_featured,
        is_new: editForm.is_new,
      }).eq('id', editingId);
      if (error) throw error;
      toast('Produk berhasil diperbarui.', 'success');
      setEditingId(null);
      const refreshed = await supabase.from('products').select('*').order('created_at', { ascending: false }).limit(100);
      setRows((refreshed.data ?? []) as Row[]);
    } catch (error) { toast(error instanceof Error ? error.message : 'Gagal memperbarui produk.', 'error'); }
    finally { setEditSaving(false); }
  };

  const createCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setCategorySaving(true);
    try {
      const { error } = await supabase.from('categories').insert({
        name: categoryForm.name.trim(),
        slug: categoryForm.slug.trim() || slugify(categoryForm.name),
        description: categoryForm.description.trim() || null,
        sort_order: Number(categoryForm.sort_order) || 0,
      });
      if (error) throw error;
      toast('Kategori berhasil ditambahkan.', 'success');
      setShowCategoryForm(false);
      setCategoryForm(emptyCategoryForm);
      const [categoryRows, refreshed] = await Promise.all([
        supabase.from('categories').select('id,name').order('sort_order'),
        supabase.from('categories').select('*').order('created_at', { ascending: false }).limit(100),
      ]);
      setCategories(categoryRows.data ?? []);
      setRows((refreshed.data ?? []) as Row[]);
    } catch (error) { toast(error instanceof Error ? error.message : 'Gagal menambahkan kategori.', 'error'); }
    finally { setCategorySaving(false); }
  };

  const changeOrderStatus = async (orderId: string, status: OrderStatus) => {
    setUpdatingOrder(orderId);
    try {
      await updateOrderStatus(orderId, status);
      setRows((current) => current.map((row) => row.id === orderId ? { ...row, status } : row));
      toast(`Status pesanan diubah menjadi ${status}.`, 'success');
    } catch (error) { toast(error instanceof Error ? error.message : 'Gagal mengubah status pesanan.', 'error'); }
    finally { setUpdatingOrder(null); }
  };

  const sectionTitle = sections.find((item) => item.slug === section)?.label ?? 'Overview';
  const panelDescription = section === 'payments'
    ? 'Riwayat pembayaran lama tetap disimpan. Checkout baru menggunakan WhatsApp.'
    : 'Data terbaru dari database Shop rakDEV.';

  return <div className="admin-layout">
    <aside className="admin-sidebar">
      <Link to="/" className="brand"><span className="brand-mark">r<span>.</span></span><span className="brand-word">rakDEV<small>control panel</small></span></Link>
      <div className="admin-side-label">WORKSPACE</div>
      <nav>{sections.map(({ slug, label, icon: Icon }) => <NavLink key={slug} to={slug === 'overview' ? '/admin' : `/admin/${slug}`} end={slug === 'overview'}><Icon size={17}/>{label}{section === slug && <i/>}</NavLink>)}</nav>
      <div className="admin-sidebar-bottom">
        <div className="admin-user-chip"><span className="account-avatar">{(profile.display_name || user.email || 'A').slice(0, 1).toUpperCase()}</span><span><b>{profile.display_name || 'Admin'}</b><small>{profile.role}</small></span></div>
        <button onClick={async () => { await signOut(); }}><LogOut size={15}/> Keluar</button>
        <Link to="/"><ArrowLeft size={15}/> Lihat toko</Link>
      </div>
    </aside>

    <main className="admin-main">
      <header className="admin-topbar">
        <div><span className="admin-breadcrumb">SHOP rakDEV / ADMIN</span><h1>{sectionTitle}</h1></div>
        <div className="admin-top-right"><NotificationBell/><span className="admin-online"><i/> System workspace</span><span className="admin-avatar">{(profile.display_name || 'A').slice(0, 1).toUpperCase()}</span></div>
      </header>

      {section === 'overview' ? <>
        <div className="admin-welcome"><div><span className="eyebrow">STORE OVERVIEW</span><h2>Good to see you, {profile.display_name || 'Admin'}.</h2><p>Berikut ringkasan aktivitas Shop rakDEV.</p></div><span className="admin-date">{new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date())}</span></div>
        <div className="admin-stats">
          <div><span>PRODUCTS</span><strong>{counts.products}</strong><small>Produk terdaftar</small><Boxes/></div>
          <div><span>ORDERS</span><strong>{counts.orders}</strong><small>Total pesanan</small><ShoppingBag/></div>
          <div><span>PAID ORDERS</span><strong>{counts.paid}</strong><small>Pesanan terbayar</small><CreditCard/></div>
          <div><span>CUSTOMERS</span><strong>{counts.customers}</strong><small>Akun terdaftar</small><Users/></div>
        </div>
        <div className="admin-overview-grid">
          <div className="admin-panel">
            <div className="admin-panel-head"><div><h3>Quick actions</h3><p>Akses cepat untuk mengelola toko.</p></div><Activity size={19}/></div>
            <div className="quick-actions">
              <Link to="/admin/products"><PackagePlus size={19}/><span><b>Tambah produk</b><small>Upload file digital baru</small></span><ArrowUpRight size={15}/></Link>
              <Link to="/admin/orders"><ReceiptText size={19}/><span><b>Periksa pesanan</b><small>Pesanan WhatsApp terbaru</small></span><ArrowUpRight size={15}/></Link>
              <Link to="/admin/categories"><FolderOpen size={19}/><span><b>Kelola kategori</b><small>Atur katalog produk</small></span><ArrowUpRight size={15}/></Link>
            </div>
          </div>
          <div className="admin-panel admin-security-panel">
            <ShieldCheck size={23}/><h3>Security first.</h3>
            <p>Hak akses admin ditentukan oleh role database dan RLS. Jangan membagikan secret key atau kredensial backend.</p>
            <Link to="/admin/settings">Lihat pengaturan <ArrowUpRight size={15}/></Link>
          </div>
        </div>
      </> : section === 'settings' ? <div className="admin-panel settings-panel">
        <span className="eyebrow">SYSTEM CONFIGURATION</span><h2>Project settings.</h2>
        <p>Konfigurasi rahasia dikelola di Supabase Dashboard, bukan di halaman publik.</p>
        <div className="settings-row"><span>Supabase connection</span><b>Environment variables</b></div>
        <div className="settings-row"><span>Checkout WhatsApp</span><b>{WHATSAPP_DISPLAY}</b></div>
        <div className="settings-row"><span>Notifikasi pesanan</span><b>Database trigger + Supabase Realtime</b></div>
        <div className="settings-row"><span>Product storage</span><b>Private bucket: product-files</b></div>
        <div className="settings-row"><span>Riwayat pembayaran</span><b>Tabel payments lama tetap disimpan</b></div>
        <div className="settings-warning">Jangan pernah memasukkan Supabase Secret Key, service_role key, atau kredensial pembayaran ke frontend.</div>
      </div> : <div className="admin-panel admin-table-panel">
        <div className="admin-panel-head">
          <div><span className="eyebrow">STORE MANAGEMENT</span><h2>{sectionTitle}</h2><p>{panelDescription}</p></div>
          {section === 'products' && <Button onClick={() => setShowForm(true)}><PackagePlus size={16}/> Tambah produk</Button>}
          {section === 'categories' && <Button onClick={() => setShowCategoryForm(true)}><FolderOpen size={16}/> Tambah kategori</Button>}
        </div>
        {loadingRows ? <div className="admin-table-loading">Memuat data…</div> : rows.length ? <div className="admin-table-scroll">
          <table className="admin-table">
            <thead><tr>{section === 'products' ? ['Produk', 'Slug', 'Harga', 'Kategori', 'Status', 'Dibuat', 'Aksi']
              : section === 'orders' ? ['Pesanan', 'Pembeli', 'Kontak', 'Total', 'Status', 'Tanggal']
              : section === 'categories' ? ['Nama', 'Slug', 'Urutan', 'Dibuat']
              : Object.keys(rows[0]).slice(0, 6).map((key) => key.replaceAll('_', ' '))}</tr></thead>
            <tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)}>
              {section === 'products' ? <>
                <td>{String(row.name ?? '—')}</td>
                <td>{String(row.slug ?? '—')}</td>
                <td>{rupiah(Number(row.price ?? 0))}</td>
                <td>{categories.find((category) => category.id === row.category_id)?.name ?? '—'}</td>
                <td><span className={`status-pill ${row.is_published ? 'status-paid' : 'status-pending'}`}>{row.is_published ? 'published' : 'draft'}</span></td>
                <td>{row.created_at ? shortDate(String(row.created_at)) : '—'}</td>
                <td><div className="table-actions"><button className="table-action" onClick={() => openEdit(row)}><Pencil size={12}/> Edit</button><button className="table-action" onClick={() => void togglePublish(String(row.id), Boolean(row.is_published))}>{row.is_published ? 'Unpublish' : 'Publish'}</button></div></td>
              </> : section === 'orders' ? <>
                <td><b>{String(row.order_number ?? '—')}</b><small className="table-sub">{String(row.channel ?? 'midtrans')}</small></td>
                <td><b>{String(row.buyer_name ?? row.user_id ?? 'Guest')}</b>{row.shipping_address ? <small className="table-sub">{String(row.shipping_address)}</small> : null}{row.notes ? <small className="table-sub">{String(row.notes)}</small> : null}</td>
                <td>{row.buyer_phone ? <a className="table-wa-link" href={whatsappChatUrl(String(row.buyer_phone))} target="_blank" rel="noreferrer"><MessageCircle size={13}/> {String(row.buyer_phone)}</a> : '—'}</td>
                <td>{rupiah(Number(row.total_amount ?? 0))}</td>
                <td><select className="order-status-select" value={String(row.status ?? 'pending')} disabled={updatingOrder === String(row.id)} onChange={(event) => void changeOrderStatus(String(row.id), event.target.value as OrderStatus)}>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
                <td>{row.created_at ? shortDate(String(row.created_at)) : '—'}</td>
              </> : section === 'categories' ? <>
                <td>{String(row.name ?? '—')}</td>
                <td>{String(row.slug ?? '—')}</td>
                <td>{String(row.sort_order ?? 0)}</td>
                <td>{row.created_at ? shortDate(String(row.created_at)) : '—'}</td>
              </> : Object.entries(row).slice(0, 6).map(([key, value]) => <td key={key}>{key === 'price' || key === 'total_amount' || key === 'amount' ? rupiah(Number(value)) : key === 'created_at' && value ? shortDate(String(value)) : typeof value === 'object' ? '—' : String(value ?? '—')}</td>)}
            </tr>)}</tbody>
          </table>
        </div> : <EmptyState title={`Belum ada data ${sectionTitle.toLowerCase()}`} description="Data yang dibuat melalui toko atau admin akan muncul di bagian ini."/>}
      </div>}
    </main>

    {showForm && <div className="modal-backdrop" onClick={() => setShowForm(false)}>
      <form className="admin-modal" onClick={(event) => event.stopPropagation()} onSubmit={createProduct}>
        <div className="modal-heading"><div><span className="eyebrow">PRODUCT MANAGEMENT</span><h2>Tambah produk</h2></div><button type="button" className="icon-button" onClick={() => setShowForm(false)}><X size={19}/></button></div>
        <label>Nama produk<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={120}/></label>
        <label>Slug (opsional)<input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="dibuat-otomatis-dari-nama"/></label>
        <label>Kategori<select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })} required><option value="">Pilih kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Harga (IDR)<input type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} min="1000" required/></label>
        <label>Deskripsi<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} required/></label>
        <div className="admin-form-two"><label>Versi Minecraft<input value={form.minecraft_version} onChange={(event) => setForm({ ...form, minecraft_version: event.target.value })} placeholder="1.21.x"/></label><label>Platform<input value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })} placeholder="Paper / Java Edition"/></label></div>
        <label>File produk <small>Wajib · Maksimum 500 MB di UI ini</small><input type="file" accept=".jar,.sk,.zip,.tar,.gz,.mcworld,.schem,.litematic" onChange={(event) => setProductFile(event.target.files?.[0] ?? null)} required/></label>
        <label>Gambar preview <small>Opsional · JPG, PNG, WebP</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setPreviewFile(event.target.files?.[0] ?? null)}/></label>
        <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Batal</Button><Button type="submit" loading={saving}>Simpan sebagai draft</Button></div>
      </form>
    </div>}

    {editingId && <div className="modal-backdrop" onClick={() => setEditingId(null)}>
      <form className="admin-modal" onClick={(event) => event.stopPropagation()} onSubmit={updateProduct}>
        <div className="modal-heading"><div><span className="eyebrow">PRODUCT MANAGEMENT</span><h2>Edit produk</h2></div><button type="button" className="icon-button" onClick={() => setEditingId(null)}><X size={19}/></button></div>
        <label>Nama produk<input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} required maxLength={120}/></label>
        <label>Slug<input value={editForm.slug} onChange={(event) => setEditForm({ ...editForm, slug: event.target.value })}/></label>
        <label>Kategori<select value={editForm.category_id} onChange={(event) => setEditForm({ ...editForm, category_id: event.target.value })} required><option value="">Pilih kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Harga (IDR)<input type="number" value={editForm.price} onChange={(event) => setEditForm({ ...editForm, price: event.target.value })} min="1000" required/></label>
        <label>Deskripsi<textarea value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} rows={3} required/></label>
        <div className="admin-form-two"><label>Versi Minecraft<input value={editForm.minecraft_version} onChange={(event) => setEditForm({ ...editForm, minecraft_version: event.target.value })}/></label><label>Platform<input value={editForm.platform} onChange={(event) => setEditForm({ ...editForm, platform: event.target.value })}/></label></div>
        <div className="admin-checkbox-row"><label><input type="checkbox" checked={editForm.is_featured} onChange={(event) => setEditForm({ ...editForm, is_featured: event.target.checked })}/> Featured</label><label><input type="checkbox" checked={editForm.is_new} onChange={(event) => setEditForm({ ...editForm, is_new: event.target.checked })}/> New</label></div>
        <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setEditingId(null)}>Batal</Button><Button type="submit" loading={editSaving}>Simpan perubahan</Button></div>
      </form>
    </div>}

    {showCategoryForm && <div className="modal-backdrop" onClick={() => setShowCategoryForm(false)}>
      <form className="admin-modal" onClick={(event) => event.stopPropagation()} onSubmit={createCategory}>
        <div className="modal-heading"><div><span className="eyebrow">CATEGORY MANAGEMENT</span><h2>Tambah kategori</h2></div><button type="button" className="icon-button" onClick={() => setShowCategoryForm(false)}><X size={19}/></button></div>
        <label>Nama kategori<input value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} required maxLength={80}/></label>
        <label>Slug (opsional)<input value={categoryForm.slug} onChange={(event) => setCategoryForm({ ...categoryForm, slug: event.target.value })} placeholder="dibuat-otomatis-dari-nama"/></label>
        <label>Deskripsi<input value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} maxLength={200}/></label>
        <label>Urutan<input type="number" value={categoryForm.sort_order} onChange={(event) => setCategoryForm({ ...categoryForm, sort_order: event.target.value })} min="0"/></label>
        <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setShowCategoryForm(false)}>Batal</Button><Button type="submit" loading={categorySaving}>Simpan kategori</Button></div>
      </form>
    </div>}
  </div>;
}
