import { vi } from 'vitest';

/** Chave pública VAPID de exemplo (P-256, 65 bytes em base64url). */
export const TEST_VAPID_KEY =
  'BF2IWmoBx0EqrHwWhvvhWgH6G6eLaBFm8rTIuhMdhVA3PD0xGejXlybumP1Xy6_Xb4pdTnYaVlmvX6CzSk9oaMI';

export const IPHONE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
export const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

export type FakePushOptions = {
  /** Há registro de service worker (padrão: sim). */
  // `later`: sem registro até `registerServiceWorker()` (1ª visita: o app registra depois).
  sw?: boolean | 'later';
  /** `PushManager` existe (padrão: sim). */
  push?: boolean;
  /** `Notification` existe (padrão: sim). */
  notification?: boolean;
  /** `Notification.permission` inicial (padrão: `default`). */
  permission?: NotificationPermission;
  /** Resposta do pedido de permissão (padrão: `granted`). */
  answer?: NotificationPermission;
  /** Endpoint de uma assinatura que o navegador já tem. */
  subscribed?: string;
  userAgent?: string;
  /** Aberto pelo ícone da Tela de Início (iOS: `navigator.standalone`). */
  standalone?: boolean;
  /** `navigator.maxTouchPoints` (iPadOS se apresenta como Mac, mas tem toque). */
  maxTouchPoints?: number;
};

export type FakeSubscription = {
  endpoint: string;
  options: { applicationServerKey: ArrayBuffer | null };
  toJSON(): { endpoint: string; keys: { p256dh: string; auth: string } };
  unsubscribe: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
};

/** Simula service worker, Push API e Notification no jsdom. Desfaça com `restore()`. */
export function installFakePush(options: FakePushOptions = {}) {
  const state = {
    permission: options.permission ?? 'default',
    current: null as FakeSubscription | null,
    shown: [] as Array<{ close: ReturnType<typeof vi.fn<() => void>> }>,
  };
  let count = 0;

  const makeSubscription = (endpoint: string, key: ArrayBuffer | null): FakeSubscription => {
    const sub: FakeSubscription = {
      endpoint,
      options: { applicationServerKey: key },
      toJSON: () => ({
        endpoint,
        keys: { p256dh: 'p256dh-do-aparelho', auth: 'auth-do-aparelho' },
      }),
      unsubscribe: vi.fn(async () => {
        if (state.current === sub) state.current = null;
        return true;
      }),
    };
    return sub;
  };

  if (options.subscribed) {
    state.current = makeSubscription(options.subscribed, keyBytes(TEST_VAPID_KEY));
  }

  const subscribe = vi.fn(
    async (opts: { userVisibleOnly: boolean; applicationServerKey: BufferSource }) => {
      if (state.permission !== 'granted') throw new DOMException('negado', 'NotAllowedError');
      count += 1;
      state.current ??= makeSubscription(
        `https://push.example/aparelho-${count}`,
        toArrayBuffer(opts.applicationServerKey),
      );
      return state.current;
    },
  );
  const registration = {
    pushManager: { getSubscription: vi.fn(async () => state.current), subscribe },
    /** Notificações exibidas (cada uma com `close`). */
    getNotifications: vi.fn(async () => state.shown),
  };

  const requestPermission = vi.fn(async () => {
    state.permission = options.answer ?? 'granted';
    return state.permission;
  });

  const own: Array<[object, string]> = [];
  const define = (target: object, key: string, value: unknown) => {
    Object.defineProperty(target, key, { configurable: true, value });
    own.push([target, key]);
  };

  // Como no navegador: `ready` só resolve quando há um service worker ativo.
  let registered = options.sw === undefined || options.sw === true;
  let resolveReady!: (r: typeof registration) => void;
  const ready = new Promise<typeof registration>((resolve) => (resolveReady = resolve));
  if (registered) resolveReady(registration);
  const registerServiceWorker = () => {
    registered = true;
    resolveReady(registration);
  };
  define(navigator, 'serviceWorker', {
    getRegistration: vi.fn(async () => (registered ? registration : undefined)),
    ready,
  });
  if (options.maxTouchPoints !== undefined) {
    define(navigator, 'maxTouchPoints', options.maxTouchPoints);
  }
  if (options.userAgent) define(navigator, 'userAgent', options.userAgent);
  if (options.standalone) define(navigator, 'standalone', true);
  if (options.push !== false) vi.stubGlobal('PushManager', function PushManager() {});
  if (options.notification !== false) {
    vi.stubGlobal('Notification', {
      get permission() {
        return state.permission;
      },
      requestPermission,
    });
  }

  return {
    state,
    registration,
    requestPermission,
    subscribe,
    /** Simula o app registrando o service worker depois da primeira leitura. */
    registerServiceWorker,
    /** Assinatura atual do navegador (ou `null`). */
    subscription: () => state.current,
    restore() {
      for (const [target, key] of own) delete (target as Record<string, unknown>)[key];
      vi.unstubAllGlobals();
    },
  };
}

export type FakePush = ReturnType<typeof installFakePush>;

function keyBytes(base64url: string): ArrayBuffer {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function toArrayBuffer(source: BufferSource): ArrayBuffer {
  if (source instanceof ArrayBuffer) return source;
  const view = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  return view.slice().buffer;
}
