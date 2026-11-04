import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, setViewportWidth } from '@/test/render';
import { createFakeSupabase, makeSession, type Row } from '@/test/fakeSupabase';
import { toast } from 'sonner';
import ReschedulePage from './ReschedulePage';
import type { Appointment } from '../api';

vi.mock('sonner', async (importOriginal) => {
  const mod = await importOriginal<typeof import('sonner')>();
  return { ...mod, toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) };
});

// 30/10/2026 (sexta) 10:00 em São Paulo; o navegador do teste está em Lisboa.
const NOW = new Date('2026-10-30T13:00:00Z');

const profile = {
  id: 'user-1',
  display_name: 'Camila',
  business_name: null,
  timezone: 'America/Sao_Paulo',
  default_duration_minutes: 60,
  slot_interval_minutes: 30,
  week_starts_on: 0,
  default_view: 'week',
  reminder_minutes: null,
  hide_client_name_in_notifications: false,
  created_at: '',
  updated_at: '',
};

// Seg a sáb, 09:00-18:00 (domingo sem expediente).
const hours: Row[] = [1, 2, 3, 4, 5, 6].map((weekday) => ({
  id: `h${weekday}`,
  owner_id: 'user-1',
  weekday,
  start_time: '09:00:00',
  end_time: '18:00:00',
}));

const appt = (over: Partial<Appointment> = {}): Appointment => ({
  id: 'ap-1',
  owner_id: 'user-1',
  client_name: 'Juliana Rocha',
  client_phone: '(11) 98765-4321',
  service_name: 'Escova',
  notes: null,
  starts_at: '2026-10-30T13:20:00+00:00', // 10:20-11:20 SP
  ends_at: '2026-10-30T14:20:00+00:00',
  status: 'agendado',
  canceled_at: null,
  cancellation_reason: null,
  created_at: '2026-10-01T00:00:00Z',
  reminder_anchor_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  ...over,
});

const other = appt({
  id: 'ap-2',
  client_name: 'Outra Cliente',
  starts_at: '2026-10-30T18:00:00+00:00', // 15:00-16:00 SP
  ends_at: '2026-10-30T19:00:00+00:00',
});

function setup(
  opts: {
    appointments?: Appointment[];
    rpc?: (args: unknown) => { data?: unknown; error?: unknown };
    id?: string;
  } = {},
) {
  setViewportWidth(390);
  const fake = createFakeSupabase({
    session: makeSession(),
    rpc: {
      reschedule_appointment: opts.rpc ?? (() => ({ data: appt() })),
    },
    tables: {
      profiles: [profile as Row],
      business_hours: hours,
      appointments: (opts.appointments ?? [appt(), other]) as unknown as Row[],
    },
  });
  const r = renderWithProviders(null, {
    supabase: fake,
    route: `/agenda/remarcar/${opts.id ?? 'ap-1'}`,
    routes: [
      { path: '/agenda/remarcar/:id', element: <ReschedulePage /> },
      { path: '/agenda', element: <h1>Agenda</h1> },
    ],
  });
  return { ...r, fake };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const slot = (time: string) => screen.findByRole('button', { name: new RegExp(`^${time}`) });

describe('ReschedulePage', () => {
  it('mostra o cartão do atendimento e o horário atual', async () => {
    setup();
    expect(await screen.findByText('Juliana Rocha')).toBeInTheDocument();
    expect(screen.getByText(/Escova/)).toBeInTheDocument();
    expect(screen.getByText(/30\/10\/2026 · 10:20/)).toBeInTheDocument();
  });

  it('o próprio horário não é ocupado para si mesmo; ocupado por outro fica desabilitado', async () => {
    setup();
    expect(await slot('10:30')).toBeEnabled(); // sobrepõe 10:20-11:20, que é do próprio
    expect(await slot('11:00')).toBeEnabled();
    const busy = await slot('15:00');
    expect(busy).toBeDisabled();
    expect(busy).toHaveTextContent('ocupado');
    expect(await slot('14:30')).toBeDisabled(); // 14:30-15:30 bate no outro
    expect(await slot('14:00')).toBeEnabled();
  });

  it('não mostra horários que já passaram hoje', async () => {
    setup();
    await slot('10:30');
    expect(screen.queryByRole('button', { name: /^09:00/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^09:30/ })).not.toBeInTheDocument();
  });

  it('pula dias sem expediente (domingo)', async () => {
    setup();
    await slot('10:30');
    const days = screen.getAllByRole('button', { name: /^(Seg|Ter|Qua|Qui|Sex|Sáb|Dom) \d+/ });
    expect(days.some((d) => /^Dom/.test(d.textContent ?? ''))).toBe(false);
    expect(days[0]).toHaveTextContent('Sex 30');
  });

  it('confirmar desabilitado sem seleção; envia ISO no fuso do perfil e volta à agenda', async () => {
    const { fake, router } = setup();
    const user = userEvent.setup();
    const confirm = await screen.findByRole('button', { name: 'Confirmar remarcação' });
    expect(confirm).toBeDisabled();
    await user.click(await slot('10:30'));
    expect(screen.getByText('30/10 às 10:20 → 30/10 às 10:30')).toBeInTheDocument();
    await user.click(confirm);
    await waitFor(() => expect(fake.calls.rpc).toHaveLength(1));
    expect(fake.calls.rpc[0]).toEqual({
      name: 'reschedule_appointment',
      args: {
        p_id: 'ap-1',
        p_starts_at: '2026-10-30T10:30:00-03:00',
        p_ends_at: '2026-10-30T11:30:00-03:00',
        p_confirm_past: false,
      },
    });
    await waitFor(() =>
      expect(router.state.location.pathname + router.state.location.search).toBe(
        '/agenda?visao=dia&data=2026-10-30',
      ),
    );
    expect(toast.success).toHaveBeenCalledWith('Atendimento remarcado');
  });

  it('duplo clique em confirmar faz uma única chamada', async () => {
    const { fake } = setup();
    const user = userEvent.setup();
    await user.click(await slot('11:00'));
    const confirm = screen.getByRole('button', { name: 'Confirmar remarcação' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(fake.calls.rpc.length).toBeGreaterThanOrEqual(1));
    expect(fake.calls.rpc).toHaveLength(1);
  });

  it('trocar de dia mantém o foco no botão do dia', async () => {
    setup();
    const user = userEvent.setup();
    await slot('10:30');
    const day = screen.getByRole('button', { name: /^Sáb 31/ });
    await user.click(day);
    expect(screen.getByRole('button', { name: /^Sáb 31/ })).toHaveFocus();
    expect(screen.getByRole('button', { name: /^Sáb 31/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('nome acessível do horário ocupado e passo que não cabe até o fim do turno', async () => {
    setup();
    expect(await screen.findByRole('button', { name: '15:00, ocupado' })).toBeDisabled();
    // 17:30 + 1h passaria das 18:00: aparece desabilitado.
    expect(await screen.findByRole('button', { name: '17:30, ocupado' })).toBeDisabled();
  });

  it('conflito: mensagem, limpa a seleção e mantém o dia', async () => {
    setup({ rpc: () => ({ error: { code: 'AE001', message: 'x' } }) });
    const user = userEvent.setup();
    await user.click(await slot('11:00'));
    await user.click(screen.getByRole('button', { name: 'Confirmar remarcação' }));
    expect(
      await screen.findByText('Esse horário já está ocupado. Escolha outro horário.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Confirmar remarcação' })).toBeDisabled(),
    );
    expect(await slot('11:00')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /^Sex 30/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('erro de rede: alerta e "Tentar novamente" reenvia os mesmos valores', async () => {
    let n = 0;
    const { fake } = setup({
      rpc: () => (n++ === 0 ? { error: { message: 'Failed to fetch' } } : { data: appt() }),
    });
    const user = userEvent.setup();
    await user.click(await slot('11:00'));
    await user.click(screen.getByRole('button', { name: 'Confirmar remarcação' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão');
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(fake.calls.rpc).toHaveLength(2));
    expect(fake.calls.rpc[1]).toEqual(fake.calls.rpc[0]);
  });

  it('status diferente de agendado: mensagem e voltar, sem grade', async () => {
    setup({ appointments: [appt({ status: 'concluido' })] });
    expect(
      await screen.findByText('Só atendimentos agendados podem ser remarcados.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/agenda');
    expect(screen.queryByRole('button', { name: 'Confirmar remarcação' })).not.toBeInTheDocument();
  });

  it('atendimento inexistente', async () => {
    setup({ id: 'nao-existe' });
    expect(await screen.findByText('Atendimento não encontrado.')).toBeInTheDocument();
  });
});
