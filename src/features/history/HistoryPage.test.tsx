import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { renderWithProviders, setViewportWidth } from '@/test/render';
import { createFakeSupabase, makeSession, type Row } from '@/test/fakeSupabase';
import type { AppointmentStatus } from '@/features/appointments/domain/status';
import HistoryPage from './HistoryPage';
import { likePattern } from './useHistorySearch';

const NOW = new Date('2026-11-04T10:00:00-03:00');

const ap = (
  id: string,
  name: string,
  day: string,
  start = '09:00',
  status: AppointmentStatus = 'agendado',
  extra: Row = {},
): Row => ({
  id,
  owner_id: 'user-1',
  client_name: name,
  client_phone: null,
  service_name: 'Corte',
  notes: null,
  starts_at: `${day}T${start}:00-03:00`,
  ends_at: `${day}T${start.slice(0, 2)}:59:00-03:00`,
  status,
  canceled_at: null,
  cancellation_reason: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  ...extra,
});

const ANA_NAMES = ['Ana Souza', 'Mariana Lima', 'Ana Paula', 'Joana Reis', 'Anabela Cruz', 'Diana'];
const BASE: Row[] = [
  ...ANA_NAMES.map((n, i) =>
    ap(`ana-${i}`, n, '2026-11-04', `${String(8 + i).padStart(2, '0')}:00`),
  ),
  ap('bruno', 'Bruno Alves', '2026-11-05', '09:00', 'cancelado', {
    service_name: 'Barba',
    cancellation_reason: 'Cliente desistiu',
  }),
  ap('carla', 'Carla Dias', '2026-11-06', '10:00', 'concluido', { service_name: 'Barba' }),
  ap('antiga', 'Ana Antiga', '2026-01-10'),
  ap('pct', '50%_off Cliente', '2026-11-07'),
  ap('pct2', '500xoff Cliente', '2026-11-07', '11:00'),
];

function Where() {
  const loc = useLocation();
  return <output data-testid="loc">{loc.pathname + loc.search}</output>;
}

function setup(
  opts: {
    route?: string;
    rows?: Row[];
    history?: Row[];
    width?: number;
    errors?: Record<string, Partial<Record<'select', unknown>>>;
  } = {},
) {
  setViewportWidth(opts.width ?? 1280);
  const fake = createFakeSupabase({
    session: makeSession(),
    tables: {
      profiles: [
        { id: 'user-1', timezone: 'America/Sao_Paulo', display_name: 'Marina', week_starts_on: 1 },
      ],
      favorite_services: [
        {
          id: 'f1',
          owner_id: 'user-1',
          name: 'Corte',
          duration_minutes: 30,
          color: null,
          is_active: true,
        },
        {
          id: 'f2',
          owner_id: 'user-1',
          name: 'Barba',
          duration_minutes: 30,
          color: null,
          is_active: false,
        },
      ],
      appointments: opts.rows ?? BASE,
      appointment_history: opts.history ?? [],
    },
    errors: opts.errors,
  });
  return renderWithProviders(null, {
    supabase: fake,
    route: opts.route ?? '/historico',
    routes: [
      {
        path: '*',
        element: (
          <>
            <HistoryPage />
            <Where />
          </>
        ),
      },
    ],
  });
}

const loc = () => screen.getByTestId('loc').textContent ?? '';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('likePattern', () => {
  it('escapa barra, % e _ e envolve com %', () => {
    expect(likePattern('50%_off')).toBe('%50\\%\\_off%');
    expect(likePattern('a\\b')).toBe('%a\\\\b%');
  });
});

describe('HistoryPage: busca', () => {
  it('q=ana mostra 6 resultados e destaca o termo em <mark>', async () => {
    const { container } = setup({ route: '/historico?q=ana' });
    expect(await screen.findByText('6 resultados')).toBeInTheDocument();
    const marks = [...container.querySelectorAll('mark')].map((m) => m.textContent);
    expect(marks).toHaveLength(6);
    expect(marks).toContain('Ana');
    expect(marks).toContain('ana');
  });

  it('mostra o nome literalmente, sem interpretar HTML', async () => {
    const { container } = setup({
      route: '/historico?q=script',
      rows: [ap('x', '<script>alert(1)</script>', '2026-11-04')],
    });
    await screen.findByText('1 resultado');
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });

  it('o termo 50%_off casa só o literal, não 500xoff', async () => {
    setup({ route: '/historico?q=50%25_off' });
    expect(await screen.findByText('1 resultado')).toBeInTheDocument();
    expect(document.body.textContent).toContain('50%_off Cliente');
    expect(document.body.textContent).not.toContain('500xoff');
  });

  it('período padrão: 30 dias antes até 30 depois; "De" amplia', async () => {
    setup({ route: '/historico?q=ana' });
    await screen.findByText('6 resultados');
    expect(screen.queryByText('Ana Antiga')).toBeNull();
    expect(screen.getByLabelText('De')).toHaveValue('2026-10-05');
    expect(screen.getByLabelText('Até')).toHaveValue('2026-12-04');
  });

  it('período no URL inclui atendimentos antigos', async () => {
    setup({ route: '/historico?q=ana&de=2026-01-01' });
    expect(await screen.findByText('7 resultados')).toBeInTheDocument();
  });

  it('filtra por status e por serviço', async () => {
    setup({ route: '/historico?status=cancelado' });
    expect(await screen.findByText('1 resultado')).toBeInTheDocument();
    expect(screen.getByText('Bruno Alves')).toBeInTheDocument();
  });

  it('filtra por serviço pelo select (lista favoritos ativos e inativos)', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('10 resultados');
    const select = screen.getByLabelText('Serviço');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Todos os serviços', 'Barba', 'Corte']);
    await user.selectOptions(select, 'Barba');
    expect(await screen.findByText('2 resultados')).toBeInTheDocument();
    expect(loc()).toContain('servico=Barba');
  });

  it('digitar na busca atualiza o URL só depois de 300 ms', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('10 resultados');
    await user.type(screen.getByRole('searchbox', { name: /cliente/i }), 'carla');
    expect(loc()).not.toContain('q=');
    await waitFor(() => expect(loc()).toContain('q=carla'));
    expect(await screen.findByText('1 resultado')).toBeInTheDocument();
  });

  it('sem resultados: estado vazio e "Limpar filtros" restaura', async () => {
    const user = userEvent.setup();
    setup({ route: '/historico?q=zzz&status=cancelado' });
    expect(
      await screen.findByText('Nenhum atendimento encontrado com esses filtros.'),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]!);
    expect(await screen.findByText('10 resultados')).toBeInTheDocument();
    expect(loc()).toBe('/historico');
  });

  it('ver abre os detalhes', async () => {
    const user = userEvent.setup();
    setup({ route: '/historico?q=carla' });
    await screen.findByText('1 resultado');
    await user.click(screen.getByRole('button', { name: /Ver detalhes de Carla Dias/ }));
    expect(loc()).toContain('atendimento=carla');
  });

  it('erro na busca mostra mensagem e permite tentar de novo', async () => {
    setup({ errors: { appointments: { select: { code: 'XX000' } } } });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});

describe('HistoryPage: paginação', () => {
  const many = Array.from({ length: 30 }, (_, i) =>
    ap(
      `m${i}`,
      `Cliente ${String(i).padStart(2, '0')}`,
      '2026-11-04',
      `${String(i % 24).padStart(2, '0')}:00`,
    ),
  );

  it('25 por página com Anterior/Próxima', async () => {
    const user = userEvent.setup();
    setup({ rows: many });
    expect(await screen.findByText('Mostrando 1–25 de 30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await screen.findByText('Mostrando 26–30 de 30')).toBeInTheDocument();
    expect(loc()).toContain('pagina=2');
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
  });
});

describe('HistoryPage: remarcações e cancelamentos', () => {
  const entry = (id: string, appt: string, action: string, at: string): Row => ({
    id,
    owner_id: 'user-1',
    appointment_id: appt,
    action,
    actor_id: 'user-1',
    previous_values: null,
    new_values: {},
    created_at: at,
  });

  it('lista só remarcado/cancelado, com o nome do cliente, e abre os detalhes', async () => {
    const user = userEvent.setup();
    setup({
      history: [
        entry('h1', 'bruno', 'cancelado', '2026-11-03T12:00:00Z'),
        entry('h2', 'carla', 'remarcado', '2026-11-02T12:00:00Z'),
        entry('h3', 'carla', 'criado', '2026-11-01T12:00:00Z'),
      ],
    });
    const card = await screen.findByRole('region', { name: 'Remarcações e cancelamentos' });
    const items = await within(card).findAllByRole('button');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Cancelado');
    expect(items[0]).toHaveTextContent('Bruno Alves');
    expect(items[1]).toHaveTextContent('Remarcado');
    await user.click(items[0]!);
    expect(loc()).toContain('atendimento=bruno');
  });

  it('sem entradas: avisa que não há registros', async () => {
    setup();
    const card = await screen.findByRole('region', { name: 'Remarcações e cancelamentos' });
    expect(
      await within(card).findByText('Nenhuma remarcação ou cancelamento ainda.'),
    ).toBeInTheDocument();
  });
});

describe('HistoryPage: exportar CSV', () => {
  let blobs: Blob[];
  let downloads: string[];

  beforeEach(() => {
    blobs = [];
    downloads = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:fake';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
  });

  const read = (b: Blob) =>
    new Promise<{ bytes: Uint8Array; text: string }>((resolve) => {
      const r = new FileReader();
      r.onload = () => {
        const bytes = new Uint8Array(r.result as ArrayBuffer);
        resolve({ bytes, text: new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) });
      };
      r.readAsArrayBuffer(b);
    });

  it('baixa agenda-em-ordem-AAAA-MM-DD.csv com cabeçalho exato, BOM e fuso do perfil', async () => {
    const user = userEvent.setup();
    setup({
      route: '/historico?status=cancelado',
      rows: [
        ap('bruno', 'Bruno Alves', '2026-11-05', '09:00', 'cancelado', {
          client_phone: '+55 11 99999-0000',
          notes: 'Obs "ok"',
          cancellation_reason: 'Cliente desistiu',
        }),
        ap('o', 'Outro', '2026-11-05'),
      ],
    });
    await screen.findByText('1 resultado');
    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(downloads).toEqual(['agenda-em-ordem-2026-11-04.csv']));
    const { bytes, text } = await read(blobs[0]!);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = text.split('\r\n');
    expect(lines[0]).toBe(
      '\uFEFF"Data";"Início";"Fim";"Cliente";"Telefone";"Serviço";"Status";"Observações";"Motivo do cancelamento"',
    );
    expect(lines).toHaveLength(2); // respeita o filtro de status
    expect(lines[1]).toBe(
      '"05/11/2026";"09:00";"09:59";"Bruno Alves";"\'+55 11 99999-0000";"Corte";"Cancelado";"Obs ""ok""";"Cliente desistiu"',
    );
  });

  it('busca todas as páginas (mais de 1000 linhas) e neutraliza fórmulas', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 1005 }, (_, i) =>
      ap(`r${i}`, i === 0 ? '=HYPERLINK("x")' : `Cliente ${i}`, '2026-11-04', '09:00'),
    );
    setup({ rows });
    await screen.findByText('1005 resultados');
    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    const { text } = await read(blobs[0]!);
    const lines = text.split('\r\n');
    expect(lines).toHaveLength(1006);
    expect(text).toContain('"\'=HYPERLINK(""x"")"');
  });

  it('desabilita o botão e mostra "Exportando…" durante a exportação', async () => {
    setup();
    await screen.findByText('10 resultados');
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(screen.getByRole('button', { name: 'Exportando…' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled());
    expect(downloads).toHaveLength(1);
  });

  it('falha na exportação mostra a mensagem e não baixa nada', async () => {
    const user = userEvent.setup();
    const errors: Record<string, Partial<Record<'select', unknown>>> = {};
    setup({ errors });
    await screen.findByText('10 resultados');
    errors.appointments = { select: { code: '42501' } };
    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeInTheDocument();
    expect(downloads).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled();
  });
});
