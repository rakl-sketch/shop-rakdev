import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';

export type Announcement = { id: string; product_name: string; product_slug: string; image_url: string | null; created_at: string };
type Value = { items: Announcement[]; unread: number; markSeen: () => void };

const SEEN_KEY = 'rakdev:announcements-seen';
const Context = createContext<Value | null>(null);

const readSeen = () => { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } };
const writeSeen = (value: string) => { try { localStorage.setItem(SEEN_KEY, value); } catch { /* storage unavailable */ } };

export function AnnouncementProvider({ children }: PropsWithChildren) {
  const { toast } = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [seen, setSeen] = useState<string>(() => {
    const stored = readSeen();
    if (stored) return stored;
    const now = new Date().toISOString(); // pengunjung baru: tidak ada "belum dibaca" lama
    writeSeen(now);
    return now;
  });

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    client.from('announcements').select('id,product_name,product_slug,image_url,created_at')
      .order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => { if (active && data) setItems(data as Announcement[]); });
    const channel = client.channel('announcements')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
        const row = payload.new as Announcement;
        setItems((current) => [row, ...current.filter((item) => item.id !== row.id)].slice(0, 10));
        toast(`[pp] Shop rakDEV: ${row.product_name}`, 'info');
      })
      .subscribe();
    return () => { active = false; void client.removeChannel(channel); };
  }, [toast]);

  const markSeen = useCallback(() => { const now = new Date().toISOString(); writeSeen(now); setSeen(now); }, []);
  const unread = useMemo(() => items.filter((item) => item.created_at > seen).length, [items, seen]);
  const value = useMemo(() => ({ items, unread, markSeen }), [items, unread, markSeen]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAnnouncements() {
  const context = useContext(Context);
  if (!context) throw new Error('useAnnouncements must be used inside AnnouncementProvider');
  return context;
}
