import { useState } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { renderWithProviders, setViewportWidth } from '@/test/render';
import { createFakeSupabase, makeSession, type Row } from '@/test/fakeSupabase';
import { NewAppointmentProvider } from '@/features/appointments/components/NewAppointmentProvider';
import { DayView } from './DayView';
import type { AppointmentStatus } from '@/features/appointments/domain/status';

// 29/10/2026 (quinta), 13:40 em São Paulo = 16:40 UTC. O navegador do teste está em Lisboa.
const NOW = new Date('2026-10-29T13:40:00-03:00');
const TZ = 'America/Sao_Paulo';

const ap = (
  id: string,
  name: string,
  service: string,
  start: string,
  end: string,
  status: AppointmentStatus = 'agendado',
): Row => ({
  id,
  owner_id: 'user-1',
  client_name: name,
  client_phone: null,
  service_name: service,
  notes: null,
  starts_at: `2026-10-29T${start}:00-03:00`,
  ends_at: `2026-10-29T${end}:00-03:00`,
  status,
  canceled_at: null,
  cancellation_reason: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
});

const shift = (start: string, end: string): Row => ({
  id: `h-${start}`,
  owner_id: 'user-1',
  weekday: 4,
  start_time: `${start}:00`,
  end_time: `${end}:00`,
});

const T01 = [
  ap('a1', 'Ana Souza', 'Corte', '08:30', '09:30', 'concluido'),
  ap('a2', 'Bia Lopes', 'Barba', '09:30', '10:30', 'concluido'),
  ap('a3', 'Caio Dias', 'Corte', '10:30', '11:00', 'concluido'),
  ap('a4', 'Davi Nunes', 'Corte', '11:00', '12:00', 'nao_compareceu'),
  ap('a5', 'Juliana Rocha', 'Escova e hidratação', '14:00', '15:00'),
  ap('a6', 'Mariana Lima', 'Unhas em gel', '15:00', '16:00'),
  ap('a7', 'Roberto Alves', 'Corte', '16:00', '17:00', 'cancelado'),
  ap('a8', 'Fernanda Costa', 'Coloração', '17:00', '18:00'),
];

function Where() {
  const loc = useLocation();
  return <output data-testid="loc">{loc.search}</output>;
}

function Switchable({ status }: { status: AppointmentStatus[] | null }) {
  const [date, setDate] = useState('2026-10-29');
  return (
    <>
      <button onClick={() => setDate('2026-10-28')}>ir para 28</button>
      <button onClick={() => setDate('2026-10-29')}>ir para 29</button>
      <DayView date={date} tz={TZ} status={status} />
    </>
  );
}

function setup(
  opts: {
    rows?: Row[];
    status?: AppointmentStatus[] | null;
    date?: string;
    switchable?: boolean;
  } = {},
) {
  setViewportWidth(390);
  const fake = createFakeSupabase({
    session: makeSession(),
    tables: {
      profiles: [{ id: 'user-1', timezone: TZ, default_view: 'dia', slot_interval_minutes: 30 }],
      business_hours: [shift('08:30', '12:00'), shift('13:00', '18:00')],
      appointments: opts.rows ?? T01,
    },
  });
  return renderWithProviders(null, {
    supabase: fake,
    route: '/agenda?visao=dia&data=2026-10-29',
    routes: [
      {
        path: '/agenda',
        element: (
          <NewAppointmentProvider
            renderForm={({ prefill }) => (
              <output data-testid="prefill">{JSON.stringify(prefill)}</output>
            )}
          >
            {opts.switchable ? (
              <Switchable status={opts.status ?? null} />
            ) : (
              <DayView date={opts.date ?? '2026-10-29'} tz={TZ} status={opts.status ?? null} />
            )}
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

describe('DayView', () => {
  it('mostra o resumo, o horário livre, o próximo e a linha do agora (dados do T01)', async () => {
    setup();
    expect(await screen.findByText(/7 atendimentos/)).toBeInTheDocument();
    expect(screen.getByText('Agora · 13:40')).toBeInTheDocument();

    const free = screen.getByRole('button', { name: /13:00.*Horário livre/ });
    expect(free).toHaveTextContent('Toque para agendar');

    const juliana = screen.getByRole('button', { name: /Juliana Rocha/ });
    expect(within(juliana).getByText('Próximo')).toBeInTheDocument();
    expect(screen.getAllByText('Próximo')).toHaveLength(1);
  });

  it('recolhe os já realizados de hoje e expande ao tocar', async () => {
    const user = userEvent.setup();
    setup();
    const toggle = await screen.findByRole('button', { name: /4 já realizados \(08:30 – 12:00\)/ });
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument();
    await user.click(toggle);
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Davi Nunes')).toBeInTheDocument();
  });

  it('mostra a linha do almoço e o cancelado dentro de um livre', async () => {
    setup();
    expect(await screen.findByText('12:00 – 13:00 · Almoço')).toBeInTheDocument();
    const free = screen.getByRole('button', { name: /16:00.*Horário livre/ });
    expect(within(free).getByText('Roberto Alves')).toHaveClass('line-through');
    expect(free).toHaveTextContent('cancelou');
    // não vira cartão separado
    expect(screen.queryByRole('button', { name: /Roberto Alves.*Cancelado/ })).toBeNull();
  });

  it('horário livre abre o formulário com data e início', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('button', { name: /16:00.*Horário livre/ }));
    expect(screen.getByTestId('prefill')).toHaveTextContent(
      JSON.stringify({ date: '2026-10-29', startTime: '16:00' }),
    );
  });

  it('clicar no cartão abre os detalhes (?atendimento=id) mantendo os demais parâmetros', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('button', { name: /Mariana Lima/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent(
      '?visao=dia&data=2026-10-29&atendimento=a6',
    );
  });

  it('Review Focus 1: fuso do perfil manda, mesmo com "agora" em UTC e navegador em Lisboa', async () => {
    vi.setSystemTime(new Date('2026-10-29T16:40:00Z'));
    setup();
    const juliana = await screen.findByRole('button', { name: /Juliana Rocha/ });
    expect(juliana).toHaveTextContent('14:00');
    expect(juliana).toHaveTextContent('15:00');
    expect(screen.getByText('Agora · 13:40')).toBeInTheDocument();
  });

  it('Review Focus 4: <script> aparece como texto; nome longo é truncado com title', async () => {
    const long = 'M'.repeat(120);
    setup({
      rows: [
        ap('x1', '<script>alert(1)</script>', 'Corte', '14:00', '15:00'),
        ap('x2', long, 'Corte', '15:00', '16:00'),
      ],
    });
    expect(await screen.findByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    const el = screen.getByText(long);
    expect(el).toHaveClass('truncate');
    expect(el).toHaveAttribute('title', long);
  });

  it('filtro Cancelados esconde os demais cartões', async () => {
    setup({ status: ['cancelado'] });
    expect(await screen.findByText('Roberto Alves')).toBeInTheDocument();
    expect(screen.queryByText('Juliana Rocha')).not.toBeInTheDocument();
    expect(screen.queryByText('Fernanda Costa')).not.toBeInTheDocument();
  });

  it('em outro dia não recolhe nem mostra a linha do agora', async () => {
    setup({
      date: '2026-10-28',
      rows: [ap('y1', 'Zeca', 'Corte', '10:00', '11:00', 'concluido')].map((r) => ({
        ...r,
        starts_at: '2026-10-28T10:00:00-03:00',
        ends_at: '2026-10-28T11:00:00-03:00',
      })),
    });
    expect(await screen.findByText('Zeca')).toBeInTheDocument();
    expect(screen.queryByText(/Agora ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/já realizados/)).not.toBeInTheDocument();
  });
});

describe('DayView (correções da revisão da Task 11)', () => {
  it('"1 já realizado" no singular', async () => {
    setup({ rows: [ap('s1', 'Solo', 'Corte', '08:30', '09:30', 'concluido')] });
    expect(
      await screen.findByRole('button', { name: /^1 já realizado \(08:30 – 09:30\)/ }),
    ).toBeInTheDocument();
  });

  it('às 13:58 o livre 13:00–14:00 some; às 13:52 o prefill é 13:55', async () => {
    vi.setSystemTime(new Date('2026-10-29T13:58:00-03:00'));
    const first = setup();
    await screen.findByText(/7 atendimentos/);
    expect(screen.queryByRole('button', { name: /13:00.*Horário livre/ })).toBeNull();
    first.unmount();

    vi.setSystemTime(new Date('2026-10-29T13:52:00-03:00'));
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('button', { name: /13:00.*Horário livre/ }));
    expect(screen.getByTestId('prefill')).toHaveTextContent(
      JSON.stringify({ date: '2026-10-29', startTime: '13:55' }),
    );
  });

  it('o "já realizados" volta recolhido ao trocar de data e voltar', async () => {
    const user = userEvent.setup();
    setup({ switchable: true });
    const toggle = await screen.findByRole('button', { name: /4 já realizados/ });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'ir para 28' }));
    await user.click(screen.getByRole('button', { name: 'ir para 29' }));
    expect(await screen.findByRole('button', { name: /4 já realizados/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
