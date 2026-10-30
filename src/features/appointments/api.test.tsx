import { act, waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/render';
import { createFakeSupabase, makeSession } from '@/test/fakeSupabase';
import type { AppError } from '@/lib/errors';
import {
  useAppointmentsRange,
  useCreateAppointment,
  useUpdateDetails,
  useCancelAppointment,
  useSetStatus,
} from './api';
import { apptKeys } from './keys';

const input = {
  clientName: 'Ana ',
  clientPhone: '',
  serviceName: 'Corte',
  startsAt: '2026-11-02T09:00:00-03:00',
  endsAt: '2026-11-02T10:00:00-03:00',
  notes: '',
  confirmPast: false,
};

const appt = (over: Record<string, unknown> = {}) => ({
  id: 'ap-1',
  owner_id: 'user-1',
  client_name: 'Ana',
  service_name: 'Corte',
  starts_at: '2026-11-02T12:00:00+00:00',
  ends_at: '2026-11-02T13:00:00+00:00',
  status: 'agendado',
  created_at: new Date().toISOString(),
  ...over,
});

describe('useCreateAppointment', () => {
  it('chama a RPC com vazios como null', async () => {
    const fake = createFakeSupabase({
      session: makeSession(),
      rpc: { create_appointment: () => ({ data: appt() }) },
    });
    const { result } = renderHookWithProviders(() => useCreateAppointment(), { supabase: fake });
    let out: unknown;
    await act(async () => {
      out = await result.current.mutateAsync(input);
    });
    expect(fake.calls.rpc[0]).toEqual({
      name: 'create_appointment',
      args: {
        p_client_name: 'Ana ',
        p_service_name: 'Corte',
        p_starts_at: input.startsAt,
        p_ends_at: input.endsAt,
        p_client_phone: null,
        p_notes: null,
        p_confirm_past: false,
      },
    });
    expect(out).toMatchObject({ reconciled: false });
  });

  it('AE001 vira conflito', async () => {
    const fake = createFakeSupabase({
      session: makeSession(),
      rpc: { create_appointment: () => ({ error: { code: 'AE001', details: 'segredo' } }) },
    });
    const { result } = renderHookWithProviders(() => useCreateAppointment(), { supabase: fake });
    await act(async () => {
      await result.current.mutateAsync(input).catch(() => {});
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect((result.current.error as unknown as AppError).kind).toBe('conflito');
  });

  it('RN17: rede na 1a; AE001 na 2a com o agendamento ja gravado reconcilia', async () => {
    let n = 0;
    const fake = createFakeSupabase({
      session: makeSession(),
      tables: { appointments: [appt()] },
      rpc: {
        create_appointment: () =>
          ++n === 1 ? { error: new TypeError('Failed to fetch') } : { error: { code: 'AE001' } },
      },
    });
    const { result } = renderHookWithProviders(() => useCreateAppointment(), { supabase: fake });
    await act(async () => {
      await result.current.mutateAsync(input).catch(() => {});
    });
    await waitFor(() =>
      expect((result.current.error as unknown as AppError | null)?.kind).toBe('rede'),
    );
    let out: unknown;
    await act(async () => {
      out = await result.current.mutateAsync(input);
    });
    expect(out).toMatchObject({ reconciled: true, appointment: { id: 'ap-1' } });
  });

  it('RN17: sem agendamento igual recente, segue conflito', async () => {
    const fake = createFakeSupabase({
      session: makeSession(),
      tables: {
        appointments: [
          appt({ client_name: 'Outra' }),
          appt({ id: 'ap-2', status: 'cancelado' }),
          appt({ id: 'ap-3', created_at: new Date(Date.now() - 10 * 60_000).toISOString() }),
        ],
      },
      rpc: { create_appointment: () => ({ error: { code: 'AE001' } }) },
    });
    const { result } = renderHookWithProviders(() => useCreateAppointment(), { supabase: fake });
    await act(async () => {
      await result.current.mutateAsync(input).catch(() => {});
      await result.current.mutateAsync(input).catch(() => {});
    });
    await waitFor(() =>
      expect((result.current.error as unknown as AppError | null)?.kind).toBe('conflito'),
    );
  });
});

describe('outras mutacoes', () => {
  it('updateDetails envia sempre telefone e observacoes (vazios -> null)', async () => {
    const fake = createFakeSupabase({
      session: makeSession(),
      rpc: { update_appointment_details: () => ({ data: appt() }) },
    });
    const { result } = renderHookWithProviders(() => useUpdateDetails(), { supabase: fake });
    await act(async () => {
      await result.current.mutateAsync({
        id: 'ap-1',
        clientName: 'Ana',
        serviceName: 'Corte',
        clientPhone: '',
        notes: '',
      });
    });
    expect(fake.calls.rpc[0]).toEqual({
      name: 'update_appointment_details',
      args: {
        p_id: 'ap-1',
        p_client_name: 'Ana',
        p_service_name: 'Corte',
        p_client_phone: null,
        p_notes: null,
      },
    });
  });

  it('setStatus e cancel usam os argumentos p_*', async () => {
    const fake = createFakeSupabase({
      session: makeSession(),
      rpc: {
        set_appointment_status: () => ({ data: appt() }),
        cancel_appointment: () => ({ data: appt() }),
      },
    });
    const s = renderHookWithProviders(() => useSetStatus(), { supabase: fake });
    await act(async () => {
      await s.result.current.mutateAsync({ id: 'ap-1', status: 'concluido' });
    });
    const c = renderHookWithProviders(() => useCancelAppointment(), { supabase: fake });
    await act(async () => {
      await c.result.current.mutateAsync({ id: 'ap-1', reason: '' });
    });
    expect(fake.calls.rpc.map((r) => r.args)).toEqual([
      { p_id: 'ap-1', p_status: 'concluido' },
      { p_id: 'ap-1', p_reason: null },
    ]);
  });

  it('sucesso invalida apptKeys.all', async () => {
    const fake = createFakeSupabase({
      session: makeSession(),
      rpc: { set_appointment_status: () => ({ data: appt() }) },
    });
    const { result, queryClient } = renderHookWithProviders(() => useSetStatus(), {
      supabase: fake,
    });
    queryClient.setQueryData(apptKeys.range('a', 'b'), []);
    await act(async () => {
      await result.current.mutateAsync({ id: 'ap-1', status: 'concluido' });
    });
    expect(queryClient.getQueryState(apptKeys.range('a', 'b'))?.isInvalidated).toBe(true);
  });
});

describe('useAppointmentsRange', () => {
  it('filtra [from, to) por instante e ordena', async () => {
    const fake = createFakeSupabase({
      session: makeSession(),
      tables: {
        appointments: [
          appt({ id: 'late', starts_at: '2026-11-02T20:00:00+00:00' }),
          appt({ id: 'in', starts_at: '2026-11-02T12:00:00+00:00' }),
          appt({ id: 'before', starts_at: '2026-11-02T02:59:59+00:00' }),
          appt({ id: 'edge', starts_at: '2026-11-03T03:00:00+00:00' }),
        ],
      },
    });
    const { result } = renderHookWithProviders(
      () => useAppointmentsRange('2026-11-02T00:00:00-03:00', '2026-11-03T00:00:00-03:00'),
      { supabase: fake },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.map((a) => a.id)).toEqual(['in', 'late']);
  });
});
