// Chave secreta das Edge Functions: só roda no Deno. Nunca no bundle do app.

/** Chave secreta nova (`SUPABASE_SECRET_KEYS.default`) ou, na falta dela, a service role legada. */
export function serviceKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string | undefined>;
    if (parsed.default) return parsed.default;
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!legacy) throw new Error('Variável de ambiente ausente: SUPABASE_SERVICE_ROLE_KEY');
  return legacy;
}
