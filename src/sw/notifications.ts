/** Lógica pura do service worker (testável sem navegador). */

export type PushData = { title: string; body: string; url: string; tag: string };

const BADGE = '/pwa-64x64.png';

/** Aceita só o formato enviado pelo servidor; `url` que não seja caminho do próprio app vira `/`. */
export function parsePushData(data: unknown): PushData | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const { title, body, url, tag } = data as Record<string, unknown>;
  if (typeof title !== 'string' || typeof body !== 'string' || typeof tag !== 'string') return null;
  if (typeof url !== 'string') return null;
  const safe = url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\');
  return { title, body, tag, url: safe ? url : '/' };
}

// `renotify` existe nos navegadores, mas ainda não nos tipos do TypeScript.
export function notificationOptions(p: PushData): NotificationOptions & { renotify: boolean } {
  return {
    body: p.body,
    tag: p.tag,
    data: { url: p.url },
    icon: '/pwa-192x192.png',
    badge: BADGE,
    renotify: false,
  };
}

/** URL absoluta para abrir ao tocar na notificação; outro domínio nunca é aceito. */
export function resolveClickUrl(origin: string, url: string): string {
  try {
    const resolved = new URL(url, origin);
    if (resolved.origin === new URL(origin).origin) return resolved.href;
  } catch {
    // cai no padrão abaixo
  }
  return new URL('/', origin).href;
}
