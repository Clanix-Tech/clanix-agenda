import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { renderWithProviders, setViewportWidth } from '@/test/render';
import { createFakeSupabase, makeSession, type Row } from '@/test/fakeSupabase';
import type { AppointmentStatus } from '@/features/appointments/domain/status';
import { MonthView } from './MonthView';

const NOW = new Date('2026-10-29T13:40:00-03:00');
const TZ = 'America/Sao_Paulo';

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
  starts_at: `2026-10-${day}T${start}:00-03:00`,
  ends_at: `2026-10-${day}T${end}:00-03:00`,
  status,
  canceled_at: null,
  cancellation_reason: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
});

const shifts = [1, 2, 3, 4, 5, 6].map((weekday) => ({
  id: `h-${weekday}`,
  owner_id: 'user-1',
  weekday,
  start_time: '08:00:00',
  end_time: '18:00:00',
}));

// 7 atendimentos em 29/10 (1 cancelado), fora de ordem de horário
const DAY29 = [
  ap('p7', 'Pessoa Sete', '29', '17:00', '18:00'),
  ap('p1', 'Pessoa Um', '29', '08:00', '09:00', 'concluido'),
  ap('p2', 'Pessoa Dois', '29', '09:00', '10:00', 'cancelado'),
  ap('p3', 'Pessoa Três', '29', '10:00', '11:00', 'concluido'),
  ap('p4', 'Pessoa Quatro', '29', '11:00', '12:00', 'nao_compareceu'),
  ap('p5', 'Pessoa Cinco', '29', '14:00', '15:00'),
  ap('p6', 'Pessoa Seis', '29', '15:00', '16:00'),
];

function Where() {
  const loc = useLocation();
  return <output data-testid="loc">{loc.search}</output>;
}

function setup(opts: { width?: number; rows?: Row[]; status?: AppointmentStatus[] | null } = {}) {
  setViewportWidth(opts.width ?? 1280);
  const fake = createFakeSupabase({
    session: makeSession(),
    tables: {
      profiles: [{ id: 'user-1', timezone: TZ, week_starts_on: 1, slot_interval_minutes: 30 }],
      business_hours: shifts,
      appointments: opts.rows ?? DAY29,
    },
  });
  return renderWithProviders(null, {
    supabase: fake,
    route: '/agenda?visao=mes&data=2026-10-15',
    routes: [
      {
        path: '/agenda',
        element: (
          <>
            <MonthView date="2026-10-15" tz={TZ} status={opts.status ?? null} />
            <Where />
          </>
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

describe('MonthView (computador)', () => {
  it('mostra 2 atendimentos por dia e "+5 mais" no dia 29 com 7 atendimentos', async () => {
    setup();
    const more = await screen.findByRole('link', { name: '+5 mais' });
    expect(more).toHaveAttribute('href', expect.stringContaining('visao=dia'));
    expect(more).toHaveAttribute('href', expect.stringContaining('data=2026-10-29'));
    const cell = screen.getByRole('group', { name: '29 de outubro' });
    expect(within(cell).getAllByRole('button')).toHaveLength(2);
    // ordenados por início: 08:00 e 09:00
    expect(within(cell).getByRole('button', { name: /Pessoa Um/ })).toBeInTheDocument();
    expect(within(cell).getByRole('button', { name: /Pessoa Dois/ })).toBeInTheDocument();
  });

  it('marca os domingos como "Fechado"', async () => {
    setup();
    await screen.findByRole('link', { name: '+5 mais' });
    // 4, 11, 18, 25/10 e 1/11 (última linha da grade)
    expect(screen.getAllByText('Fechado')).toHaveLength(5);
  });

  it('cancelado riscado, passado cinza, hoje com borda azul', async () => {
    setup();
    const cancelled = await screen.findByRole('button', { name: /Pessoa Dois.*Cancelado/ });
    expect(within(cancelled).getByText('Pessoa Dois')).toHaveClass('line-through');
    expect(screen.getByRole('button', { name: /Pessoa Um/ })).toHaveClass('bg-[#F1F5F9]');
    const today = screen.getByRole('group', { name: '29 de outubro' });
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(today).toHaveClass('border-[#3B82F6]');
  });

  it('clicar no atendimento abre os detalhes; o número do dia leva à visão Dia', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('button', { name: /Pessoa Um/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('atendimento=p1');
    const day = screen.getByRole('link', { name: 'Ver dia 12 de outubro' });
    expect(day).toHaveAttribute('href', expect.stringContaining('visao=dia'));
    expect(day).toHaveAttribute('href', expect.stringContaining('data=2026-10-12'));
  });

  it('o filtro de status esconde os demais', async () => {
    setup({ status: ['cancelado'] });
    expect(await screen.findByRole('button', { name: /Pessoa Dois/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pessoa Um/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /mais$/ })).toBeNull();
  });
});

describe('MonthView (celular)', () => {
  it('grade compacta com contagem por dia; toque leva à visão Dia, sem rolagem horizontal', async () => {
    const { container } = setup({ width: 390 });
    const day = await screen.findByRole('link', { name: /^29 de outubro, 6 atendimentos/ });
    expect(day).toHaveAttribute('href', expect.stringContaining('visao=dia'));
    expect(day).toHaveAttribute('href', expect.stringContaining('data=2026-10-29'));
    expect(container.querySelector('[class*="overflow-x-"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /Pessoa Um/ })).toBeNull();
  });
});
