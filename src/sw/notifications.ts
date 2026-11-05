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

/** Parte de `WindowClient` de que a escolha da janela precisa (permite testar sem navegador). */
export type WindowLike = {
  url: string;
  focus(): Promise<WindowLike>;
  navigate(url: string): Promise<unknown>;
};
export type ClientsLike = {
  /** Sem `includeUncontrolled`: devolve só as janelas que este service worker controla. */
  matchAll(options: { type: 'window' }): Promise<readonly WindowLike[]>;
  openWindow(url: string): Promise<unknown>;
};

/**
 * Toque na notificação: foca uma janela do app controlada por este service worker e navega até
 * a URL. `navigate()` rejeita em janela não controlada; por isso só as controladas entram na
 * escolha. Se `focus()`/`navigate()` rejeitarem, ou não houver janela, abre uma nova.
 */
export async function openNotificationTarget(
  clients: ClientsLike,
  origin: string,
  url: string,
): Promise<void> {
  const windows = await clients.matchAll({ type: 'window' });
  const candidate = windows.find((w) => new URL(w.url).origin === origin);
  if (candidate) {
    try {
      const focused = await candidate.focus();
      await focused.navigate(url);
      return;
    } catch {
      // cai na janela nova
    }
  }
  await clients.openWindow(url);
}
