import { useState } from 'react';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { createFakeSupabase, makeSession } from '@/test/fakeSupabase';
import type { TurnstileApi, TurnstileRenderOptions } from '@/features/auth/captcha/turnstile';
import { DeleteAccountDialog } from './DeleteAccountDialog';

// Usa o useCaptcha DE VERDADE: só a chave do Turnstile e o carregador do script são trocados.
vi.mock('@/lib/env', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/env')>();
  return { ...mod, getEnv: () => ({ ...mod.getEnv(), turnstileSiteKey: 'site-key' }) };
});

const loader = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/features/auth/captcha/turnstile', () => ({ loadTurnstile: () => loader.load() }));

function fakeTurnstile() {
  const opts: TurnstileRenderOptions[] = [];
  const containers: HTMLElement[] = [];
  const api = {
    render: vi.fn((c: HTMLElement, o: TurnstileRenderOptions) => {
      containers.push(c);
      opts.push(o);
      return `w${opts.length}`;
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  } satisfies TurnstileApi;
  return { api, opts, containers };
}

function Host() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <DeleteAccountDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

let turnstile: ReturnType<typeof fakeTurnstile>;

beforeEach(() => {
  turnstile = fakeTurnstile();
  window.turnstile = turnstile.api;
  loader.load.mockReset();
  loader.load.mockImplementation(() => Promise.resolve(window.turnstile!));
});

afterEach(() => {
  delete window.turnstile;
});

function setup() {
  const fake = createFakeSupabase({ session: makeSession('ana@example.com') });
  renderWithProviders(null, {
    routes: [
      { path: '/ajustes', element: <Host /> },
      { path: '/entrar', element: <h1>Entrar</h1> },
    ],
    route: '/ajustes',
    supabase: fake,
    session: true,
  });
  return fake;
}

describe('DeleteAccountDialog com o CAPTCHA real', () => {
  it('abrir o diálogo depois de o script já ter carregado renderiza o widget e libera o botão', async () => {
    const fake = setup();
    // Dá tempo de qualquer carregamento feito com o diálogo fechado terminar.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Abrir' }));
    const submit = await screen.findByRole('button', { name: 'Excluir para sempre' });
    expect(submit).toBeDisabled();
    expect(screen.getByText('Conclua a verificação de segurança acima.')).toBeInTheDocument();

    await vi.waitFor(() => expect(turnstile.api.render).toHaveBeenCalledTimes(1));
    expect(turnstile.opts[0]).toMatchObject({ sitekey: 'site-key', action: 'excluir-conta' });
    expect(turnstile.containers[0]!.isConnected).toBe(true);

    act(() => turnstile.opts[0]!.callback!('tok'));
    expect(submit).toBeEnabled();
    expect(screen.queryByText('Conclua a verificação de segurança acima.')).not.toBeInTheDocument();

    let signInArgs: unknown;
    const original = fake.auth.signInWithPassword.bind(fake.auth);
    fake.auth.signInWithPassword = (a) => {
      signInArgs = a;
      return original(a);
    };
    await userEvent.type(screen.getByLabelText('Senha atual'), 'segredo123');
    await userEvent.click(submit);
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(signInArgs).toMatchObject({ options: { captchaToken: 'tok' } });
  });

  it('fechar o diálogo remove o widget e reabrir começa uma verificação nova', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir' }));
    await vi.waitFor(() => expect(turnstile.api.render).toHaveBeenCalledTimes(1));
    act(() => turnstile.opts[0]!.callback!('tok'));
    expect(screen.getByRole('button', { name: 'Excluir para sempre' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await vi.waitFor(() => expect(turnstile.api.remove).toHaveBeenCalledWith('w1'));

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    await vi.waitFor(() => expect(turnstile.api.render).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Excluir para sempre' })).toBeDisabled();
  });
});
