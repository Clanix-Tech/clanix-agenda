import { z } from 'zod';

const schema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  // Opcional: sem ela, Ajustes › Notificações avisa que os lembretes não foram configurados.
  VITE_VAPID_PUBLIC_KEY: z.string().optional(),
});

export type Env = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  /** Chave pública VAPID (Web Push); `null` quando o ambiente não configurou lembretes. */
  vapidPublicKey: string | null;
};

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
  };
}

let cached: Env | undefined;

/** Avaliação preguiçosa e memoizada: importar este módulo nunca lança. */
export function getEnv(): Env {
  cached ??= parseEnv(import.meta.env as Record<string, string | undefined>);
  return cached;
}
