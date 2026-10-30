import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { RequireAuth } from './RequireAuth';
import Login from './pages/Login';

function routesFor(hasBusinessHours?: boolean) {
  return [
    { path: '/entrar', element: <Login /> },
    {
      element: <RequireAuth hasBusinessHours={hasBusinessHours} />,
      children: [
        { path: '/', element: <h1>Início</h1> },
        { path: '/primeiro-acesso', element: <h1>Quando você atende?</h1> },
      ],
    },
  ];
}

describe('RequireAuth', () => {
  it('sem sessão vai para Entrar', async () => {
    renderWithProviders(null, { routes: routesFor(), route: '/' });
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('com sessão e sem expediente vai para o primeiro acesso', async () => {
    renderWithProviders(null, { routes: routesFor(false), route: '/', session: true });
    expect(await screen.findByRole('heading', { name: 'Quando você atende?' })).toBeInTheDocument();
  });

  it('com sessão e expediente mostra a página protegida', async () => {
    renderWithProviders(null, { routes: routesFor(true), route: '/', session: true });
    expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument();
  });

  it('Review Focus 5: erro 42501 volta para Entrar com aviso de sessão expirada', async () => {
    const { queryClient, supabase } = renderWithProviders(null, {
      routes: routesFor(true),
      route: '/',
      session: true,
    });
    expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument();
    await queryClient
      .fetchQuery({
        queryKey: ['x'],
        queryFn: () => {
          throw { code: '42501', message: 'permission denied' };
        },
      })
      .catch(() => {});
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByText('Sua sessão expirou. Entre novamente.')).toBeInTheDocument();
    await waitFor(async () => {
      const { data } = await supabase.auth.getSession();
      expect(data.session).toBeNull();
    });
  });
});
