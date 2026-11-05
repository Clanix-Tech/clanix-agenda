// Edge Function send-test-notification na pilha local (pré-requisitos: `npm run vapid:gerar` e a
// pilha reiniciada depois disso e depois de qualquer mudança em supabase/functions).
import { createECDH, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/types/database.ts';
import { createTestUser, getLocalEnv } from './helpers.ts';

function functionUrl(): string {
  return `${getLocalEnv().url}/functions/v1/send-test-notification`;
}

function invoke(token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  return fetch(functionUrl(), { method: 'POST', headers, body: '{}' });
}

/** Chaves de uma assinatura Web Push válidas (P-256 + 16 bytes), para o envio chegar à rede. */
function subscriptionKeys(): { p256dh: string; auth: string } {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    p256dh: ecdh.getPublicKey().toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  };
}

async function accessToken(client: Awaited<ReturnType<typeof createTestUser>>['client']) {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão do usuário de teste sem access_token.');
  return token;
}

describe('Edge Function send-test-notification (pilha local)', () => {
  const admin = createClient<Database>(getLocalEnv().url, getLocalEnv().serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const users: string[] = [];

  afterAll(async () => {
    for (const id of users) await admin.auth.admin.deleteUser(id);
  });

  it('sem JWT → 401', async () => {
    const res = await invoke();
    expect(res.status).toBe(401);
  });

  it('com a chave anônima (não é um usuário) → 401', async () => {
    const res = await invoke(getLocalEnv().anonKey);
    expect(res.status).toBe(401);
  });

  it('preflight OPTIONS responde com CORS', async () => {
    const res = await fetch(functionUrl(), {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
    });
    expect(res.ok).toBe(true);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    await res.body?.cancel();
  });

  it('com o JWT do usuário → 200 { sent, removed } só com os aparelhos dele', async () => {
    const owner = await createTestUser(`teste-push-${crypto.randomUUID()}@exemplo.com`);
    const other = await createTestUser(`teste-push-outro-${crypto.randomUUID()}@exemplo.com`);
    users.push(owner.id, other.id);

    const mine = await owner.client.rpc('register_push_subscription', {
      p_endpoint: `https://push.invalid/${crypto.randomUUID()}`,
      ...prefixed(subscriptionKeys()),
      p_device_label: 'Teste · Integração',
    });
    expect(mine.error).toBeNull();

    const res = await invoke(await accessToken(owner.client));
    expect(res.status).toBe(200);
    // push.invalid não resolve: falha temporária, nada enviado e nada removido.
    expect(await res.json()).toEqual({ sent: 0, removed: 0 });

    // Outro usuário sem aparelhos: nada a enviar (não alcança os aparelhos de ninguém mais).
    const res2 = await invoke(await accessToken(other.client));
    expect(res2.status).toBe(200);
    expect(await res2.json()).toEqual({ sent: 0, removed: 0 });

    const left = await admin.from('push_subscriptions').select('id').eq('owner_id', owner.id);
    expect(left.data).toHaveLength(1);
  }, 60_000);
});

function prefixed(keys: { p256dh: string; auth: string }) {
  return { p_p256dh: keys.p256dh, p_auth: keys.auth };
}
