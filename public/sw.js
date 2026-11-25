self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* ignore */ }
  const title = data.title || '[pp] Shop rakDEV';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: new URL('favicon.svg', self.registration.scope).href,
    image: data.image,
    tag: 'rakdev-product',
    data: { path: data.path || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.path) || '/';
  const target = new URL(path.replace(/^\//, ''), self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const client of list) {
      if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
        return client.focus().then((c) => ('navigate' in c ? c.navigate(target) : c));
      }
    }
    return self.clients.openWindow(target);
  }));
});
