import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { RequireAuth } from './RequireAuth';
import { useAuth } from './AuthProvider';
import Login from './pages/Login';

const MESSAGE = 'Sua sessão expirou. Entre novamente.';

function SignOutButton() {
  const { signOut } = useAuth();
  return <button onClick={() => void signOut()}>Sair</button>;
}

function routesFor(hasBusinessHours?: boolean) {
  return [
    { path: '/entrar', element: <Login /> },
    {
      element: <RequireAuth hasBusinessHours={hasBusinessHours} />,
      children: [
        {
          path: '/',
          element: (
            <>
              <h1>Início</h1>
              <SignOutButton />
            </>
          ),
        },
        { path: '/agenda', element: <h1>Agenda</h1> },
        { path: '/primeiro-acesso', element: <h1>Quando você atende?</h1> },
      ],
    },
  ];
}

async function expire(queryClient: ReturnType<typeof renderWithProviders>['queryClient']) {
  await queryClient
    .fetchQuery({
      queryKey: ['x'],
      queryFn: () => {
        throw { code: '42501', message: 'permission denied' };
      },
    })
    .catch(() => {});
}

describe('RequireAuth', () => {
  it('sem sessão vai para Entrar, sem aviso de expiração', async () => {
    renderWithProviders(null, { routes: routesFor(), route: '/' });
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
  });

  it('com sessão e sem expediente vai para o primeiro acesso', async () => {
    renderWithProviders(null, { routes: routesFor(false), route: '/', session: true });
    expect(await screen.findByRole('heading', { name: 'Quando você atende?' })).toBeInTheDocument();
  });

  it('com sessão e expediente mostra a página protegida', async () => {
    renderWithProviders(null, { routes: routesFor(true), route: '/', session: true });
    expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument();
  });

  it('Review Focus 5: 42501 leva a Entrar com o aviso, preserva `from` e sai só neste aparelho', async () => {
    const { queryClient, supabase, router } = renderWithProviders(null, {
      routes: routesFor(true),
      route: '/agenda',
      session: true,
    });
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
    await expire(queryClient);
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByText(MESSAGE)).toBeInTheDocument();
    const state = router.state.location.state as { from: { pathname: string }; reason: string };
    expect(state.reason).toBe('sessao');
    expect(state.from.pathname).toBe('/agenda');
    expect(supabase.calls.signOut).toEqual([{ scope: 'local' }]);

    // depois de entrar de novo, volta para a rota de origem
    await act(async () => {
      await supabase.auth.signInWithPassword({ email: 'a@b.c', password: 'x' });
      await router.navigate(state.from.pathname);
    });
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
  });

  it('vários erros 42501 seguidos encerram a sessão uma única vez', async () => {
    const { queryClient, supabase } = renderWithProviders(null, {
      routes: routesFor(true),
      route: '/',
      session: true,
    });
    await screen.findByRole('heading', { name: 'Início' });
    await Promise.all([expire(queryClient), expire(queryClient)]);
    await screen.findByText(MESSAGE);
    expect(supabase.calls.signOut).toHaveLength(1);
  });

  it('SIGNED_OUT emitido pelo supabase sem pedido nosso mostra o aviso', async () => {
    const { supabase } = renderWithProviders(null, {
      routes: routesFor(true),
      route: '/',
      session: true,
    });
    await screen.findByRole('heading', { name: 'Início' });
    act(() => supabase.simulateExternalSignOut());
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByText(MESSAGE)).toBeInTheDocument();
  });

  it('saída pedida pelo usuário não mostra o aviso', async () => {
    renderWithProviders(null, { routes: routesFor(true), route: '/', session: true });
    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
  });

  it('ao sair (qualquer motivo) o cache de consultas é limpo', async () => {
    const { queryClient } = renderWithProviders(null, {
      routes: routesFor(true),
      route: '/',
      session: true,
    });
    queryClient.setQueryData(['dados-da-conta-1'], { nome: 'Ana' });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }));
    await screen.findByRole('heading', { name: 'Entrar' });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
