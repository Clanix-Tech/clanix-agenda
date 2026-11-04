import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { renderWithProviders, setViewportWidth } from '@/test/render';
import { createFakeSupabase, makeSession, type Row } from '@/test/fakeSupabase';
import { NewAppointmentProvider } from '@/features/appointments/components/NewAppointmentProvider';
import type { AppointmentStatus } from '@/features/appointments/domain/status';
import DashboardPage from './DashboardPage';

const NOW = new Date('2026-10-29T13:40:00-03:00');

const ap = (
  id: string,
  name: string,
  day: string,
  start: string,
  end: string,
  status: AppointmentStatus = 'agendado',
): Row => ({
  id,
  owner_id: 'user-1',
  client_name: name,
  client_phone: null,
  service_name: 'Corte',
  notes: null,
  starts_at: `${day}T${start}:00-03:00`,
  ends_at: `${day}T${end}:00-03:00`,
  status,
  canceled_at: null,
  cancellation_reason: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
});

const FIXTURE = [
  ap('A', 'Ana', '2026-10-29', '08:30', '09:30', 'concluido'),
  ap('B', 'Bia', '2026-10-29', '11:30', '12:00', 'nao_compareceu'),
  ap('C', 'Carla Dias', '2026-10-29', '14:00', '15:00'),
  ap('D', 'Davi', '2026-10-29', '16:30', '17:00', 'cancelado'),
  ap('E', 'Eva', '2026-10-29', '17:00', '18:00'),
  ap('F', 'Fabio', '2026-10-30', '09:00', '10:00'),
  ap('G', 'Gabi', '2026-10-05', '10:00', '11:00', 'cancelado'),
  ap('H', 'Heitor', '2026-11-02', '09:00', '10:00'),
];

const hours: Row[] = [1, 2, 3, 4, 5, 6].map((weekday) => ({
  id: `h-${weekday}`,
  owner_id: 'user-1',
  weekday,
  start_time: '08:00:00',
  end_time: '18:00:00',
}));

function Where() {
  const loc = useLocation();
  return <output data-testid="loc">{loc.pathname + loc.search}</output>;
}

function setup(
  opts: {
    rows?: Row[];
    width?: number;
    name?: string;
    hours?: Row[];
    errors?: Record<string, Partial<Record<'select', unknown>>>;
  } = {},
) {
  setViewportWidth(opts.width ?? 390);
  const fake = createFakeSupabase({
    session: makeSession(),
    tables: {
      profiles: [
        {
          id: 'user-1',
          timezone: 'America/Sao_Paulo',
          display_name: opts.name ?? 'Marina Souza',
          week_starts_on: 1,
        },
      ],
      business_hours: opts.hours ?? hours,
      appointments: opts.rows ?? FIXTURE,
    },
    errors: opts.errors,
  });
  return renderWithProviders(null, {
    supabase: fake,
    route: '/',
    routes: [
      {
        path: '*',
        element: (
          <NewAppointmentProvider
            renderForm={({ prefill }) => (
              <output data-testid="prefill">{JSON.stringify(prefill)}</output>
            )}
          >
            <DashboardPage />
            <Where />
          </NewAppointmentProvider>
        ),
      },
    ],
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('DashboardPage', () => {
  it('saúda por hora local com o primeiro nome e mostra o próximo em 20 min', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Boa tarde, Marina' })).toBeInTheDocument();
    const card = screen.getByRole('region', { name: 'Próximo atendimento' });
    expect(within(card).getByText('em 20 min')).toBeInTheDocument();
    expect(within(card).getByText('Carla Dias')).toBeInTheDocument();
  });

  it('mostra os indicadores do fixture', async () => {
    setup();
    const kpis = await screen.findByRole('region', { name: 'Indicadores' });
    expect(within(kpis).getByText('Hoje').nextSibling).toHaveTextContent('4');
    expect(within(kpis).getByText('Semana').nextSibling).toHaveTextContent('5');
    expect(within(kpis).getByText('Cancelamentos do mês').nextSibling).toHaveTextContent('2');
  });

  it('Ver detalhes abre o atendimento e Remarcar leva à remarcação', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('region', { name: 'Próximo atendimento' });
    await user.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('?atendimento=C');
    await user.click(screen.getByRole('link', { name: 'Remarcar' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/agenda/remarcar/C');
  });

  it('horário livre de hoje abre o formulário sem horário no passado', async () => {
    const user = userEvent.setup();
    setup();
    const slot = await screen.findByRole('button', { name: '15:00 – 17:00' });
    expect(screen.queryByRole('button', { name: /^08:00/ })).not.toBeInTheDocument();
    // Livre 12:00-14:00 já com 13:40 como piso: nunca no passado.
    await user.click(screen.getByRole('button', { name: '13:40 – 14:00' }));
    expect(screen.getByTestId('prefill')).toHaveTextContent('"startTime":"13:40"');
    await user.click(slot);
    expect(screen.getByTestId('prefill')).toHaveTextContent('"startTime":"15:00"');
    expect(screen.getByTestId('prefill')).toHaveTextContent('"date":"2026-10-29"');
  });

  it('lista os próximos atendimentos (mobile) e abre ao tocar na linha', async () => {
    const user = userEvent.setup();
    setup();
    const list = await screen.findByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(within(list).getByText('Amanhã')).toBeInTheDocument();
    await user.click(within(list).getByRole('button', { name: /Fabio/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('?atendimento=F');
  });

  it('computador: tabela com Ver/Remarcar e minicalendário com link do dia', async () => {
    const user = userEvent.setup();
    setup({ width: 1280 });
    expect(await screen.findByRole('table')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver detalhes de Eva' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('?atendimento=E');
    const cal = screen.getByRole('region', { name: 'Calendário do mês' });
    const today = within(cal).getByRole('link', { current: 'date' });
    expect(today).toHaveAttribute('href', '/agenda?visao=dia&data=2026-10-29');
  });

  it('sem próximo atendimento mostra a linha amigável', async () => {
    setup({ rows: [ap('A', 'Ana', '2026-10-29', '08:30', '09:30', 'concluido')] });
    expect(
      (await screen.findAllByText('Nenhum atendimento agendado a seguir.')).length,
    ).toBeGreaterThan(0);
  });

  it('agenda vazia mostra o EmptyState e mantém a saudação', async () => {
    setup({ rows: [] });
    expect(
      await screen.findByText('Sua agenda está livre. Que tal marcar o primeiro atendimento?'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Boa tarde/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo agendamento' })).toBeInTheDocument();
  });

  it('minicalendário usa o expediente: domingo com horário não fica apagado', async () => {
    setup({
      width: 1280,
      hours: [0, 1, 2, 3, 4, 5].map((weekday) => ({
        id: `h-${weekday}`,
        owner_id: 'user-1',
        weekday,
        start_time: '08:00:00',
        end_time: '18:00:00',
      })),
    });
    const cal = await screen.findByRole('region', { name: 'Calendário do mês' });
    const sunday = within(cal).getByRole('link', { name: '25/10' }).className;
    expect(sunday).toMatch(/text-\[#0F2D5B\]/);
    expect(sunday).not.toMatch(/#64748B/);
    const closed = within(cal).getByRole('link', { name: '31/10' }).className; // sábado fechado
    expect(closed).toMatch(/text-\[#64748B\]/);
    expect(closed).not.toMatch(/text-\[#0F2D5B\]/);
    expect(within(cal).getByRole('link', { name: '25/10' }).className).toMatch(/size-11/);
  });

  it('mostra carregando e depois o painel', async () => {
    setup();
    expect(screen.getByText('Carregando seu painel…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /Boa tarde/ })).toBeInTheDocument();
  });

  it('erro de carga mostra ErrorState e "Tentar novamente" recarrega', async () => {
    const user = userEvent.setup();
    const errors: Record<string, Partial<Record<'select', unknown>>> = {
      appointments: { select: { code: 'XX000', message: 'boom' } },
    };
    setup({ errors });
    expect(await screen.findByText('Não foi possível carregar o painel.')).toBeInTheDocument();
    delete errors.appointments;
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { name: /Boa tarde/ })).toBeInTheDocument();
  });
});
