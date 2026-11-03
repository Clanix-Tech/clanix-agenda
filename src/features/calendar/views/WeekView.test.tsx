import { useState } from 'react';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { renderWithProviders, setViewportWidth } from '@/test/render';
import { createFakeSupabase, makeSession, type Row } from '@/test/fakeSupabase';
import { NewAppointmentProvider } from '@/features/appointments/components/NewAppointmentProvider';
import type { AppointmentStatus } from '@/features/appointments/domain/status';
import { WeekView } from './WeekView';

// 29/10/2026 (quinta), 13:40 em São Paulo. Navegador do teste em Lisboa.
const NOW = new Date('2026-10-29T13:40:00-03:00');
const TZ = 'America/Sao_Paulo';

const ap = (
  id: string,
  name: string,
  day: string,
  start: string,
  end: string,
  status: AppointmentStatus = 'agendado',
  month = '10',
): Row => ({
  id,
  owner_id: 'user-1',
  client_name: name,
  client_phone: null,
  service_name: 'Corte',
  notes: null,
  starts_at: `2026-${month}-${day}T${start}:00-03:00`,
  ends_at: `2026-${month}-${day}T${end}:00-03:00`,
  status,
  canceled_at: null,
  cancellation_reason: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
});

const shifts = [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
  {
    id: `h1-${weekday}`,
    owner_id: 'user-1',
    weekday,
    start_time: '08:00:00',
    end_time: '12:00:00',
  },
  {
    id: `h2-${weekday}`,
    owner_id: 'user-1',
    weekday,
    start_time: '13:00:00',
    end_time: '18:00:00',
  },
]);

const ROWS = [
  ap('m1', 'Marta Pires', '26', '09:00', '10:00', 'concluido'),
  ap('t1', 'Juliana Rocha', '29', '14:00', '15:00'),
  ap('t2', 'Roberto Alves', '29', '15:00', '16:00', 'cancelado'),
  ap('f1', 'Vanessa Torres', '30', '10:00', '11:00'),
  ap('f2', 'Larissa Campos', '30', '14:00', '16:00'),
];

function Where() {
  const loc = useLocation();
  return <output data-testid="loc">{loc.search}</output>;
}

function Harness({ initial, status }: { initial: string; status?: AppointmentStatus[] | null }) {
  const [date, setDate] = useState(initial);
  return <WeekView date={date} tz={TZ} status={status ?? null} onDate={setDate} />;
}

function setup(opts: { rows?: Row[]; width?: number; status?: AppointmentStatus[] | null } = {}) {
  setViewportWidth(opts.width ?? 1280);
  const fake = createFakeSupabase({
    session: makeSession(),
    tables: {
      profiles: [
        {
          id: 'user-1',
          timezone: TZ,
          default_view: 'semana',
          slot_interval_minutes: 30,
          week_starts_on: 1,
        },
      ],
      business_hours: shifts,
      appointments: opts.rows ?? ROWS,
    },
  });
  return renderWithProviders(null, {
    supabase: fake,
    route: '/agenda?visao=semana&data=2026-10-29',
    routes: [
      {
        path: '/agenda',
        element: (
          <NewAppointmentProvider
            renderForm={({ prefill }) => (
              <output data-testid="prefill">{JSON.stringify(prefill)}</output>
            )}
          >
            <Harness initial="2026-10-29" status={opts.status} />
            <Where />
          </NewAppointmentProvider>
        ),
      },
    ],
  });
}

const columns = () => screen.getAllByRole('group', { name: /^(Seg|Ter|Qua|Qui|Sex|Sáb|Dom) \d+$/ });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('WeekView (computador)', () => {
  it('mostra 6 colunas (Seg–Sáb) quando o domingo não tem turno', async () => {
    setup();
    await screen.findByRole('button', { name: /Juliana Rocha/ });
    const cols = columns();
    expect(cols).toHaveLength(6);
    expect(cols[0]).toHaveAccessibleName('Seg 26');
    expect(cols[5]).toHaveAccessibleName('Sáb 31');
  });

  it('domingo sem turno mas com atendimento aparece como "Fechado"', async () => {
    setup({ rows: [...ROWS, ap('d1', 'Domingo Dias', '01', '10:00', '11:00', 'agendado', '11')] });
    await screen.findByRole('button', { name: /Domingo Dias/ });
    expect(columns()).toHaveLength(7);
    expect(
      within(screen.getByRole('group', { name: 'Dom 1' })).getByText('Fechado'),
    ).toBeInTheDocument();
  });

  it('eventos têm nome acessível, destacam o próximo e cancelados ficam tracejados', async () => {
    setup();
    const next = await screen.findByRole('button', {
      name: 'Juliana Rocha, 14:00–15:00, Agendado',
    });
    expect(next).toHaveClass('bg-[#0F2D5B]');
    const cancelled = screen.getByRole('button', {
      name: 'Roberto Alves, 15:00–16:00, Cancelado',
    });
    expect(cancelled).toHaveClass('border-dashed');
    expect(within(cancelled).getByText('Roberto Alves')).toHaveClass('line-through');
    const done = screen.getByRole('button', { name: 'Marta Pires, 09:00–10:00, Concluído' });
    expect(done).not.toHaveClass('bg-[#0F2D5B]');
  });

  it('um cancelado sobreposto a um ativo não esconde nenhum dos dois', async () => {
    setup({
      rows: [
        ap('a', 'Ativa Souza', '30', '10:00', '11:00'),
        ap('c', 'Cancelada Lima', '30', '10:00', '11:00', 'cancelado'),
      ],
    });
    expect(await screen.findByRole('button', { name: /Ativa Souza/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancelada Lima/ })).toBeInTheDocument();
  });

  it('destaca hoje e mostra a linha do agora só na coluna de hoje', async () => {
    setup();
    await screen.findByRole('button', { name: /Juliana Rocha/ });
    expect(screen.getAllByText('Agora · 13:40')).toHaveLength(1);
    const today = screen.getByRole('group', { name: 'Qui 29' });
    expect(within(today).getByText('Agora · 13:40')).toBeInTheDocument();
    expect(today).toHaveAttribute('aria-current', 'date');
  });

  it('clique em 11:00 de sexta abre o formulário com data e horário', async () => {
    setup();
    await screen.findByRole('button', { name: /Vanessa Torres/ });
    // dayStart 08:00 → 11:00 está a 3 h = 156 px
    fireEvent.click(screen.getByTestId('col-2026-10-30'), { clientY: 156 });
    expect(screen.getByTestId('prefill')).toHaveTextContent(
      JSON.stringify({ date: '2026-10-30', startTime: '11:00' }),
    );
  });

  it('arredonda para o intervalo (11:20 → 11:00)', async () => {
    setup();
    await screen.findByRole('button', { name: /Vanessa Torres/ });
    fireEvent.click(screen.getByTestId('col-2026-10-30'), { clientY: 172 });
    expect(screen.getByTestId('prefill')).toHaveTextContent(
      JSON.stringify({ date: '2026-10-30', startTime: '11:00' }),
    );
  });

  it('clique no almoço (12:30) não abre o formulário', async () => {
    setup();
    await screen.findByRole('button', { name: /Vanessa Torres/ });
    fireEvent.click(screen.getByTestId('col-2026-10-30'), { clientY: 234 });
    expect(screen.queryByTestId('prefill')).toBeNull();
  });

  it('botão "Novo agendamento em Sex 30" abre o formulário só com a data', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('button', { name: 'Novo agendamento em Sex 30' }));
    expect(screen.getByTestId('prefill')).toHaveTextContent(JSON.stringify({ date: '2026-10-30' }));
  });

  it('clicar no evento abre os detalhes sem abrir o formulário', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('button', { name: /Larissa Campos/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent(
      '?visao=semana&data=2026-10-29&atendimento=f2',
    );
    expect(screen.queryByTestId('prefill')).toBeNull();
  });

  it('o filtro de status esconde os demais eventos', async () => {
    setup({ status: ['cancelado'] });
    expect(await screen.findByRole('button', { name: /Roberto Alves/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Juliana Rocha/ })).toBeNull();
  });
});

describe('WeekView (celular)', () => {
  it('mostra a faixa de 7 dias e, ao tocar "Sex 30", o DayView do dia', async () => {
    const user = userEvent.setup();
    const { container } = setup({ width: 390 });
    const fri = await screen.findByRole('button', { name: /^Sex 30, 2 atendimentos/ });
    expect(
      screen.getAllByRole('button', { name: /^(Seg|Ter|Qua|Qui|Sex|Sáb|Dom) \d+, / }),
    ).toHaveLength(7);
    // quinta tem 1 atendimento ativo (o cancelado não conta)
    expect(screen.getByRole('button', { name: /^Qui 29, 1 atendimento,/ })).toBeInTheDocument();
    await user.click(fri);
    expect(await screen.findByRole('button', { name: /Vanessa Torres/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Larissa Campos/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Juliana Rocha/ })).toBeNull();
    expect(fri).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('[class*="overflow-x-"]')).toBeNull();
    expect(screen.queryByTestId('col-2026-10-30')).toBeNull();
  });

  it('redimensionar de celular para computador troca a faixa pela grade', async () => {
    setup({ width: 390 });
    await screen.findByRole('button', { name: /^Sex 30, / });
    act(() => setViewportWidth(1280));
    expect(await screen.findByTestId('col-2026-10-30')).toBeInTheDocument();
  });
});
