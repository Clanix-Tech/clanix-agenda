import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { createFakeSupabase, makeSession } from '@/test/fakeSupabase';
import ResetPassword from './ResetPassword';

const routes = [
  { path: '/redefinir-senha', element: <ResetPassword /> },
  { path: '/', element: <h1>Início</h1> },
];

async function fill(nova: string, conf: string) {
  await userEvent.type(await screen.findByLabelText('Nova senha'), nova);
  await userEvent.type(screen.getByLabelText('Confirmar senha'), conf);
  await userEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
}

describe('ResetPassword', () => {
  it('sem sessão mostra link expirado com atalho para pedir outro', async () => {
    renderWithProviders(null, { routes, route: '/redefinir-senha' });
    expect(
      await screen.findByText('Este link expirou ou já foi usado. Peça um novo.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedir novo link' })).toHaveAttribute(
      'href',
      '/recuperar-senha',
    );
  });

  it('com sessão de recuperação troca a senha e vai para /', async () => {
    const supabase = createFakeSupabase({ session: makeSession() });
    const spy = vi.spyOn(supabase.auth, 'updateUser');
    const { router } = renderWithProviders(null, {
      routes,
      route: '/redefinir-senha',
      supabase,
    });
    expect(await screen.findByLabelText('Nova senha')).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
    await fill('novasenha123', 'novasenha123');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ password: 'novasenha123' });
  });

  it('confirmação diferente não chama o servidor', async () => {
    const supabase = createFakeSupabase({ session: makeSession() });
    const spy = vi.spyOn(supabase.auth, 'updateUser');
    renderWithProviders(null, { routes, route: '/redefinir-senha', supabase });
    await fill('novasenha123', 'outra12345');
    expect(await screen.findByText('As senhas não são iguais.')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('erro de senha fraca do servidor é mostrado', async () => {
    const supabase = createFakeSupabase({
      session: makeSession(),
      auth: {
        updateUser: () => ({
          error: {
            name: 'AuthWeakPasswordError',
            status: 422,
            code: 'weak_password',
            message: 'x',
          },
        }),
      },
    });
    renderWithProviders(null, { routes, route: '/redefinir-senha', supabase });
    await fill('novasenha123', 'novasenha123');
    expect(
      await screen.findByText('A senha precisa ter pelo menos 8 caracteres.'),
    ).toBeInTheDocument();
  });

  it('sessão de recuperação que chega depois não mostra "expirou" no meio', async () => {
    const session = makeSession();
    type SessionResult = Awaited<
      ReturnType<ReturnType<typeof createFakeSupabase>['auth']['getSession']>
    >;
    let resolve: (v: SessionResult) => void = () => {};
    const supabase = createFakeSupabase();
    supabase.auth.getSession = () =>
      new Promise<SessionResult>((r) => {
        resolve = r;
      });
    renderWithProviders(null, { routes, route: '/redefinir-senha', supabase });
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…');
    expect(screen.queryByText(/Este link expirou/)).not.toBeInTheDocument();
    await act(async () => {
      resolve({ data: { session }, error: null });
    });
    expect(await screen.findByLabelText('Nova senha')).toBeInTheDocument();
    expect(screen.queryByText(/Este link expirou/)).not.toBeInTheDocument();
  });
});
