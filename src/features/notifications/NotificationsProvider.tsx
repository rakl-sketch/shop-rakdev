import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../app/AuthProvider';

export type Announcement = {
  id: string;
  product_name: string;
  product_slug: string;
  image_url: string | null;
  created_at: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  audience: 'user' | 'admin';
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationFeedItem = {
  id: string;
  kind: 'announcement' | 'notification';
  title: string;
  body?: string;
  link: string;
  created_at: string;
  read: boolean;
};

type Value = { items: NotificationFeedItem[]; unread: number; markSeen: () => Promise<void> };

const SEEN_KEY = 'rakdev:announcements-seen';
const Context = createContext<Value | null>(null);

const readSeen = () => { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } };
const writeSeen = (value: string) => { try { localStorage.setItem(SEEN_KEY, value); } catch { /* storage unavailable */ } };

export function NotificationsProvider({ children }: PropsWithChildren) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const toastedRef = useRef<Set<string>>(new Set());
  const [seen, setSeen] = useState<string>(() => {
    const stored = readSeen();
    if (stored) return stored;
    const now = new Date().toISOString();
    writeSeen(now);
    return now;
  });

  // Produk baru: pengumuman publik + toast realtime.
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    void client.from('announcements').select('id,product_name,product_slug,image_url,created_at')
      .order('created_at', { ascending: false }).limit(10)
      .then(({ data, error }) => { if (active && !error && data) setAnnouncements(data as Announcement[]); });

    const channel = client.channel('announcements-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
        const row = payload.new as Announcement;
        setAnnouncements((current) => [row, ...current.filter((item) => item.id !== row.id)].slice(0, 10));
        const key = `announcement-${row.id}`;
        if (!toastedRef.current.has(key)) {
          toastedRef.current.add(key);
          toast(`Produk baru: ${row.product_name}`, 'info');
        }
      })
      .subscribe();

    return () => { active = false; void client.removeChannel(channel); };
  }, [toast]);

  // Notifikasi pesanan/status milik akun yang sedang login.
  useEffect(() => {
    if (!supabase || !user) { setNotifications([]); return; }
    const client = supabase;
    const userId = user.id;
    let active = true;

    void client.from('notifications')
      .select('id,user_id,audience,type,title,body,link,read_at,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data, error }) => { if (active && !error) setNotifications((data ?? []) as NotificationRow[]); });

    const channel = client.channel(`notifications-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
        const row = payload.new as NotificationRow;
        if (row.user_id !== userId) return;
        setNotifications((current) => [row, ...current.filter((item) => item.id !== row.id)].slice(0, 30));
        const key = `notification-${row.id}`;
        if (!toastedRef.current.has(key)) {
          toastedRef.current.add(key);
          toast(row.title, 'info');
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
        const row = payload.new as NotificationRow;
        if (row.user_id !== userId) return;
        setNotifications((current) => current.map((item) => item.id === row.id ? { ...item, ...row } : item));
      })
      .subscribe();

    return () => { active = false; void client.removeChannel(channel); };
  }, [user?.id, toast]);

  const markSeen = useCallback(async () => {
    const now = new Date().toISOString();
    writeSeen(now);
    setSeen(now);
    if (!supabase || !user) return;
    const { error } = await supabase.from('notifications')
      .update({ read_at: now }).eq('user_id', user.id).is('read_at', null);
    if (!error) setNotifications((current) => current.map((item) => item.read_at ? item : { ...item, read_at: now }));
  }, [user?.id]);

  const items = useMemo<NotificationFeedItem[]>(() => {
    const productItems: NotificationFeedItem[] = announcements.map((item) => ({
      id: `announcement-${item.id}`,
      kind: 'announcement',
      title: item.product_name,
      body: 'Produk baru tersedia di Shop rakDEV.',
      link: `/product/${item.product_slug}`,
      created_at: item.created_at,
      read: item.created_at <= seen,
    }));
    const accountItems: NotificationFeedItem[] = notifications.map((item) => ({
      id: `notification-${item.id}`,
      kind: 'notification',
      title: item.title,
      body: item.body ?? undefined,
      link: item.link ?? '/account',
      created_at: item.created_at,
      read: Boolean(item.read_at),
    }));
    return [...accountItems, ...productItems]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 30);
  }, [announcements, notifications, seen]);

  const unread = useMemo(() => items.filter((item) => !item.read).length, [items]);
  const value = useMemo(() => ({ items, unread, markSeen }), [items, unread, markSeen]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error('useNotifications must be used inside NotificationsProvider');
  return context;
}
