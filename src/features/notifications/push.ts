import { supabase } from '../../lib/supabase';

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const pushSupported = () =>
  Boolean(supabase && vapidPublicKey) && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function keyToBytes(base64Url: string) {
  const padded = base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration() {
  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}

export async function isSubscribed() {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  return Boolean(reg && (await reg.pushManager.getSubscription()));
}

export async function subscribePush() {
  if (!supabase || !vapidPublicKey) throw new Error('Notifikasi belum dikonfigurasi.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Izin notifikasi ditolak.');
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(vapidPublicKey) }));
  const { error } = await supabase.functions.invoke('push-subscribe', { body: { subscription: sub.toJSON() } });
  if (error) throw error;
}

export async function unsubscribePush() {
  if (!supabase) return;
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.functions.invoke('push-subscribe', { body: { action: 'unsubscribe', endpoint: sub.endpoint } });
  await sub.unsubscribe();
}
