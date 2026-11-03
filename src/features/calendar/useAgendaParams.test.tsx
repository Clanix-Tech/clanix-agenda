import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, setViewportWidth } from '@/test/render';
import { createFakeSupabase, makeSession } from '@/test/fakeSupabase';
import { useAgendaParams } from './useAgendaParams';

function Probe() {
  const p = useAgendaParams();
  return (
    <div>
      <output data-testid="state">
        {JSON.stringify({ view: p.view, date: p.date, status: p.status })}
      </output>
      <button onClick={() => p.set({ view: 'lista' })}>lista</button>
      <button onClick={() => p.set({ date: '2026-11-01', status: ['agendado', 'concluido'] })}>
        dados
      </button>
      <button onClick={() => p.set({ status: null })}>limpar</button>
    </div>
  );
}

function setup(route: string, width = 1280, defaultView = 'semana') {
  setViewportWidth(width);
  const fake = createFakeSupabase({
    session: makeSession(),
    tables: {
      profiles: [{ id: 'user-1', timezone: 'America/Sao_Paulo', default_view: defaultView }],
    },
  });
  const r = renderWithProviders(<Probe />, { supabase: fake, route });
  return r;
}

const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}');

describe('useAgendaParams', () => {
  it('lê visao, data e status da URL', async () => {
    setup('/agenda?visao=lista&data=2026-10-29&status=agendado,concluido');
    expect(state()).toEqual({
      view: 'lista',
      date: '2026-10-29',
      status: ['agendado', 'concluido'],
    });
  });

  it('escreve na URL preservando os outros parâmetros', async () => {
    const user = userEvent.setup();
    const { router } = setup('/agenda?atendimento=abc');
    await user.click(screen.getByText('lista'));
    await user.click(screen.getByText('dados'));
    const sp = new URLSearchParams(router.state.location.search);
    expect(sp.get('visao')).toBe('lista');
    expect(sp.get('data')).toBe('2026-11-01');
    expect(sp.get('status')).toBe('agendado,concluido');
    expect(sp.get('atendimento')).toBe('abc');
    await user.click(screen.getByText('limpar'));
    expect(new URLSearchParams(router.state.location.search).has('status')).toBe(false);
  });

  it('visão padrão vem do perfil no computador e vira "dia" abaixo de 1024 px', async () => {
    setup('/agenda', 1280, 'semana');
    expect(await screen.findByTestId('state')).toBeInTheDocument();
    await vi.waitFor(() => expect(state().view).toBe('semana'));
  });

  it('abaixo de 1024 px semana/mês padrão viram dia; visao na URL vence', async () => {
    const a = setup('/agenda', 390, 'semana');
    await vi.waitFor(() => expect(state().view).toBe('dia'));
    a.unmount();
    setup('/agenda?visao=mes', 390, 'semana');
    expect(state().view).toBe('mes');
  });

  it('data e status inválidos são ignorados', () => {
    setup('/agenda?data=2026-02-30&status=foo');
    expect(state().status).toBeNull();
    expect(state().date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state().date).not.toBe('2026-02-30');
  });
});
