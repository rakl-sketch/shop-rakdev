import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing } from 'lucide-react';
import { useNotifications } from './NotificationsProvider';
import { isSubscribed, pushPermission, pushSupported, subscribePush, unsubscribePush } from './push';
import { useToast } from '../../components/ui/Toast';
import { supabaseConfigured } from '../../lib/env';

export function NotificationBell() {
  const { items, unread, markSeen } = useNotifications();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const supported = pushSupported();
  const permission = pushPermission();

  useEffect(() => { if (supported) void isSubscribed().then(setPushOn).catch(() => setPushOn(false)); }, [supported]);
  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);
  if (!supabaseConfigured) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void markSeen();
  };

  const togglePush = async () => {
    setBusy(true);
    try {
      if (pushOn) { await unsubscribePush(); setPushOn(false); toast('Notifikasi push dimatikan.', 'success'); }
      else { await subscribePush(); setPushOn(true); toast('Notifikasi push aktif.', 'success'); }
    } catch (error) { toast(error instanceof Error ? error.message : 'Gagal mengubah notifikasi.', 'error'); }
    finally { setBusy(false); }
  };

  return <div className="notif" ref={panelRef}>
    <button className="notif-trigger" aria-label={`Notifikasi, ${unread} belum dibaca`} aria-expanded={open} aria-controls="notification-panel" onClick={toggle}>
      {unread > 0 ? <BellRing size={20}/> : <Bell size={20}/>}
      {unread > 0 && <span className="cart-count">{unread}</span>}
    </button>
    {open && <div id="notification-panel" className="notif-panel" role="dialog" aria-modal="false" aria-labelledby="notification-title">
      <div className="notif-head"><b id="notification-title">Notifikasi</b><small>{unread ? `${unread} belum dibaca` : 'Semua terbaca'}</small></div>
      {items.length === 0 ? <p className="notif-empty">Belum ada notifikasi.</p> : <ul className="notif-list">
        {items.map((item) => <li key={item.id}>
          <Link to={item.link} onClick={() => setOpen(false)} className={item.read ? 'notif-item' : 'notif-item notif-unread'}>
            <span className={`notif-kind notif-kind-${item.kind}`}>{item.kind === 'announcement' ? 'PRODUK' : 'PESANAN'}</span>
            <b>{item.title}</b>
            {item.body && <small>{item.body}</small>}
            <small className="notif-date">{new Date(item.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</small>
          </Link>
        </li>)}
      </ul>}
      {supported && <button className="notif-push" disabled={busy} onClick={togglePush}>{pushOn ? 'Matikan notifikasi push' : 'Aktifkan notifikasi push'}</button>}
      {permission === 'denied' && <p className="notif-permission">Izin notifikasi diblokir browser. Aktifkan lewat pengaturan situs.</p>}
    </div>}
  </div>;
}
