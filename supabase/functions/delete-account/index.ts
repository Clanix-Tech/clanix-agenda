// Edge Function delete-account: apaga a conta de quem chama e, em cascata, todos os dados dela.
// `verify_jwt = false`; o handler confirma o token no Auth e exige senha digitada há pouco.
import 'jsr:@supabase/functions-js@2.119.0/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { serviceKey } from '../_shared/serviceKey.ts';
import { handleDeleteAccount } from './handler.ts';

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

const supabaseUrl = requireEnv('SUPABASE_URL');
const admin = createClient(supabaseUrl, serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function verify(token: string) {
  // O Auth confirma que o token é válido e que o usuário ainda existe.
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: claims, error: claimsError } = await admin.auth.getClaims(token);
  if (claimsError || !claims) return null;
  if (claims.claims.sub !== data.user.id) return null;

  const amr = (claims.claims as { amr?: Array<{ method?: string; timestamp?: number }> }).amr;
  const stamps = (Array.isArray(amr) ? amr : [])
    .filter((a) => a.method === 'password' && typeof a.timestamp === 'number')
    .map((a) => a.timestamp as number);
  return {
    userId: data.user.id,
    passwordAuthAt: stamps.length > 0 ? Math.max(...stamps) : null,
  };
}

Deno.serve((req) =>
  handleDeleteAccount(req, {
    verify,
    async deleteUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(`deleteUser: ${error.code ?? error.status}`);
    },
    now: () => new Date(),
  }),
);
