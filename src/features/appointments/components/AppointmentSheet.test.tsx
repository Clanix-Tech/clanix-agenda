import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, setViewportWidth } from '@/test/render';
import { AppShell } from '@/components/layout/AppShell';
import { createFakeSupabase, makeSession, type Row } from '@/test/fakeSupabase';
import type { Appointment } from '../api';

vi.mock('sonner', async (importOriginal) => {
  const mod = await importOriginal<typeof import('sonner')>();
  return { ...mod, toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) };
});

// 30/10/2026 10:00 em São Paulo (13:00 UTC); o navegador do teste está em Lisboa.
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

const appt = (over: Partial<Appointment> = {}): Appointment => ({
  id: 'ap-1',
  owner_id: 'user-1',
  client_name: 'Juliana Rocha',
  client_phone: '(11) 98765-4321',
  service_name: 'Escova',
  notes: 'Prefere produtos sem amônia',
  starts_at: '2026-10-30T13:20:00+00:00',
  ends_at: '2026-10-30T14:20:00+00:00',
  status: 'agendado',
  canceled_at: null,
  cancellation_reason: null,
  created_at: '2026-10-01T00:00:00Z',
  reminder_anchor_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  ...over,
});

const history: Row[] = [
  {
    id: 'h1',
    appointment_id: 'ap-1',
    action: 'remarcado',
    previous_values: {
      starts_at: '2026-10-28T18:00:00+00:00',
      ends_at: '2026-10-28T19:00:00+00:00',
    },
    new_values: { starts_at: '2026-10-29T17:00:00+00:00', ends_at: '2026-10-29T18:00:00+00:00' },
    created_at: '2026-10-27T21:12:00+00:00',
  },
  {
    id: 'h0',
    appointment_id: 'ap-1',
    action: 'criado',
    previous_values: null,
    new_values: {},
    created_at: '2026-10-22T12:14:00+00:00',
  },
  {
    id: 'h2',
    appointment_id: 'ap-1',
    action: 'status_alterado',
    previous_values: { status: 'agendado' },
    new_values: { status: 'nao_compareceu' },
    created_at: '2026-10-23T12:14:00+00:00',
  },
  {
    id: 'h3',
    appointment_id: 'ap-1',
    action: 'cancelado',
    previous_values: { status: 'agendado' },
    new_values: { status: 'cancelado', cancellation_reason: 'Cliente viajou' },
    created_at: '2026-10-24T12:14:00+00:00',
  },
];

function setup(opts: { route?: string; appointments?: Appointment[] } = {}) {
  setViewportWidth(390);
  const fake = createFakeSupabase({
    session: makeSession(),
    rpc: {},
    tables: {
      profiles: [profile as Row],
      business_hours: [],
      favorite_services: [],
      appointments: (opts.appointments ?? [appt()]) as unknown as Row[],
      appointment_history: history,
    },
  });
  const r = renderWithProviders(null, {
    supabase: fake,
    route: opts.route ?? '/agenda?atendimento=ap-1',
    routes: [
      {
        element: (
          <AppShell
            renderForm={({ prefill, close }) => (
              <p>
                novo agendamento {prefill?.date}
                <button onClick={close}>fechar novo</button>
              </p>
            )}
          />
        ),
        children: [{ path: '*', element: <h1>Conteúdo</h1> }],
      },
    ],
  });
  return { ...r, fake };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('AppointmentSheet', () => {
  it('não aparece sem o parâmetro', () => {
    setup({ route: '/agenda' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('mostra status, próximo, dados e telefone como link tel:', async () => {
    setup();
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Juliana Rocha')).toBeInTheDocument();
    expect(within(dialog).getByText('Agendado')).toBeInTheDocument();
    expect(within(dialog).getByText('Próximo · em 20 min')).toBeInTheDocument();
    expect(within(dialog).getByText(/Sexta-feira, 30\/10\/2026/)).toBeInTheDocument();
    expect(within(dialog).getByText('10:20 – 11:20 · 1 hora')).toBeInTheDocument();
    expect(within(dialog).getByText('Escova')).toBeInTheDocument();
    expect(within(dialog).getByText('Prefere produtos sem amônia')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Ligar' })).toHaveAttribute(
      'href',
      'tel:11987654321',
    );
  });

  it('não mostra "Próximo" para agendamento distante ou que não é agendado', async () => {
    setup({
      appointments: [
        appt({ starts_at: '2026-11-05T13:00:00+00:00', ends_at: '2026-11-05T14:00:00+00:00' }),
      ],
    });
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Juliana Rocha');
    expect(within(dialog).queryByText(/Próximo/)).not.toBeInTheDocument();
  });

  it('histórico no fuso do perfil, com rótulos por ação', async () => {
    setup();
    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByText('Remarcado de 28/10 às 15:00 para 29/10 às 14:00'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Agendamento criado')).toBeInTheDocument();
    expect(within(dialog).getByText('Status: Agendado → Não compareceu')).toBeInTheDocument();
    expect(within(dialog).getByText('Cancelado')).toBeInTheDocument();
    expect(within(dialog).getByText('Motivo: Cliente viajou')).toBeInTheDocument();
    expect(within(dialog).getByText('27/10/2026 às 18:12')).toBeInTheDocument();
  });

  it('id inexistente mostra "Atendimento não encontrado."', async () => {
    setup({ route: '/agenda?atendimento=nao-existe' });
    expect(await screen.findByText('Atendimento não encontrado.')).toBeInTheDocument();
  });

  it('fechar remove o parâmetro e mantém os outros', async () => {
    const { router } = setup({ route: '/agenda?visao=dia&atendimento=ap-1' });
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Juliana Rocha');
    await userEvent.setup().keyboard('{Escape}');
    await waitFor(() => expect(router.state.location.search).toBe('?visao=dia'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Remarcar" navega para a página de remarcação', async () => {
    const { router } = setup();
    const dialog = await screen.findByRole('dialog');
    await userEvent.setup().click(await within(dialog).findByRole('button', { name: 'Remarcar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/agenda/remarcar/ap-1'));
    expect(router.state.location.search).toBe('');
  });

  it('"Editar dados" troca os detalhes pelo formulário e volta aos detalhes ao terminar', async () => {
    setup();
    const user = userEvent.setup();
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'Editar dados' }));
    expect(await screen.findByLabelText('Nome do cliente')).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Detalhes do atendimento' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(
      await screen.findByRole('dialog', { name: 'Detalhes do atendimento' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Juliana Rocha')).toBeInTheDocument();
  });

  it('atendimento cancelado oferece só "Reativar"', async () => {
    setup({ appointments: [appt({ status: 'cancelado' })] });
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('button', { name: 'Reativar' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Remarcar' })).not.toBeInTheDocument();
  });

  it('Back durante a edição fecha e outro atendimento abre nos detalhes, não no formulário', async () => {
    const { router } = setup({
      route: '/agenda?atendimento=ap-1',
      appointments: [appt(), appt({ id: 'ap-2', client_name: 'Bia Souza' })],
    });
    const user = userEvent.setup();
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'Editar dados' }));
    expect(await screen.findByLabelText('Nome do cliente')).toBeInTheDocument();
    await act(async () => {
      await router.navigate(-1);
    });
    await act(async () => {
      await router.navigate('/agenda?atendimento=ap-2');
    });
    expect(
      await screen.findByRole('dialog', { name: 'Detalhes do atendimento' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Bia Souza')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome do cliente')).not.toBeInTheDocument();
  });

  it('reativação com conflito: "Criar novo agendamento" fecha os detalhes e abre o formulário na mesma data', async () => {
    const { fake, router } = setup({ appointments: [appt({ status: 'cancelado' })] });
    fake.rpc = ((orig) => (name: string, args?: unknown) =>
      name === 'reactivate_appointment'
        ? Promise.resolve({ data: null, error: { code: 'AE001', message: 'x' } })
        : orig(name, args))(fake.rpc.bind(fake)) as typeof fake.rpc;
    const user = userEvent.setup();
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'Reativar' }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    await user.click(within(confirm).getByRole('button', { name: 'Reativar' }));
    await user.click(await screen.findByRole('button', { name: 'Criar novo agendamento' }));
    expect(await screen.findByText(/novo agendamento 2026-10-30/)).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    expect(
      screen.queryByRole('dialog', { name: 'Detalhes do atendimento' }),
    ).not.toBeInTheDocument();
  });

  it('RN17: "Concluir" grava mas a resposta se perde → os detalhes se atualizam, sem erro antigo', async () => {
    const { fake } = setup();
    let calls = 0;
    fake.rpc = ((orig) => (name: string, args?: unknown) => {
      if (name !== 'set_appointment_status') return orig(name, args);
      calls += 1;
      if (calls === 1) {
        // O banco gravou; a resposta não chegou.
        fake.tables.appointments![0]!.status = 'concluido';
        return Promise.resolve({
          data: null,
          error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' },
        });
      }
      return Promise.resolve({ data: null, error: { code: 'AE005', message: 'x' } });
    })(fake.rpc.bind(fake)) as typeof fake.rpc;

    const user = userEvent.setup();
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'Concluir' }));

    // O erro invalida os dados: o painel mostra o status real e as ações de "Concluído".
    expect(
      await within(dialog).findByRole('button', { name: 'Marcar como não compareceu' }),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByText('Concluído').length).toBeGreaterThan(0);
    expect(within(dialog).queryByRole('button', { name: 'Concluir' })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Sem conexão/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/não é permitida/)).not.toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it('agendamento de amanhã dentro de 24 h mostra "amanhã às HH:mm"', async () => {
    setup({
      appointments: [
        appt({ starts_at: '2026-10-31T11:00:00+00:00', ends_at: '2026-10-31T12:00:00+00:00' }),
      ],
    });
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Próximo · amanhã às 08:00')).toBeInTheDocument();
  });
});
