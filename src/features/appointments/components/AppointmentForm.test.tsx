import { useState } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { renderWithProviders, setViewportWidth } from '@/test/render';
import { createFakeSupabase, makeSession, type Row } from '@/test/fakeSupabase';
import type { Appointment } from '../api';
import { AppointmentForm } from './AppointmentForm';

// Permite simular uma falha inesperada ao montar o input no envio (horas diferentes de 00:00).
const timeFlags = vi.hoisted(() => ({ throwOnBuild: false }));
vi.mock('@/lib/time', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/time')>();
  return {
    ...mod,
    localToInstant: (date: string, time: string, tz: string) => {
      if (timeFlags.throwOnBuild && time !== '00:00') throw new RangeError('Data ou hora inválida');
      return mod.localToInstant(date, time, tz);
    },
  };
});

vi.mock('sonner', async (importOriginal) => {
  const mod = await importOriginal<typeof import('sonner')>();
  return { ...mod, toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) };
});

// Segunda, 02/11/2026, 09:00 em São Paulo (12:00 UTC). O navegador do teste está em Lisboa.
const NOW = new Date('2026-11-02T12:00:00Z');

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

const hours = [
  { id: 'h1', owner_id: 'user-1', weekday: 1, start_time: '08:00:00', end_time: '12:00:00' },
  { id: 'h2', owner_id: 'user-1', weekday: 1, start_time: '13:00:00', end_time: '19:00:00' },
];

const favorites = [
  { id: 'f1', name: 'Manicure', duration_minutes: 45, color: null, is_active: true },
  { id: 'f2', name: 'Escova', duration_minutes: 60, color: null, is_active: true },
  { id: 'f3', name: 'Antigo', duration_minutes: 30, color: null, is_active: false },
];

const appt = (over: Partial<Appointment> = {}): Appointment => ({
  id: 'ap-1',
  owner_id: 'user-1',
  client_name: 'Ana',
  client_phone: null,
  service_name: 'Escova',
  notes: null,
  starts_at: '2026-11-02T13:00:00+00:00',
  ends_at: '2026-11-02T14:00:00+00:00',
  status: 'agendado',
  canceled_at: null,
  cancellation_reason: null,
  created_at: '2026-10-01T00:00:00Z',
  reminder_anchor_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  ...over,
});

type Rpc = Record<string, (args: unknown) => { data?: unknown; error?: unknown }>;

function setup(
  opts: {
    rpc?: Rpc;
    appointments?: Appointment[];
    mode?: 'create' | 'edit';
    appointment?: Appointment;
    prefill?: { date?: string; startTime?: string };
  } = {},
) {
  const fake = createFakeSupabase({
    session: makeSession(),
    rpc: opts.rpc ?? { create_appointment: () => ({ data: appt({ id: 'novo' }) }) },
    tables: {
      profiles: [profile as Row],
      business_hours: hours,
      favorite_services: favorites,
      appointments: (opts.appointments ?? []) as unknown as Row[],
    },
  });
  function Harness() {
    const [open, setOpen] = useState(true);
    if (!open) return <p>fechado</p>;
    return opts.mode === 'edit' ? (
      <AppointmentForm mode="edit" appointment={opts.appointment!} onDone={() => setOpen(false)} />
    ) : (
      <AppointmentForm mode="create" prefill={opts.prefill} onDone={() => setOpen(false)} />
    );
  }
  const r = renderWithProviders(<Harness />, { supabase: fake });
  return { ...r, fake };
}

const user = () => userEvent.setup();

async function ready() {
  return (await screen.findByLabelText('Nome do cliente')) as HTMLInputElement;
}

function setField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const startInput = () => screen.getByLabelText('Início') as HTMLInputElement;
const saveButton = () => screen.getByRole('button', { name: /Salvar agendamento|Salvando…/ });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setViewportWidth(390);
  vi.mocked(toast.success).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  timeFlags.throwOnBuild = false;
});

describe('AppointmentForm (novo)', () => {
  it('abre com hoje no fuso do perfil e o próximo horário livre', async () => {
    setup();
    await ready();
    expect(screen.getByLabelText('Data')).toHaveValue('2026-11-02');
    await waitFor(() => expect(startInput()).toHaveValue('09:00'));
    expect(startInput()).toHaveAttribute('step', '1800');
    expect(screen.getByLabelText('Duração')).toHaveValue('60');
  });

  it('usa o prefill de data e início', async () => {
    setup({ prefill: { date: '2026-11-03', startTime: '15:30' } });
    await ready();
    expect(screen.getByLabelText('Data')).toHaveValue('2026-11-03');
    expect(startInput()).toHaveValue('15:30');
  });

  it('escolher o favorito "Manicure 45 min" com início 13:00 mostra "Termina às 13:45"', async () => {
    setup();
    await ready();
    expect(screen.queryByRole('button', { name: /Antigo/ })).not.toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Manicure 45 min' }));
    setField('Início', '13:00');
    expect(screen.getByRole('button', { name: 'Manicure 45 min' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText('Duração')).toHaveValue('45');
    expect(screen.getByText('Termina às').parentElement).toHaveTextContent('13:45');
    expect(await screen.findByText('Horário livre, dentro do expediente')).toBeInTheDocument();
  });

  it('as opções de duração juntam favorito, padrão e a lista fixa, sem repetir', async () => {
    setup();
    await ready();
    const labels = () =>
      Array.from((screen.getByLabelText('Duração') as HTMLSelectElement).options).map(
        (o) => o.text,
      );
    expect(labels()).toEqual(['15 min', '30 min', '45 min', '1 hora', '1h30', '2 horas']);
  });

  it('"Outro" libera o campo de texto do serviço', async () => {
    setup();
    await ready();
    expect(screen.queryByLabelText('Nome do serviço')).not.toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Outro' }));
    await user().type(screen.getByLabelText('Nome do serviço'), 'Sobrancelha');
    expect(screen.getByLabelText('Nome do serviço')).toHaveValue('Sobrancelha');
  });

  it('fora do expediente mostra o aviso âmbar e ainda permite salvar', async () => {
    setup();
    await ready();
    setField('Início', '12:00');
    expect(await screen.findByText('Fora do seu expediente')).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it('conflito mostra "Esse horário já está ocupado" e sugestões; clicar em 16:00 preenche o início', async () => {
    setup({
      appointments: [
        appt({
          id: 'a1',
          client_name: 'Juliana Rocha',
          starts_at: '2026-11-02T17:00:00Z',
          ends_at: '2026-11-02T18:00:00Z',
        }),
        appt({
          id: 'a2',
          client_name: 'Mariana Lima',
          starts_at: '2026-11-02T18:00:00Z',
          ends_at: '2026-11-02T19:00:00Z',
        }),
        // Cancelado não ocupa (RN05): 16:00 continua livre.
        appt({
          id: 'a3',
          client_name: 'Bia',
          status: 'cancelado',
          starts_at: '2026-11-02T19:00:00Z',
          ends_at: '2026-11-02T20:00:00Z',
        }),
      ],
    });
    await ready();
    setField('Início', '14:30');
    await screen.findByText('Esse horário já está ocupado');
    // Calculado pelo app: região educada (status), não alerta.
    const box = screen.getByText('Esse horário já está ocupado').closest('[role]')!;
    expect(box).toHaveAttribute('role', 'status');
    expect(box).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(box).toHaveTextContent('Juliana Rocha (14:00–15:00)');
    expect(box).toHaveTextContent('Mariana Lima (15:00–16:00)');
    expect(box).not.toHaveTextContent('Bia');
    expect(screen.getByText('Livres em 02/11 para 1 hora')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(saveButton()).toHaveAccessibleDescription(/Esse horário já está ocupado/);
    await user().click(screen.getByRole('button', { name: /^16:00/ }));
    expect(startInput()).toHaveValue('16:00');
    expect(startInput()).toHaveFocus();
    expect(await screen.findByText('Horário livre, dentro do expediente')).toBeInTheDocument();
    expect(screen.queryByText('Esse horário já está ocupado')).not.toBeInTheDocument();
  });

  it('RN18: conflito vindo de cache velho é conferido de novo; sem conflito fresco, Salvar libera', async () => {
    const { fake } = setup({
      appointments: [
        appt({
          id: 'a1',
          client_name: 'Juliana Rocha',
          starts_at: '2026-11-02T17:00:00Z',
          ends_at: '2026-11-02T18:00:00Z',
        }),
      ],
    });
    const name = await ready();
    await user().type(name, 'Ana');
    await user().click(screen.getByRole('button', { name: 'Escova 1h' }));
    await waitFor(() => expect(startInput()).toHaveValue('09:00'));
    // Outro aparelho cancelou depois que o dia entrou no cache.
    fake.tables.appointments![0]!.status = 'cancelado';

    setField('Início', '14:30');
    expect(screen.getByText(/Verificando…/)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(await screen.findByText('Horário livre, dentro do expediente')).toBeInTheDocument();
    expect(screen.queryByText('Esse horário já está ocupado')).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
    expect(saveButton()).not.toHaveAttribute('aria-describedby');
  });

  it('"Verificar de novo" busca o dia outra vez e libera quando o conflito sumiu', async () => {
    const { fake } = setup({
      appointments: [
        appt({
          id: 'a1',
          client_name: 'Juliana Rocha',
          starts_at: '2026-11-02T17:00:00Z',
          ends_at: '2026-11-02T18:00:00Z',
        }),
      ],
    });
    await ready();
    setField('Início', '14:30');
    expect(await screen.findByText('Esse horário já está ocupado')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    fake.tables.appointments![0]!.status = 'cancelado';
    await user().click(screen.getByRole('button', { name: 'Verificar de novo' }));
    expect(await screen.findByText('Horário livre, dentro do expediente')).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it('RPC devolve AE001 → ConflictPanel aparece e os campos continuam preenchidos', async () => {
    setup({ rpc: { create_appointment: () => ({ error: { code: 'AE001' } }) } });
    const name = await ready();
    await user().type(name, 'Ana');
    await user().click(screen.getByRole('button', { name: 'Escova 1h' }));
    setField('Início', '10:00');
    await user().click(saveButton());
    // Recusa do servidor (AE001): alerta.
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Esse horário já está ocupado'),
    );
    expect(screen.getByText('Livres em 02/11 para 1 hora')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^09:30/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome do cliente')).toHaveValue('Ana');
    expect(startInput()).toHaveValue('10:00');
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByText('fechado')).not.toBeInTheDocument();
  });

  it('Review Focus 3: dois cliques / Enter repetido em "Salvar agendamento" → 1 chamada', async () => {
    const { fake } = setup();
    const name = await ready();
    await user().type(name, 'Ana');
    await user().click(screen.getByRole('button', { name: 'Escova 1h' }));
    await waitFor(() => expect(startInput()).toHaveValue('09:00'));
    const button = saveButton();
    fireEvent.click(button);
    expect(button).toHaveTextContent('Salvando…');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    fireEvent.submit(name.form!);
    fireEvent.submit(name.form!);
    expect(await screen.findByText('fechado')).toBeInTheDocument();
    expect(fake.calls.rpc.filter((c) => c.name === 'create_appointment')).toHaveLength(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Agendamento salvo');
  });

  it('envia instantes com offset do fuso do perfil e campos aparados', async () => {
    const { fake } = setup();
    const name = await ready();
    await user().type(name, 'Ana');
    await user().type(screen.getByLabelText(/Telefone/), ' 11 98888-7777 ');
    setField('Início', '10:00');
    await user().click(screen.getByRole('button', { name: 'Escova 1h' }));
    await user().click(saveButton());
    await screen.findByText('fechado');
    expect(fake.calls.rpc[0]).toEqual({
      name: 'create_appointment',
      args: {
        p_client_name: 'Ana',
        p_service_name: 'Escova',
        p_starts_at: '2026-11-02T10:00:00-03:00',
        p_ends_at: '2026-11-02T11:00:00-03:00',
        p_client_phone: '11 98888-7777',
        p_notes: null,
        p_confirm_past: false,
      },
    });
  });

  it('mostra erros por campo ligados por aria-describedby', async () => {
    const { fake } = setup();
    await ready();
    await user().click(saveButton());
    const name = screen.getByLabelText('Nome do cliente');
    expect(await screen.findByText('Informe o nome do cliente')).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('Informe o nome do cliente');
    expect(screen.getByText('Informe o serviço')).toBeInTheDocument();
    expect(fake.calls.rpc).toHaveLength(0);
    // Depois da validação o botão volta a funcionar.
    expect(saveButton()).toBeEnabled();
  });

  it('Review Focus 2: falha de rede não vira "salvo"; "Tentar novamente" reenvia o mesmo input', async () => {
    let n = 0;
    const { fake } = setup({
      rpc: {
        create_appointment: () =>
          ++n === 1 ? { error: new TypeError('Failed to fetch') } : { data: appt({ id: 'novo' }) },
      },
    });
    const name = await ready();
    await user().type(name, 'Ana');
    setField('Início', '10:00');
    await user().click(screen.getByRole('button', { name: 'Manicure 45 min' }));
    await user().type(screen.getByLabelText(/Observações/), 'Unha curta');
    await user().click(saveButton());
    expect(
      await screen.findByText('Sem conexão. Nada foi salvo — tente novamente.'),
    ).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nome do cliente')).toHaveValue('Ana');
    expect(startInput()).toHaveValue('10:00');
    expect(screen.getByLabelText(/Observações/)).toHaveValue('Unha curta');
    expect(screen.queryByText('fechado')).not.toBeInTheDocument();

    await user().click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('fechado')).toBeInTheDocument();
    expect(fake.calls.rpc).toHaveLength(2);
    expect(fake.calls.rpc[1]).toEqual(fake.calls.rpc[0]);
    expect(toast.success).toHaveBeenCalledWith('Agendamento salvo');
  });

  it('Review Focus 2 + RN17: retry que recebe AE001 reconhece o próprio agendamento', async () => {
    let n = 0;
    const { fake } = setup({
      rpc: {
        create_appointment: () => {
          if (++n === 1) {
            // A 1ª tentativa gravou, mas a resposta se perdeu.
            fake.tables.appointments!.push(
              appt({
                id: 'gravado',
                client_name: 'Ana',
                service_name: 'Manicure',
                starts_at: '2026-11-02T10:00:00-03:00',
                ends_at: '2026-11-02T10:45:00-03:00',
                created_at: new Date().toISOString(),
              }) as unknown as Row,
            );
            return { error: new TypeError('Failed to fetch') };
          }
          return { error: { code: 'AE001' } };
        },
      },
    });
    const name = await ready();
    await user().type(name, 'Ana');
    setField('Início', '10:00');
    await user().click(screen.getByRole('button', { name: 'Manicure 45 min' }));
    await user().click(saveButton());
    await screen.findByText('Sem conexão. Nada foi salvo — tente novamente.');
    await user().click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('fechado')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Agendamento salvo');
  });

  it('outros erros do servidor aparecem em role="alert" sem fechar', async () => {
    setup({ rpc: { create_appointment: () => ({ error: { code: 'AE002', hint: 'segredo' } }) } });
    const name = await ready();
    await user().type(name, 'Ana');
    await user().click(screen.getByRole('button', { name: 'Escova 1h' }));
    await user().click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esse horário está fora do seu expediente.',
    );
    expect(screen.queryByText(/segredo/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
  });

  it('início no passado sem confirmação → Salvar desabilitado; marcando → envia p_confirm_past: true', async () => {
    const { fake } = setup();
    const name = await ready();
    await user().type(name, 'Ana');
    await user().click(screen.getByRole('button', { name: 'Escova 1h' }));
    setField('Início', '08:00');
    const check = await screen.findByRole('checkbox', {
      name: 'Este é um registro de atendimento que já aconteceu',
    });
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText(/Esse horário já passou/)).toBeInTheDocument();
    expect(screen.queryByText('Fora do seu expediente')).not.toBeInTheDocument();
    await user().click(check);
    expect(saveButton()).toBeEnabled();
    await user().click(saveButton());
    await screen.findByText('fechado');
    expect(fake.calls.rpc[0]?.args).toMatchObject({
      p_starts_at: '2026-11-02T08:00:00-03:00',
      p_confirm_past: true,
    });
  });

  it('RN13 no envio: o início passou entre a tela e o clique → não envia e pede a confirmação', async () => {
    const { fake } = setup();
    const name = await ready();
    await user().type(name, 'Ana');
    await user().click(screen.getByRole('button', { name: 'Escova 1h' }));
    setField('Início', '09:30');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();

    // 09:31 em São Paulo: 09:30 já passou, mas a tela ainda não sabe.
    vi.setSystemTime(new Date('2026-11-02T12:31:00Z'));
    await user().click(saveButton());
    const check = await screen.findByRole('checkbox', {
      name: 'Este é um registro de atendimento que já aconteceu',
    });
    expect(fake.calls.rpc).toHaveLength(0);
    expect(saveButton()).toBeDisabled();
    expect(saveButton()).toHaveTextContent('Salvar agendamento');
    expect(saveButton()).toHaveAccessibleDescription(/Esse horário já passou/);

    await user().click(check);
    await user().click(saveButton());
    await screen.findByText('fechado');
    expect(fake.calls.rpc[0]?.args).toMatchObject({ p_confirm_past: true });
  });

  it('falha inesperada ao montar o envio libera o botão e mostra "Algo deu errado"', async () => {
    const { fake } = setup();
    const name = await ready();
    await user().type(name, 'Ana');
    await user().click(screen.getByRole('button', { name: 'Escova 1h' }));
    setField('Início', '10:00');
    timeFlags.throwOnBuild = true;
    await user().click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo deu errado. Tente novamente.');
    expect(saveButton()).toHaveTextContent('Salvar agendamento');
    expect(saveButton()).toBeEnabled();
    expect(fake.calls.rpc).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
  });

  it('a caixa de confirmação some quando o início volta a ser futuro', async () => {
    setup();
    await ready();
    setField('Início', '08:00');
    expect(
      await screen.findByRole('checkbox', {
        name: 'Este é um registro de atendimento que já aconteceu',
      }),
    ).toBeInTheDocument();
    setField('Início', '10:00');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('cruzar 1024 px com o formulário aberto preserva o que foi digitado', async () => {
    setViewportWidth(1280);
    setup();
    const name = await ready();
    await user().type(name, 'Patrícia');
    await user().click(screen.getByRole('button', { name: 'Manicure 45 min' }));
    setField('Início', '13:00');
    expect(document.querySelector('[data-slot="dialog-content"]')).not.toBeNull();

    act(() => setViewportWidth(390));
    expect(document.querySelector('[data-slot="drawer-content"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
    expect(screen.getByLabelText('Nome do cliente')).toHaveValue('Patrícia');
    expect(startInput()).toHaveValue('13:00');
    expect(screen.getByLabelText('Duração')).toHaveValue('45');
    expect(screen.getByRole('button', { name: 'Manicure 45 min' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    act(() => setViewportWidth(1280));
    expect(document.querySelector('[data-slot="dialog-content"]')).not.toBeNull();
    expect(screen.getByLabelText('Nome do cliente')).toHaveValue('Patrícia');
  });

  it('Cancelar fecha sem salvar', async () => {
    const { fake } = setup();
    await ready();
    await user().click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('fechado')).toBeInTheDocument();
    expect(fake.calls.rpc).toHaveLength(0);
  });
});

describe('AppointmentForm (editar)', () => {
  const existing = appt({
    id: 'ap-9',
    client_name: 'Ana',
    service_name: 'Escova',
    client_phone: '11 99999-0000',
    notes: 'Cabelo longo',
    starts_at: '2026-11-03T13:00:00Z',
    ends_at: '2026-11-03T14:00:00Z',
  });

  it('só mostra nome, telefone, serviço e observações', async () => {
    setup({ mode: 'edit', appointment: existing });
    await ready();
    expect(screen.getByRole('dialog', { name: 'Editar agendamento' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome do cliente')).toHaveValue('Ana');
    expect(screen.getByRole('button', { name: 'Escova 1h' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByLabelText('Data')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Início')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Duração')).not.toBeInTheDocument();
  });

  it('serviço que não é favorito abre em "Outro" com o texto', async () => {
    setup({ mode: 'edit', appointment: { ...existing, service_name: 'Hidratação' } });
    await ready();
    expect(screen.getByLabelText('Nome do serviço')).toHaveValue('Hidratação');
  });

  it('modo edit envia update_appointment_details com os 5 parâmetros', async () => {
    const { fake } = setup({
      mode: 'edit',
      appointment: existing,
      rpc: { update_appointment_details: () => ({ data: existing }) },
    });
    const name = await ready();
    await user().clear(name);
    await user().type(name, 'Ana Paula');
    await user().click(screen.getByRole('button', { name: 'Manicure 45 min' }));
    await user().click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await screen.findByText('fechado');
    expect(fake.calls.rpc).toEqual([
      {
        name: 'update_appointment_details',
        args: {
          p_id: 'ap-9',
          p_client_name: 'Ana Paula',
          p_service_name: 'Manicure',
          p_client_phone: '11 99999-0000',
          p_notes: 'Cabelo longo',
        },
      },
    ]);
    expect(toast.success).toHaveBeenCalledWith('Agendamento salvo');
  });
});
