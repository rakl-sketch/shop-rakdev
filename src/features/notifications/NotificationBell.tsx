import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing } from 'lucide-react';
import { useAnnouncements } from './AnnouncementProvider';
import { isSubscribed, pushSupported, subscribePush, unsubscribePush } from './push';
import { useToast } from '../../components/ui/Toast';
import { supabaseConfigured } from '../../lib/env';

export function NotificationBell() {
  const { items, unread, markSeen } = useAnnouncements();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = pushSupported();

  useEffect(() => { if (supported) void isSubscribed().then(setPushOn).catch(() => setPushOn(false)); }, [supported]);
  if (!supabaseConfigured) return null;

  const toggle = () => { const next = !open; setOpen(next); if (next) markSeen(); };
  const togglePush = async () => {
    setBusy(true);
    try {
      if (pushOn) { await unsubscribePush(); setPushOn(false); toast('Notifikasi push dimatikan.', 'success'); }
      else { await subscribePush(); setPushOn(true); toast('Notifikasi push aktif.', 'success'); }
    } catch (error) { toast(error instanceof Error ? error.message : 'Gagal mengubah notifikasi.', 'error'); }
    finally { setBusy(false); }
  };

  return <div className="notif">
    <button className="notif-trigger" aria-label={`Notifikasi, ${unread} baru`} aria-expanded={open} onClick={toggle}>
      {unread > 0 ? <BellRing size={20}/> : <Bell size={20}/>}
      {unread > 0 && <span className="cart-count">{unread}</span>}
    </button>
    {open && <div className="notif-panel">
      <div className="notif-head"><b>[pp] Shop rakDEV</b><small>Produk terbaru</small></div>
      {items.length === 0 ? <p className="notif-empty">Belum ada produk baru.</p> : <ul>
        {items.map((item) => <li key={item.id}><Link to={`/product/${item.product_slug}`} onClick={() => setOpen(false)}>
          <b>{item.product_name}</b><small>{new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
        </Link></li>)}
      </ul>}
      {supported && <button className="notif-push" disabled={busy} onClick={togglePush}>{pushOn ? 'Matikan notifikasi push' : 'Aktifkan notifikasi push'}</button>}
    </div>}
  </div>;
}
