// Edge Function send-test-notification: chamada pelo app (Ajustes › Notificações) com o JWT do
// usuário (`verify_jwt = true`). Só liga as dependências reais; a lógica está em handler.ts.
// Nada de chave secreta aqui: os aparelhos são lidos e apagados com o cliente do usuário, sob RLS.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendPush, type PushTarget } from '../_shared/webpush.ts';
import { handleSendTestNotification, type UserDevices } from './handler.ts';

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

/** Chave publicável nova (`SUPABASE_PUBLISHABLE_KEYS.default`) ou, na falta dela, a anon legada. */
function publishableKey(): string {
  const keys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string | undefined>;
    if (parsed.default) return parsed.default;
  }
  return requireEnv('SUPABASE_ANON_KEY');
}

const supabaseUrl = requireEnv('SUPABASE_URL');
const apiKey = publishableKey();

const vapid = {
  publicKey: requireEnv('VAPID_PUBLIC_KEY'),
  privateKey: requireEnv('VAPID_PRIVATE_KEY'),
  subject: requireEnv('VAPID_SUBJECT'),
};

async function userDevices(authorization: string): Promise<UserDevices | null> {
  const client = createClient(supabaseUrl, apiKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.replace(/^Bearer /, '');
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const ownerId = data.user.id;
  return {
    async list() {
      const { data: rows, error: listError } = await client
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('owner_id', ownerId);
      if (listError) throw new Error(`push_subscriptions: ${listError.code}`);
      return (rows ?? []) as PushTarget[];
    },
    async remove(ids) {
      const { error: deleteError } = await client.from('push_subscriptions').delete().in('id', ids);
      if (deleteError) throw new Error(`push_subscriptions: ${deleteError.code}`);
    },
  };
}

Deno.serve((req) =>
  handleSendTestNotification(req, {
    userDevices,
    send: (target, payload) => sendPush(target, payload, vapid),
  }),
);
