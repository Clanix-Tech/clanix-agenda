import { createFakeSupabase } from './fakeSupabase';

describe('fakeSupabase', () => {
  it('não compartilha objetos: leituras, escritas e a semente são cópias', async () => {
    const seed = [{ id: 'a', name: 'Ana' }];
    const fake = createFakeSupabase({ tables: { clients: seed } });
    seed[0]!.name = 'mutado fora';

    const first = (await fake.from('clients').select()).data as Array<{ name: string }>;
    expect(first[0]!.name).toBe('Ana');
    first[0]!.name = 'mutado na leitura';
    const second = (await fake.from('clients').select()).data as Array<{ name: string }>;
    expect(second[0]!.name).toBe('Ana');

    const payload = { name: 'Bia' };
    await fake.from('clients').insert(payload);
    payload.name = 'mutado depois';
    const all = (await fake.from('clients').select().order('name')).data as Array<{
      name: string;
    }>;
    expect(all.map((r) => r.name)).toEqual(['Ana', 'Bia']);
  });

  it('insert gera id e created_at quando faltam', async () => {
    const fake = createFakeSupabase();
    const { data } = await fake.from('t').insert({ x: 1 });
    const [row] = data as Array<{ id: string; created_at: string; x: number }>;
    expect(row!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(row!.created_at))).toBe(false);
  });

  it('gte/lt comparam instantes ISO com offsets diferentes', async () => {
    const fake = createFakeSupabase({
      tables: {
        a: [
          { id: 1, at: '2026-11-02T12:00:00-03:00' }, // 15:00Z
          { id: 2, at: '2026-11-02T14:00:00Z' },
        ],
      },
    });
    const { data } = await fake
      .from('a')
      .select()
      .gte('at', '2026-11-02T14:30:00Z')
      .lt('at', '2026-11-02T16:00:00Z');
    expect((data as Array<{ id: number }>).map((r) => r.id)).toEqual([1]);
  });

  it('injeta erro por tabela/operação e por método de auth', async () => {
    const fake = createFakeSupabase({
      errors: { appointments: { insert: { code: 'AE001' } } },
      auth: {
        signInWithPassword: () => ({ error: { status: 400, code: 'invalid_credentials' } }),
      },
    });
    expect(await fake.from('appointments').insert({})).toMatchObject({ error: { code: 'AE001' } });
    expect(await fake.from('appointments').select()).toMatchObject({ error: null });
    const res = await fake.auth.signInWithPassword({ email: 'a@b.c', password: 'x' });
    expect(res.error).toMatchObject({ code: 'invalid_credentials' });
  });
});
