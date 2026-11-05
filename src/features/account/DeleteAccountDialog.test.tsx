import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { createFakeSupabase, makeSession } from '@/test/fakeSupabase';
import { DeleteAccountDialog } from './DeleteAccountDialog';

const captcha = vi.hoisted(() => ({
  value: { required: false, token: null, error: null, reset: () => {}, element: null } as {
    required: boolean;
    token: string | null;
    error: string | null;
    reset: () => void;
    element: unknown;
  },
}));
vi.mock('@/features/auth/captcha/useCaptcha', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/captcha/useCaptcha')>()),
  useCaptcha: () => captcha.value,
}));

beforeEach(() => {
  captcha.value = { required: false, token: null, error: null, reset: () => {}, element: null };
});

const routes = [
  { path: '/ajustes', element: <DeleteAccountDialog open onOpenChange={() => {}} /> },
  { path: '/entrar', element: <h1>Entrar</h1> },
];

function setup(opts: Parameters<typeof createFakeSupabase>[0] = {}) {
  const fake = createFakeSupabase({ session: makeSession('ana@example.com'), ...opts });
  renderWithProviders(null, { routes, route: '/ajustes', supabase: fake, session: true });
  return fake;
}

const invalid = { name: 'AuthApiError', status: 400, code: 'invalid_credentials', message: 'x' };

async function confirm(password = 'segredo123') {
  await userEvent.type(await screen.findByLabelText('Senha atual'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Excluir para sempre' }));
}

describe('DeleteAccountDialog', () => {
  it('sucesso: apaga, sai e vai para a tela de entrada', async () => {
    const fake = setup();
    await confirm();
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(fake.calls.functions.map((f) => f.name)).toEqual(['delete-account']);
    expect(fake.calls.signOut).toHaveLength(1);
  });

  it('senha incorreta', async () => {
    const fake = setup({ auth: { signInWithPassword: () => ({ error: invalid }) } });
    await confirm();
    expect(await screen.findByRole('alert')).toHaveTextContent('Senha incorreta.');
    expect(fake.calls.functions).toHaveLength(0);
    expect(fake.calls.signOut).toHaveLength(0);
  });

  it('a conta já tinha sido apagada (nova tentativa diz "senha incorreta") → sai e vai para a entrada', async () => {
    const fake = setup({
      auth: {
        signInWithPassword: () => ({ error: invalid }),
        getUser: () => ({ error: { status: 403, code: 'user_not_found', message: 'x' } }),
      },
    });
    await confirm();
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(fake.calls.signOut).toHaveLength(1);
  });

  it('CAPTCHA recusado mostra a mensagem do CAPTCHA', async () => {
    setup({
      auth: {
        signInWithPassword: () => ({
          error: { name: 'AuthApiError', status: 400, code: 'captcha_failed', message: 'x' },
        }),
      },
    });
    await confirm();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível confirmar que você não é um robô. Tente de novo.',
    );
  });

  it('sem conexão', async () => {
    setup({
      functions: {
        'delete-account': () => ({
          error: { name: 'FunctionsFetchError', message: 'Failed to send a request' },
        }),
      },
    });
    await confirm();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sem conexão. Confira a internet e tente de novo.',
    );
  });

  it('falha do servidor', async () => {
    setup({
      functions: {
        'delete-account': () => ({
          error: { name: 'FunctionsHttpError', context: { status: 500 } },
        }),
      },
    });
    await confirm();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível excluir a conta agora. Tente de novo em alguns minutos.',
    );
  });

  it('desabilita o envio enquanto processa', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const fake = setup();
    const original = fake.auth.signInWithPassword.bind(fake.auth);
    fake.auth.signInWithPassword = (a) => gate.then(() => original(a)) as never;
    await confirm();
    expect(screen.getByRole('button', { name: 'Excluindo…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    release();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument(),
    );
  });

  it('com CAPTCHA exigido e sem token, o botão fica desabilitado', async () => {
    captcha.value = { ...captcha.value, required: true };
    setup();
    expect(await screen.findByRole('button', { name: 'Excluir para sempre' })).toBeDisabled();
  });
});
