/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import {
  notificationOptions,
  openNotificationTarget,
  parsePushData,
  resolveClickUrl,
  type ClientsLike,
} from './sw/notifications';

declare const self: ServiceWorkerGlobalScope;

// Cache somente dos arquivos estáticos do build. Sem cache de respostas do Supabase/API.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/\.well-known\//],
  }),
);

self.addEventListener('message', (event) => {
  if (event.data && (event.data as { type?: string }).type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

function readJson(event: PushEvent): unknown {
  try {
    return event.data?.json();
  } catch {
    return null;
  }
}

self.addEventListener('push', (event) => {
  const data = parsePushData(readJson(event));
  if (!data) return;
  event.waitUntil(self.registration.showNotification(data.title, notificationOptions(data)));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = resolveClickUrl(
    self.location.origin,
    (event.notification.data as { url?: string } | null)?.url ?? '/',
  );
  event.waitUntil(
    openNotificationTarget(self.clients as unknown as ClientsLike, self.location.origin, url),
  );
});
