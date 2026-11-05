// Edge Function delete-account na pilha local (reiniciar a pilha depois de mudar supabase/functions).
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/types/database.ts';
import { createTestUser, getLocalEnv, nextMondayAt, setDefaultHours } from './helpers.ts';

type TestUser = Awaited<ReturnType<typeof createTestUser>>;

function invoke(token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  return fetch(`${getLocalEnv().url}/functions/v1/delete-account`, {
    method: 'POST',
    headers,
    body: '{}',
  });
}

async function accessToken(user: TestUser): Promise<string> {
  const { data } = await user.client.auth.getSession();
  if (!data.session) throw new Error('Sessão do usuário de teste sem access_token.');
  return data.session.access_token;
}

/** Timestamp (s) da entrada `password` do amr, lido do payload do JWT. */
function passwordTimestamp(jwt: string): number {
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString()) as {
    amr?: Array<{ method: string; timestamp: number }>;
  };
  const entry = payload.amr?.find((a) => a.method === 'password');
  if (!entry) throw new Error('amr sem entrada de senha');
  return entry.timestamp;
}

async function seed(user: TestUser) {
  await setDefaultHours(user.client);
  const appt = await user.client.rpc('create_appointment', {
    p_client_name: 'Cliente Seed',
    p_service_name: 'Manicure',
    p_starts_at: nextMondayAt('14:00'),
    p_ends_at: nextMondayAt('15:00'),
  });
  expect(appt.error).toBeNull();
  const sub = await user.client.rpc('register_push_subscription', {
    p_endpoint: `https://push.invalid/${crypto.randomUUID()}`,
    p_p256dh: 'p',
    p_auth: 'a',
    p_device_label: 'Teste',
  });
  expect(sub.error).toBeNull();
}

describe('Edge Function delete-account (pilha local)', () => {
  const { url, serviceRoleKey } = getLocalEnv();
  const admin = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const users: string[] = [];

  afterAll(async () => {
    for (const id of users) await admin.auth.admin.deleteUser(id);
  });

  async function rows(ownerId: string) {
    const count = async (table: 'appointments' | 'push_subscriptions' | 'appointment_history') => {
      const { count: n, error } = await admin
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', ownerId);
      expect(error).toBeNull();
      return n ?? 0;
    };
    const profile = await admin.from('profiles').select('id').eq('id', ownerId);
    return {
      profiles: profile.data?.length ?? 0,
      appointments: await count('appointments'),
      subscriptions: await count('push_subscriptions'),
      history: await count('appointment_history'),
    };
  }

  it('sem token ou com a chave anônima → 401', async () => {
    expect((await invoke()).status).toBe(401);
    expect((await invoke(getLocalEnv().anonKey)).status).toBe(401);
  });

  it('apaga só a conta de quem chama e tudo que é dela', async () => {
    const a = await createTestUser(`excluir-a-${crypto.randomUUID()}@exemplo.com`);
    const b = await createTestUser(`excluir-b-${crypto.randomUUID()}@exemplo.com`);
    users.push(a.id, b.id);
    await seed(a);
    await seed(b);
    const beforeB = await rows(b.id);
    expect(beforeB.appointments).toBe(1);
    expect(beforeB.subscriptions).toBe(1);

    const res = await invoke(await accessToken(a));
    expect(res.status).toBe(204);

    const gone = await admin.auth.admin.getUserById(a.id);
    expect(gone.data.user).toBeNull();
    expect(await rows(a.id)).toEqual({
      profiles: 0,
      appointments: 0,
      subscriptions: 0,
      history: 0,
    });

    expect(await admin.auth.admin.getUserById(b.id).then((r) => r.data.user?.id)).toBe(b.id);
    expect(await rows(b.id)).toEqual(beforeB);
  }, 60_000);

  it('renovar o token não renova o timestamp da senha (amr)', async () => {
    const b = await createTestUser(`excluir-refresh-${crypto.randomUUID()}@exemplo.com`);
    users.push(b.id);
    const before = passwordTimestamp(await accessToken(b));
    await new Promise((r) => setTimeout(r, 1500));
    const refreshed = await b.client.auth.refreshSession();
    expect(refreshed.error).toBeNull();
    const after = passwordTimestamp(refreshed.data.session!.access_token);
    expect(after).toBe(before);
  }, 30_000);
});
