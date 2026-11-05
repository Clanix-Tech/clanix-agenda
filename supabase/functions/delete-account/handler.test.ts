import { describe, expect, it, vi } from 'vitest';
import { handleDeleteAccount, type DeleteAccountDeps } from './handler.ts';

const NOW = new Date('2026-11-05T12:00:00Z');
const nowSec = Math.floor(NOW.getTime() / 1000);

function setup(overrides: Partial<DeleteAccountDeps> = {}) {
  const deleteUser = vi.fn<DeleteAccountDeps['deleteUser']>(async () => {});
  const deps: DeleteAccountDeps = {
    verify: async () => ({ userId: 'user-do-token', passwordAuthAt: nowSec - 10 }),
    deleteUser,
    now: () => NOW,
    ...overrides,
  };
  return { deps, deleteUser };
}

function request(headers: Record<string, string> = { Authorization: 'Bearer tok' }, body = '{}') {
  return new Request('http://x/delete-account', { method: 'POST', headers, body });
}

describe('handleDeleteAccount', () => {
  it('sem token → 401', async () => {
    const { deps, deleteUser } = setup();
    const res = await handleDeleteAccount(request({}), deps);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'nao_autenticado' });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('token que o Auth não reconhece → 401', async () => {
    const { deps, deleteUser } = setup({ verify: async () => null });
    const res = await handleDeleteAccount(request(), deps);
    expect(res.status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('senha há 301 s → 403 e nada é apagado', async () => {
    const { deps, deleteUser } = setup({
      verify: async () => ({ userId: 'u', passwordAuthAt: nowSec - 301 }),
    });
    const res = await handleDeleteAccount(request(), deps);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'reautenticacao_necessaria' });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('sem entrada de senha no amr → 403', async () => {
    const { deps, deleteUser } = setup({
      verify: async () => ({ userId: 'u', passwordAuthAt: null }),
    });
    const res = await handleDeleteAccount(request(), deps);
    expect(res.status).toBe(403);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('senha há 10 s → 204 e apaga o id do token, ignorando user_id do corpo', async () => {
    const { deps, deleteUser } = setup();
    const res = await handleDeleteAccount(
      request({ Authorization: 'Bearer tok' }, JSON.stringify({ user_id: 'outra-pessoa' })),
      deps,
    );
    expect(res.status).toBe(204);
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith('user-do-token');
  });

  it('deleteUser lança → 500 sem detalhes', async () => {
    const { deps } = setup({
      deleteUser: async () => {
        throw new Error('detalhe interno com ana@example.com');
      },
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleDeleteAccount(request(), deps);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'falha_ao_excluir' });
    expect(text).not.toContain('ana@');
    expect(spy.mock.calls.flat().join(' ')).not.toContain('ana@');
    spy.mockRestore();
  });

  it('GET → 405; OPTIONS → CORS', async () => {
    const { deps } = setup();
    expect(
      (await handleDeleteAccount(new Request('http://x', { method: 'GET' }), deps)).status,
    ).toBe(405);
    const pre = await handleDeleteAccount(new Request('http://x', { method: 'OPTIONS' }), deps);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
