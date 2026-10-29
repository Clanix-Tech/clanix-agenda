import { describe, expect, it } from 'vitest';
import { createTestUser, nextMondayAt, setDefaultHours } from './helpers.ts';

describe('concorrência via API', () => {
  it('RN08: 10 reservas simultâneas do mesmo horário resultam em exatamente 1 sucesso', async () => {
    const { client } = await createTestUser(`conc-${crypto.randomUUID()}@teste.local`);
    await setDefaultHours(client);
    const args = {
      p_client_name: 'Ana',
      p_service_name: 'Manicure',
      p_starts_at: nextMondayAt('14:00'),
      p_ends_at: nextMondayAt('15:00'),
    };
    const results = await Promise.all(
      Array.from({ length: 10 }, () => client.rpc('create_appointment', args)),
    );
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    expect(results.filter((r) => r.error?.code === 'AE001')).toHaveLength(9);
  });

  it('RN08: duas remarcações simultâneas para o mesmo horário livre resultam em 1 sucesso', async () => {
    const { client } = await createTestUser(`conc-${crypto.randomUUID()}@teste.local`);
    await setDefaultHours(client);
    const create = async (start: string, end: string) => {
      const { data, error } = await client.rpc('create_appointment', {
        p_client_name: 'Bia',
        p_service_name: 'Corte',
        p_starts_at: nextMondayAt(start),
        p_ends_at: nextMondayAt(end),
      });
      expect(error).toBeNull();
      if (!data) throw new Error('agendamento não criado');
      return data;
    };
    const x = await create('09:00', '10:00');
    const y = await create('10:00', '11:00');

    const target = { p_starts_at: nextMondayAt('14:00'), p_ends_at: nextMondayAt('15:00') };
    const results = await Promise.all([
      client.rpc('reschedule_appointment', { p_id: x.id, ...target }),
      client.rpc('reschedule_appointment', { p_id: y.id, ...target }),
    ]);

    expect(results.filter((r) => !r.error)).toHaveLength(1);
    const failedIndex = results.findIndex((r) => r.error);
    expect(results[failedIndex]?.error?.code).toBe('AE001');

    const failed = [x, y][failedIndex];
    if (!failed) throw new Error('índice inválido');
    const { data: rows, error } = await client.from('appointments').select().eq('id', failed.id);
    expect(error).toBeNull();
    const row = rows?.[0];
    expect(row).toBeDefined();
    expect(new Date(row?.starts_at ?? '').getTime()).toBe(new Date(failed.starts_at).getTime());
    expect(new Date(row?.ends_at ?? '').getTime()).toBe(new Date(failed.ends_at).getTime());
  });
});
