import { z } from 'zod';

const schema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type Env = { supabaseUrl: string; supabasePublishableKey: string };

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
  };
}

let cached: Env | undefined;

/** Avaliação preguiçosa e memoizada: importar este módulo nunca lança. */
export function getEnv(): Env {
  cached ??= parseEnv(import.meta.env as Record<string, string | undefined>);
  return cached;
}
