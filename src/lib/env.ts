import { z } from 'zod';

const schema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  // Opcional: sem ela, Ajustes › Notificações avisa que os lembretes não foram configurados.
  VITE_VAPID_PUBLIC_KEY: z.string().optional(),
  // Opcional: sem ela, o guia de instalação não oferece o download do APK.
  VITE_APK_DOWNLOAD_URL: z.string().optional(),
  // Opcional: site key pública do Cloudflare Turnstile. Sem ela, não há CAPTCHA.
  VITE_TURNSTILE_SITE_KEY: z.string().optional(),
  // Opcionais: quem responde pelo serviço, mostrado na Política de Privacidade.
  VITE_PRIVACY_CONTROLLER_NAME: z.string().optional(),
  VITE_PRIVACY_CONTACT_EMAIL: z.string().optional(),
});

export type Env = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  /** Chave pública VAPID (Web Push); `null` quando o ambiente não configurou lembretes. */
  vapidPublicKey: string | null;
  /** Link do APK Android; `null` quando não há (ou não é uma URL http/https válida). */
  apkDownloadUrl: string | null;
  /** Site key pública do Turnstile; `null` quando o CAPTCHA não está configurado. */
  turnstileSiteKey: string | null;
  /** Nome de quem responde pelo serviço; `null` quando não informado. */
  privacyControllerName: string | null;
  /** E-mail de contato para pedidos de privacidade; `null` quando ausente ou inválido. */
  privacyContactEmail: string | null;
};

function httpUrlOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const { protocol } = new URL(trimmed);
    return protocol === 'https:' || protocol === 'http:' ? trimmed : null;
  } catch {
    return null;
  }
}

function emailOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return z.email().safeParse(trimmed).success ? trimmed : null;
}

/** Função pura (testável). Lança `Configuração ausente: <NOME>` para o primeiro campo inválido. */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const name = String(result.error.issues[0]?.path[0] ?? 'VITE_SUPABASE_URL');
    throw new Error(`Configuração ausente: ${name}`);
  }
  return {
    supabaseUrl: result.data.VITE_SUPABASE_URL,
    supabasePublishableKey: result.data.VITE_SUPABASE_PUBLISHABLE_KEY,
    vapidPublicKey: result.data.VITE_VAPID_PUBLIC_KEY?.trim() || null,
    apkDownloadUrl: httpUrlOrNull(result.data.VITE_APK_DOWNLOAD_URL),
    turnstileSiteKey: result.data.VITE_TURNSTILE_SITE_KEY?.trim() || null,
    privacyControllerName: result.data.VITE_PRIVACY_CONTROLLER_NAME?.trim() || null,
    privacyContactEmail: emailOrNull(result.data.VITE_PRIVACY_CONTACT_EMAIL),
  };
}

let cached: Env | undefined;

/** Avaliação preguiçosa e memoizada: importar este módulo nunca lança. */
export function getEnv(): Env {
  cached ??= parseEnv(import.meta.env as Record<string, string | undefined>);
  return cached;
}
