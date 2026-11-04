import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, setViewportWidth } from '@/test/render';
import { createFakeSupabase, makeSession } from '@/test/fakeSupabase';
import { AppShell } from './AppShell';

const routes = [{ element: <AppShell />, children: [{ path: '*', element: <h1>Conteúdo</h1> }] }];

describe('SideRail: avatar', () => {
  it('mostra a inicial do nome do perfil, não a do e-mail', async () => {
    setViewportWidth(1280);
    const supabase = createFakeSupabase({
      session: makeSession('demo@example.com'),
      tables: { profiles: [{ id: 'user-1', display_name: 'Ana Paula' }] },
    });
    renderWithProviders(null, { routes, supabase });
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Minha conta' })).toHaveTextContent('A'),
    );
  });

  it('sem nome no perfil usa a inicial do e-mail', async () => {
    setViewportWidth(1280);
    const supabase = createFakeSupabase({
      session: makeSession('beto@example.com'),
      tables: { profiles: [{ id: 'user-1', display_name: '' }] },
    });
    renderWithProviders(null, { routes, supabase });
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Minha conta' })).toHaveTextContent('B'),
    );
  });
});
