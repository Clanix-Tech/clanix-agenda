// Lembretes neste aparelho (Web Push): estado real do navegador, ativar, desativar, teste e
// limpeza ao sair. O service worker só existe no build (`devOptions` desligado no vite-plugin-pwa):
// no `vite dev` não há registro, então o estado é sempre `sem-suporte`. Para testar push de
// verdade: `npm run build && npm run preview`.
import { getEnv } from '@/lib/env';
import { toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export type DeviceState =
  'sem-suporte' | 'iphone-instalar' | 'bloqueado' | 'desativado' | 'ativado';

export type DeviceEnv = {
  /** Há registro de service worker (`navigator.serviceWorker.getRegistration()` não nulo). */
  hasSW: boolean;
  hasPush: boolean;
  hasNotification: boolean;
  isIOS: boolean;
  /** Aberto pelo ícone da Tela de Início (app instalado). */
  isStandalone: boolean;
  permission: NotificationPermission;
  /** O navegador tem assinatura e ela está registrada para o usuário atual. */
  hasSubscription: boolean;
};

export type TestResult = { sent: number; removed: number };

/** Tempo máximo para apagar a assinatura deste aparelho ao sair. */
const SIGN_OUT_TIMEOUT_MS = 3000;

export function detectDeviceState(env: DeviceEnv): DeviceState {
  // No iPhone, Web Push só existe no app instalado: antes disso o caminho é instalar.
  if (env.isIOS && !env.isStandalone) return 'iphone-instalar';
  if (!env.hasSW || !env.hasPush || !env.hasNotification) return 'sem-suporte';
  if (env.permission === 'denied') return 'bloqueado';
  if (env.permission === 'granted' && env.hasSubscription) return 'ativado';
  return 'desativado';
}

/** Rótulo do aparelho gravado com a assinatura, ex.: "iPhone · Safari". */
export function deviceLabel(userAgent: string, iPadAsMac = false): string {
  const device = /iPhone|iPod/.test(userAgent)
    ? 'iPhone'
    : /iPad/.test(userAgent) || iPadAsMac
      ? 'iPad'
      : /Android/.test(userAgent)
        ? 'Android'
        : /CrOS/.test(userAgent)
          ? 'Chromebook'
          : /Windows/.test(userAgent)
            ? 'Windows'
            : /Macintosh|Mac OS X/.test(userAgent)
              ? 'Mac'
              : /Linux/.test(userAgent)
                ? 'Linux'
                : 'Aparelho';
  const browser = /EdgiOS|EdgA|Edg\//.test(userAgent)
    ? 'Edge'
    : /SamsungBrowser/.test(userAgent)
      ? 'Samsung Internet'
      : /OPR\/|Opera/.test(userAgent)
        ? 'Opera'
        : /FxiOS|Firefox\//.test(userAgent)
          ? 'Firefox'
          : /CriOS|Chrome\//.test(userAgent)
            ? 'Chrome'
            : // O app instalado no iPhone/iPad não traz "Safari/" no user agent, mas é o Safari.
              /Safari\//.test(userAgent) || device === 'iPhone' || device === 'iPad'
              ? 'Safari'
              : 'Navegador';
  return `${device} · ${browser}`;
}

/** Chave pública VAPID do ambiente; sem ela não há como ativar lembretes. */
export function vapidPublicKey(): string | null {
  return getEnv().vapidPublicKey;
}

/** iPadOS se apresenta como Mac; a tela de toque denuncia. */
function isIPadAsMac(userAgent: string): boolean {
  return /Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;
  return navigator.serviceWorker.getRegistration();
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('PushManager' in window)) return null;
  const registration = await getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** A linha do endpoint é visível (RLS) só para o dono: outra conta no mesmo navegador não conta. */
async function isRegisteredForMe(endpoint: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', endpoint)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

async function deleteRow(endpoint: string): Promise<void> {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw error;
}

async function readDeviceEnv(): Promise<DeviceEnv> {
  const userAgent = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(userAgent) || isIPadAsMac(userAgent);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const hasPush = 'PushManager' in window;
  const hasNotification = 'Notification' in window;
  const registration = await getRegistration();
  const permission: NotificationPermission = hasNotification ? Notification.permission : 'default';
  const subscription =
    hasPush && registration && permission === 'granted'
      ? await registration.pushManager.getSubscription()
      : null;
  return {
    hasSW: !!registration,
    hasPush,
    hasNotification,
    isIOS,
    isStandalone,
    permission,
    hasSubscription: subscription ? await isRegisteredForMe(subscription.endpoint) : false,
  };
}

export async function readDeviceState(): Promise<DeviceState> {
  return detectDeviceState(await readDeviceEnv());
}

/**
 * Ativa os lembretes neste aparelho. Só pode ser chamada direto do clique: o pedido de permissão
 * acontece antes de qualquer `await` (exigência do iOS). Permissão não concedida: sai sem assinar
 * nem chamar a RPC. RPC sem sucesso: desfaz a assinatura do navegador (RN17) e lança `AppError`.
 */
export function subscribeThisDevice(): Promise<void> {
  const key = vapidPublicKey();
  if (!key || !('Notification' in window)) return Promise.reject(toAppError(null));
  const permission = Notification.requestPermission();
  return (async () => {
    if ((await permission) !== 'granted') return;
    const applicationServerKey = base64UrlToBytes(key);
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    // Assinatura feita com outra chave VAPID (chave trocada) não recebe nada: troca por uma nova.
    if (existing && !sameBytes(existing.options.applicationServerKey, applicationServerKey)) {
      await existing.unsubscribe();
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    const { endpoint, keys } = subscription.toJSON();
    const { error } = await supabase.rpc('register_push_subscription', {
      p_endpoint: endpoint ?? '',
      p_p256dh: keys?.p256dh ?? '',
      p_auth: keys?.auth ?? '',
      p_device_label: deviceLabel(navigator.userAgent, isIPadAsMac(navigator.userAgent)),
    });
    if (error) {
      // Sem a confirmação do servidor este aparelho não pode aparecer como ativado.
      await subscription.unsubscribe().catch(() => false);
      throw error;
    }
  })().catch((err: unknown) => {
    throw toAppError(err);
  });
}

/** Desativa neste aparelho: apaga a linha do endpoint e cancela a assinatura do navegador. */
export async function unsubscribeThisDevice(): Promise<void> {
  try {
    const subscription = await currentSubscription();
    if (!subscription) return;
    await deleteRow(subscription.endpoint);
    await subscription.unsubscribe();
  } catch (err) {
    throw toAppError(err);
  }
}

/**
 * Ao sair da conta: apaga a linha deste aparelho (melhor esforço, com tempo limite) e cancela a
 * assinatura do navegador mesmo se o banco não responder. Nunca lança.
 */
export async function forgetThisDevice(timeoutMs = SIGN_OUT_TIMEOUT_MS): Promise<void> {
  const subscription = await currentSubscription().catch(() => null);
  if (!subscription) return;
  await withTimeout(deleteRow(subscription.endpoint), timeoutMs).catch(() => {});
  await subscription.unsubscribe().catch(() => false);
}

/** Pede à Edge Function uma notificação de teste para os aparelhos do próprio usuário. */
export async function sendTestNotification(): Promise<TestResult> {
  try {
    const { data, error } = await supabase.functions.invoke<TestResult>('send-test-notification', {
      method: 'POST',
    });
    if (error) throw httpStatusOf(error) ?? error;
    return { sent: data?.sent ?? 0, removed: data?.removed ?? 0 };
  } catch (err) {
    throw toAppError(err);
  }
}

/** `FunctionsHttpError` traz a resposta em `context`: o status (ex.: 401) decide o tipo do erro. */
function httpStatusOf(error: unknown): { status: number } | null {
  const status = (error as { context?: { status?: unknown } }).context?.status;
  return typeof status === 'number' ? { status } : null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('tempo_esgotado')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sameBytes(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  const left = new Uint8Array(a);
  return left.every((byte, i) => byte === b[i]);
}
