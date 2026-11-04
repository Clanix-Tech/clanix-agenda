// Edge Function send-reminders na pilha local (pré-requisitos: `npm run vapid:gerar`,
// pilha reiniciada depois disso e, para o cron, `npm run lembretes:local`).
import { createECDH, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/types/database.ts';
import { createTestUser, getLocalEnv } from './helpers.ts';

const CLIENT_NAME = 'Cliente Sigilosa da Silva';

function cronSecret(): string {
  const path = fileURLToPath(new URL('../../supabase/functions/.env', import.meta.url));
  if (!existsSync(path)) throw new Error('Rode `npm run vapid:gerar` e reinicie a pilha local.');
  const secret = /^CRON_SECRET=(.+)$/m.exec(readFileSync(path, 'utf8'))?.[1]?.trim();
  if (!secret) throw new Error('CRON_SECRET ausente em supabase/functions/.env.');
  return secret;
}

function functionUrl(): string {
  return `${getLocalEnv().url}/functions/v1/send-reminders`;
}

function invoke(secret?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret !== undefined) headers['x-cron-secret'] = secret;
  return fetch(functionUrl(), { method: 'POST', headers, body: '{}' });
}

/** O pg_cron também chama a função no início de cada minuto; evita disputar a reserva com ele. */
async function awayFromCronTick(): Promise<void> {
  const second = new Date().getUTCSeconds();
  if (second >= 15 && second < 50) return;
  const wait = second >= 50 ? (75 - second) * 1000 : (15 - second) * 1000;
  await new Promise((resolve) => setTimeout(resolve, wait));
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

describe('Edge Function send-reminders (pilha local)', () => {
  const admin = createClient<Database>(getLocalEnv().url, getLocalEnv().serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let userId: string | undefined;

  beforeAll(() => {
    cronSecret();
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it('sem o header x-cron-secret → 401', async () => {
    const res = await invoke();
    expect(res.status).toBe(401);
  });

  it('com segredo errado → 401', async () => {
    const res = await invoke(`${cronSecret()}x`);
    expect(res.status).toBe(401);
  });

  it('com o segredo e nada devido → 200 { due: 0 }', async () => {
    await awayFromCronTick();
    const res = await invoke(cronSecret());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ due: 0, sent: 0, removed: 0, failed: 0 });
  });

  it('lembrete devido e aparelho inalcançável → falha temporária e reserva liberada', async () => {
    const user = await createTestUser(`lembrete-${crypto.randomUUID()}@exemplo.com`);
    userId = user.id;

    const profile = await admin.from('profiles').update({ reminder_minutes: 15 }).eq('id', user.id);
    expect(profile.error).toBeNull();

    const startsAt = new Date(Math.ceil(Date.now() / 60_000) * 60_000 + 10 * 60_000);
    const appointment = await admin
      .from('appointments')
      .insert({
        owner_id: user.id,
        client_name: CLIENT_NAME,
        service_name: 'Corte',
        starts_at: startsAt.toISOString(),
        ends_at: new Date(startsAt.getTime() + 30 * 60_000).toISOString(),
        reminder_anchor_at: new Date(Date.now() - 60 * 60_000).toISOString(),
      })
      .select('id, starts_at')
      .single();
    expect(appointment.error).toBeNull();
    const { id, starts_at } = appointment.data!;

    const subscription = await admin.from('push_subscriptions').insert({
      owner_id: user.id,
      endpoint: `https://push.invalid/${crypto.randomUUID()}`,
      ...subscriptionKeys(),
    });
    expect(subscription.error).toBeNull();

    await awayFromCronTick();
    const res = await invoke(cronSecret());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ due: 1, sent: 0, removed: 0, failed: 1 });
    expect(text).not.toContain('Sigilosa');

    // Falha temporária (nenhum aparelho recebeu): a reserva foi devolvida.
    const claim = await admin.rpc('claim_reminder', {
      p_appointment_id: id,
      p_starts_at: starts_at,
    });
    expect(claim.error).toBeNull();
    expect(claim.data).toBe(true);
    // O aparelho continua cadastrado: só 404/410 removem.
    const left = await admin.from('push_subscriptions').select('id').eq('owner_id', user.id);
    expect(left.data).toHaveLength(1);
  }, 60_000);
});
