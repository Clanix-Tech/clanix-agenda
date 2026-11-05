import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { createFakeSupabase, makeSession } from '@/test/fakeSupabase';
import { DeleteAccountError, deleteAccount } from './deleteAccount';

const INPUT = { email: 'ana@example.com', password: 'segredo123', captchaToken: null };
const invalid = { name: 'AuthApiError', status: 400, code: 'invalid_credentials', message: 'x' };
const fetchError = { name: 'FunctionsFetchError', message: 'Failed to send a request' };

function setup(opts: Parameters<typeof createFakeSupabase>[0] = {}) {
  const fake = createFakeSupabase({ session: makeSession(), ...opts });
  renderWithProviders(null, { supabase: fake });
  return fake;
}

async function kindOf(promise: Promise<void>) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DeleteAccountError);
  return (err as DeleteAccountError).kind;
}

describe('deleteAccount', () => {
  it('senha errada → "senha" e a função não é chamada', async () => {
    const fake = setup({ auth: { signInWithPassword: () => ({ error: invalid }) } });
    expect(await kindOf(deleteAccount(INPUT))).toBe('senha');
    expect(fake.calls.functions).toHaveLength(0);
  });

  it('senha "incorreta" porque a conta já foi apagada (resposta perdida e nova tentativa) → considera excluído', async () => {
    const fake = setup({
      auth: {
        signInWithPassword: () => ({ error: invalid }),
        getUser: () => ({ error: { status: 403, code: 'user_not_found', message: 'x' } }),
      },
    });
    await expect(deleteAccount(INPUT)).resolves.toBeUndefined();
    expect(fake.calls.functions).toHaveLength(0);
  });

  it('senha incorreta e a sessão atual ainda é válida → "senha"', async () => {
    setup({
      auth: {
        signInWithPassword: () => ({ error: invalid }),
        getUser: () => ({ data: { user: makeSession().user } }),
      },
    });
    expect(await kindOf(deleteAccount(INPUT))).toBe('senha');
  });

  it('senha incorreta e o getUser falha por rede → "senha" (nunca "excluído")', async () => {
    setup({
      auth: {
        signInWithPassword: () => ({ error: invalid }),
        getUser: () => ({ error: { name: 'AuthRetryableFetchError', status: 0, message: 'x' } }),
      },
    });
    expect(await kindOf(deleteAccount(INPUT))).toBe('senha');
  });

  it('CAPTCHA recusado na nova entrada → "captcha"', async () => {
    const fake = setup({
      auth: {
        signInWithPassword: () => ({
          error: { name: 'AuthApiError', status: 400, code: 'captcha_failed', message: 'x' },
        }),
      },
    });
    expect(await kindOf(deleteAccount(INPUT))).toBe('captcha');
    expect(fake.calls.functions).toHaveLength(0);
  });

  it('sucesso: entra com a senha (e o token do CAPTCHA) e chama a função por POST', async () => {
    let signInArgs: unknown;
    const fake = setup({
      auth: {
        signInWithPassword: (a) => {
          signInArgs = a;
          return { data: {} };
        },
      },
    });
    await deleteAccount({ ...INPUT, captchaToken: 'cap' });
    expect(signInArgs).toMatchObject({ email: INPUT.email, options: { captchaToken: 'cap' } });
    expect(fake.calls.functions).toEqual([{ name: 'delete-account', options: { method: 'POST' } }]);
  });

  it('rede falha e o Auth diz que o usuário não existe → considera excluído', async () => {
    setup({
      functions: { 'delete-account': () => ({ error: fetchError }) },
      auth: { getUser: () => ({ error: { status: 403, code: 'user_not_found', message: 'x' } }) },
    });
    await expect(deleteAccount(INPUT)).resolves.toBeUndefined();
  });

  it('rede falha e o usuário ainda existe → "rede"', async () => {
    setup({ functions: { 'delete-account': () => ({ error: fetchError }) } });
    expect(await kindOf(deleteAccount(INPUT))).toBe('rede');
  });

  it.each([
    [
      'AuthRetryableFetchError (sem rede)',
      { name: 'AuthRetryableFetchError', status: 0, message: 'x' },
    ],
    ['AuthSessionMissingError', { name: 'AuthSessionMissingError', status: 400, message: 'x' }],
  ])(
    'rede falha e getUser também falha (%s) → "rede", nunca "excluído"',
    async (_n, getUserError) => {
      setup({
        functions: { 'delete-account': () => ({ error: fetchError }) },
        auth: { getUser: () => ({ error: getUserError }) },
      });
      expect(await kindOf(deleteAccount(INPUT))).toBe('rede');
    },
  );

  it('rede falha e o Auth responde 403 "does not exist" → considera excluído', async () => {
    setup({
      functions: { 'delete-account': () => ({ error: fetchError }) },
      auth: {
        getUser: () => ({
          error: { status: 403, message: 'User from sub claim in JWT does not exist' },
        }),
      },
    });
    await expect(deleteAccount(INPUT)).resolves.toBeUndefined();
  });

  it('a função responde 500 → "falha" (sem consultar o Auth)', async () => {
    setup({
      functions: {
        'delete-account': () => ({
          error: { name: 'FunctionsHttpError', context: { status: 500 } },
        }),
      },
    });
    expect(await kindOf(deleteAccount(INPUT))).toBe('falha');
  });

  it('sem conexão já na entrada → "rede"', async () => {
    setup({
      auth: {
        signInWithPassword: () => ({ error: { name: 'AuthRetryableFetchError', message: 'x' } }),
      },
    });
    expect(await kindOf(deleteAccount(INPUT))).toBe('rede');
  });
});
