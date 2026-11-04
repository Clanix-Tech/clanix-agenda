import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { renderWithProviders, setViewportWidth } from '@/test/render';
import { createFakeSupabase, makeSession } from '@/test/fakeSupabase';
import type { Appointment } from '../api';
import type { AppointmentStatus } from '../domain/status';
import { StatusActions } from './StatusActions';

vi.mock('sonner', async (importOriginal) => {
  const mod = await importOriginal<typeof import('sonner')>();
  return { ...mod, toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) };
});

const appt = (status: AppointmentStatus): Appointment => ({
  id: 'ap-1',
  owner_id: 'user-1',
  client_name: 'Ana',
  client_phone: null,
  service_name: 'Escova',
  notes: null,
  starts_at: '2026-11-02T13:00:00+00:00',
  ends_at: '2026-11-02T14:00:00+00:00',
  status,
  canceled_at: null,
  cancellation_reason: null,
  created_at: '2026-10-01T00:00:00Z',
  reminder_anchor_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
});

const ALL = [
  'Remarcar',
  'Concluir',
  'Não compareceu',
  'Editar dados',
  'Cancelar atendimento',
  'Marcar como não compareceu',
  'Marcar como concluído',
  'Voltar para agendado',
  'Reativar',
];

const EXPECTED: Array<[AppointmentStatus, string[]]> = [
  ['agendado', ['Remarcar', 'Concluir', 'Não compareceu', 'Editar dados', 'Cancelar atendimento']],
  ['concluido', ['Marcar como não compareceu', 'Voltar para agendado', 'Editar dados']],
  ['nao_compareceu', ['Marcar como concluído', 'Voltar para agendado', 'Editar dados']],
  ['cancelado', ['Reativar']],
];

type Rpc = Parameters<typeof createFakeSupabase>[0] extends infer O
  ? O extends { rpc?: infer R }
    ? R
    : never
  : never;

function setup(status: AppointmentStatus, rpc: Rpc = {}, extra: { onCreateNew?: () => void } = {}) {
  setViewportWidth(390);
  const fake = createFakeSupabase({
    session: makeSession(),
    rpc: { set_appointment_status: () => ({ data: appt('concluido') }), ...rpc },
  });
  renderWithProviders(<StatusActions appointment={appt(status)} {...extra} />, {
    supabase: fake,
  });
  return fake;
}

const rpcCalls = (fake: ReturnType<typeof createFakeSupabase>, name: string) =>
  fake.calls.rpc.filter((c) => c.name === name);

beforeEach(() => vi.mocked(toast.success).mockClear());

describe('StatusActions', () => {
  it.each(EXPECTED)('%s mostra exatamente as ações permitidas', (status, shown) => {
    setup(status);
    for (const name of ALL) {
      const found = screen.queryByRole('button', { name });
      if (shown.includes(name)) expect(found, name).toBeInTheDocument();
      else expect(found, name).not.toBeInTheDocument();
    }
  });

  it('"Cancelar atendimento" abre o diálogo e envia o motivo aparado', async () => {
    const fake = setup('agendado', { cancel_appointment: () => ({ data: appt('cancelado') }) });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancelar atendimento' }));
    const dialog = await screen.findByRole('dialog');
    const reason = within(dialog).getByLabelText('Motivo (opcional)');
    expect(reason).toHaveAttribute('maxlength', '300');
    await user.type(reason, '  Cliente desistiu  ');
    expect(within(dialog).getByText('20/300')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar atendimento' }));
    await waitFor(() => expect(rpcCalls(fake, 'cancel_appointment')).toHaveLength(1));
    expect(rpcCalls(fake, 'cancel_appointment')[0]?.args).toEqual({
      p_id: 'ap-1',
      p_reason: 'Cliente desistiu',
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('"Voltar" no diálogo de cancelamento não envia nada', async () => {
    const fake = setup('agendado');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancelar atendimento' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Voltar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(fake.calls.rpc).toHaveLength(0);
  });

  it('"Não compareceu" pede confirmação antes de enviar', async () => {
    const fake = setup('agendado', {
      set_appointment_status: () => ({ data: appt('nao_compareceu') }),
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Não compareceu' }));
    expect(fake.calls.rpc).toHaveLength(0);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Não compareceu' }));
    await waitFor(() => expect(rpcCalls(fake, 'set_appointment_status')).toHaveLength(1));
    expect(rpcCalls(fake, 'set_appointment_status')[0]?.args).toEqual({
      p_id: 'ap-1',
      p_status: 'nao_compareceu',
    });
  });

  it('"Concluir" aplica direto, com um único envio mesmo em duplo clique', async () => {
    const fake = setup('agendado');
    const concluir = screen.getByRole('button', { name: 'Concluir' });
    fireEvent.click(concluir);
    fireEvent.click(concluir);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Status atualizado'));
    expect(rpcCalls(fake, 'set_appointment_status')).toHaveLength(1);
    expect(rpcCalls(fake, 'set_appointment_status')[0]?.args).toEqual({
      p_id: 'ap-1',
      p_status: 'concluido',
    });
  });

  it('"Voltar para agendado" aplica direto', async () => {
    const fake = setup('concluido');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Voltar para agendado' }));
    await waitFor(() => expect(rpcCalls(fake, 'set_appointment_status')).toHaveLength(1));
    expect(rpcCalls(fake, 'set_appointment_status')[0]?.args).toMatchObject({
      p_status: 'agendado',
    });
  });

  it('Reativar pede confirmação e, com conflito, mostra a mensagem e o atalho de novo agendamento', async () => {
    const onCreateNew = vi.fn();
    const fake = setup(
      'cancelado',
      { reactivate_appointment: () => ({ error: { code: 'AE001', message: 'x' } }) },
      { onCreateNew },
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reativar' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reativar' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Esse horário já está ocupado. Escolha outro horário.');
    expect(rpcCalls(fake, 'reactivate_appointment')).toHaveLength(1);
    await user.click(within(alert).getByRole('button', { name: 'Criar novo agendamento' }));
    expect(onCreateNew).toHaveBeenCalled();
  });

  it('Reativar fora do expediente mostra a mensagem do contrato', async () => {
    setup('cancelado', {
      reactivate_appointment: () => ({ error: { code: 'AE002', message: 'x' } }),
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reativar' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reativar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esse horário está fora do seu expediente.',
    );
  });
});
