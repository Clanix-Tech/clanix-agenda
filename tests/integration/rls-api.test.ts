import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../src/types/database.ts';
import { createTestUser, getLocalEnv, nextMondayAt, setDefaultHours } from './helpers.ts';

const email = () => `rls-${crypto.randomUUID()}@teste.local`;

async function createAppointmentFor(client: Awaited<ReturnType<typeof createTestUser>>['client']) {
  await setDefaultHours(client);
  const { data, error } = await client.rpc('create_appointment', {
    p_client_name: 'Ana',
    p_service_name: 'Manicure',
    p_starts_at: nextMondayAt('14:00'),
    p_ends_at: nextMondayAt('15:00'),
  });
  expect(error).toBeNull();
  if (!data) throw new Error('agendamento não criado');
  return data;
}

describe('RLS e privilégios via API', () => {
  it('anônimo não lê dados nem executa RPCs', async () => {
    const { url, anonKey } = getLocalEnv();
    const anon = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tables = ['appointments', 'appointment_history'] as const;
    for (const table of tables) {
      const { data, error } = await anon.from(table).select();
      if (error) {
        expect(['42501', '401']).toContain(error.code);
      }
      expect(data ?? []).toHaveLength(0);
    }

    const { data, error } = await anon.rpc('create_appointment', {
      p_client_name: 'Ana',
      p_service_name: 'Manicure',
      p_starts_at: nextMondayAt('14:00'),
      p_ends_at: nextMondayAt('15:00'),
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(['42501', '401']).toContain(error?.code);
  });

  it('usuário B não enxerga nem altera agendamentos do usuário A', async () => {
    const a = await createTestUser(email());
    const b = await createTestUser(email());
    const appt = await createAppointmentFor(a.client);

    const sel = await b.client.from('appointments').select().eq('id', appt.id);
    expect(sel.error).toBeNull();
    expect(sel.data).toEqual([]);

    const cancel = await b.client.rpc('cancel_appointment', { p_id: appt.id });
    expect(cancel.error?.code).toBe('AE006');

    const upd = await b.client.from('appointments').update({ client_name: 'X' }).eq('id', appt.id);
    expect(upd.error).not.toBeNull();

    const del = await b.client.from('appointment_history').delete().eq('appointment_id', appt.id);
    expect(del.error).not.toBeNull();

    // o dono continua vendo o registro intacto
    const own = await a.client.from('appointments').select().eq('id', appt.id);
    expect(own.data?.[0]?.client_name).toBe('Ana');
    expect(own.data?.[0]?.status).toBe('agendado');
  });

  it('escrita direta em appointments é negada mesmo para o dono (só via RPC)', async () => {
    const a = await createTestUser(email());
    const { error } = await a.client.from('appointments').insert({
      owner_id: a.id,
      client_name: 'Ana',
      service_name: 'Manicure',
      starts_at: nextMondayAt('14:00'),
      ends_at: nextMondayAt('15:00'),
    });
    expect(error).not.toBeNull();
  });
});
