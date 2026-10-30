import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { createFakeSupabase, makeSession, type FakeSupabaseOptions } from '@/test/fakeSupabase';
import { RequireAuth } from '@/features/auth/RequireAuth';
import FirstAccessPage from './FirstAccessPage';

const routes = [
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <h1>Início</h1> },
      { path: '/primeiro-acesso', element: <FirstAccessPage /> },
    ],
  },
];

const row = (weekday: number) => ({
  weekday,
  start_time: '09:00:00',
  end_time: '18:00:00',
});

function setup(rpc?: FakeSupabaseOptions['rpc'], rows: Record<string, unknown>[] = []) {
  const supabase = createFakeSupabase({
    session: makeSession(),
    rpc,
    tables: { business_hours: rows },
  });
  return renderWithProviders(null, { routes, route: '/primeiro-acesso', session: true, supabase });
}

describe('FirstAccessPage', () => {
  it('inicia com Seg–Sex preenchidos e fim de semana Fechado', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Quando você atende?' })).toBeInTheDocument();
    expect(screen.getAllByText('09:00–12:00 · 13:00–18:00')).toHaveLength(5);
    expect(screen.getAllByText('Fechado')).toHaveLength(2);
  });

  it('confirmar envia 10 turnos uma única vez e vai para o Início', async () => {
    const { supabase } = setup();
    const btn = await screen.findByRole('button', { name: 'Confirmar e começar' });
    await userEvent.dblClick(btn);
    expect(
      await screen.findByRole('heading', { name: 'Início' }, { timeout: 4000 }),
    ).toBeInTheDocument();
    const calls = supabase.calls.rpc.filter((c) => c.name === 'set_business_hours');
    expect(calls).toHaveLength(1);
    expect((calls[0]!.args as { p_shifts: unknown[] }).p_shifts).toHaveLength(10);
  });

  it('erro do servidor aparece, mantém edições e permite nova tentativa', async () => {
    let fail = true;
    const { supabase } = setup({
      set_business_hours: () => (fail ? { error: { code: '23514', message: 'x' } } : {}),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar e começar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Alguns dados estão inválidos');
    expect(screen.getAllByText('09:00–12:00 · 13:00–18:00')).toHaveLength(5);
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar e começar' }));
    expect(
      await screen.findByRole('heading', { name: 'Início' }, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(supabase.calls.rpc).toHaveLength(2);
  });

  it('com expediente já cadastrado redireciona para o Início', async () => {
    setup(undefined, [row(1)]);
    expect(
      await screen.findByRole('heading', { name: 'Início' }, { timeout: 4000 }),
    ).toBeInTheDocument();
  });

  it('não confirma com horários inválidos', async () => {
    const { supabase } = setup();
    await userEvent.click(await screen.findByRole('button', { name: /Seg/ }));
    const end = screen.getByLabelText('Fim do turno 1 de Segunda');
    await userEvent.clear(end);
    await userEvent.type(end, '08:00');
    expect(screen.getByText('O fim precisa ser depois do início')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar e começar' })).toBeDisabled();
    await waitFor(() => expect(supabase.calls.rpc).toHaveLength(0));
  });
});
