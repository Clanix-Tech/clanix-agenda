import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, setViewportWidth } from '@/test/render';
import { createFakeSupabase, makeSession, type Row } from '@/test/fakeSupabase';
import { NewAppointmentProvider } from '@/features/appointments/components/NewAppointmentProvider';
import { ListView } from './ListView';

const NOW = new Date('2026-10-29T13:40:00-03:00');

const ap = (id: string, name: string, service: string, day: string, start: string): Row => ({
  id,
  owner_id: 'user-1',
  client_name: name,
  client_phone: null,
  service_name: service,
  notes: null,
  starts_at: `2026-${day}T${start}:00-03:00`,
  ends_at: `2026-${day}T${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}:${start.slice(3)}:00-03:00`,
  status: 'agendado',
  canceled_at: null,
  cancellation_reason: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
});

function setup(rows: Row[]) {
  setViewportWidth(390);
  const fake = createFakeSupabase({
    session: makeSession(),
    tables: { profiles: [{ id: 'user-1', timezone: 'America/Sao_Paulo' }], appointments: rows },
  });
  return renderWithProviders(null, {
    supabase: fake,
    route: '/agenda?visao=lista',
    routes: [
      {
        path: '/agenda',
        element: (
          <NewAppointmentProvider renderForm={() => <p>formulário aberto</p>}>
            <ListView date="2026-10-29" tz="America/Sao_Paulo" status={null} />
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

const rows = [
  ap('1', 'Juliana Rocha', 'Escova', '10-29', '14:00'),
  ap('2', 'Mariana Lima', 'Unhas em gel', '10-30', '09:00'),
  ap('3', 'José Álvares', 'Coloração', '10-31', '10:00'),
  ap('4', 'Longe Demais', 'Corte', '12-30', '10:00'),
];

describe('ListView', () => {
  it('agrupa por dia (Hoje, Amanhã, depois dia da semana) e ignora o que passa de 30 dias', async () => {
    setup(rows);
    expect(await screen.findByText('Hoje · qui 29/10')).toBeInTheDocument();
    expect(screen.getByText('Amanhã · sex 30/10')).toBeInTheDocument();
    expect(screen.getByText('Sáb 31/10')).toBeInTheDocument();
    expect(screen.queryByText('Longe Demais')).not.toBeInTheDocument();
  });

  it('busca por cliente ou serviço, sem diferenciar maiúsculas ou acentos', async () => {
    const user = userEvent.setup();
    setup(rows);
    await screen.findByText('Juliana Rocha');
    await user.type(screen.getByRole('searchbox'), 'jose alvares');
    expect(screen.getByText('José Álvares')).toBeInTheDocument();
    expect(screen.queryByText('Juliana Rocha')).not.toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'COLORACAO');
    expect(screen.getByText('José Álvares')).toBeInTheDocument();
  });

  it('vazio mostra mensagem e botão para novo agendamento', async () => {
    const user = userEvent.setup();
    setup([]);
    expect(await screen.findByText('Nenhum atendimento por aqui.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Novo agendamento' }));
    expect(screen.getByText('formulário aberto')).toBeInTheDocument();
  });

  it('nome com <script> é texto e nome longo é truncado com title', async () => {
    const long = 'N'.repeat(120);
    setup([
      ap('1', '<script>alert(1)</script>', 'Corte', '10-29', '14:00'),
      ap('2', long, 'Corte', '10-29', '16:00'),
    ]);
    expect(await screen.findByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText(long)).toHaveClass('truncate');
    expect(screen.getByText(long)).toHaveAttribute('title', long);
  });
});
