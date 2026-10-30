import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toAppError, type AppError } from '@/lib/errors';
import { guard, must } from '@/lib/queryHelpers';
import type { Database } from '@/types/database';
import type { AppointmentStatus } from './domain/status';
import { apptKeys } from './keys';

export type Appointment = Database['public']['Tables']['appointments']['Row'];
export type HistoryEntry = Database['public']['Tables']['appointment_history']['Row'];

export type CreateAppointmentInput = {
  clientName: string;
  clientPhone: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  notes: string;
  confirmPast: boolean;
};

export type CreateResult = { appointment: Appointment; reconciled: boolean };

const emptyToNull = (v: string): string | null => (v.trim() === '' ? null : v);

type RpcFn = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: Appointment | null; error: unknown }>;

async function rpcAppointment(name: string, args: Record<string, unknown>): Promise<Appointment> {
  // `p_*` opcionais aceitam null no banco, mas os tipos gerados não os declaram como anuláveis.
  const call = supabase.rpc.bind(supabase) as unknown as RpcFn;
  return must(call(name, args));
}

const RECONCILE_WINDOW_MS = 2 * 60_000;

/**
 * RN17. `attempt` >= 2 = nova tentativa do mesmo input. Se o banco responder `conflito`,
 * procura o próprio agendamento (criado há menos de 2 min); achando, é sucesso reconciliado.
 */
export async function createWithReconcile(
  input: CreateAppointmentInput,
  attempt: number,
): Promise<CreateResult> {
  try {
    const appointment = await rpcAppointment('create_appointment', {
      p_client_name: input.clientName,
      p_service_name: input.serviceName,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_client_phone: emptyToNull(input.clientPhone),
      p_notes: emptyToNull(input.notes),
      p_confirm_past: input.confirmPast,
    });
    return { appointment, reconciled: false };
  } catch (err) {
    const app = toAppError(err);
    if (app.kind !== 'conflito' || attempt < 2) throw app;
    const since = new Date(Date.now() - RECONCILE_WINDOW_MS).toISOString();
    try {
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('starts_at', input.startsAt)
        .eq('ends_at', input.endsAt)
        .eq('client_name', input.clientName.trim())
        .neq('status', 'cancelado')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);
      const found = data?.[0];
      if (found) return { appointment: found, reconciled: true };
    } catch {
      // Sem como confirmar: mantém o conflito original.
    }
    throw app;
  }
}

function useInvalidate() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: apptKeys.all });
    if (id) {
      void qc.invalidateQueries({ queryKey: apptKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: apptKeys.history(id) });
    }
  };
}

export function useAppointmentsRange(fromIso: string, toIso: string) {
  return useQuery({
    queryKey: apptKeys.range(fromIso, toIso),
    queryFn: () =>
      must(
        supabase
          .from('appointments')
          .select('*')
          .gte('starts_at', fromIso)
          .lt('starts_at', toIso)
          .order('starts_at', { ascending: true }),
      ),
  });
}

export function useAppointment(id: string | undefined) {
  return useQuery({
    queryKey: apptKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: () => must(supabase.from('appointments').select('*').eq('id', id!).single()),
  });
}

export function useAppointmentHistory(id: string | undefined) {
  return useQuery({
    queryKey: apptKeys.history(id ?? ''),
    enabled: !!id,
    queryFn: () =>
      must(
        supabase
          .from('appointment_history')
          .select('*')
          .eq('appointment_id', id!)
          .order('created_at', { ascending: false }),
      ),
  });
}

/** Conta tentativas por input idêntico; zera após sucesso (novo agendamento igual recomeça em 1). */
export function useCreateAppointment() {
  const invalidate = useInvalidate();
  const attempts = useRef(new Map<string, number>());
  return useMutation<CreateResult, AppError, CreateAppointmentInput>({
    mutationFn: async (input) => {
      const key = JSON.stringify([
        input.clientName,
        input.serviceName,
        input.startsAt,
        input.endsAt,
      ]);
      const attempt = (attempts.current.get(key) ?? 0) + 1;
      attempts.current.set(key, attempt);
      const res = await createWithReconcile(input, attempt);
      attempts.current.delete(key);
      return res;
    },
    onSuccess: (res) => invalidate(res.appointment.id),
  });
}

function useApptMutation<I extends { id: string }>(run: (input: I) => Promise<Appointment>) {
  const invalidate = useInvalidate();
  return useMutation<Appointment, AppError, I>({
    mutationFn: (input) => guard(() => run(input)),
    onSuccess: (a) => invalidate(a.id),
  });
}

export function useRescheduleAppointment() {
  return useApptMutation<{ id: string; startsAt: string; endsAt: string; confirmPast: boolean }>(
    (i) =>
      rpcAppointment('reschedule_appointment', {
        p_id: i.id,
        p_starts_at: i.startsAt,
        p_ends_at: i.endsAt,
        p_confirm_past: i.confirmPast,
      }),
  );
}

export function useUpdateDetails() {
  return useApptMutation<{
    id: string;
    clientName: string;
    serviceName: string;
    clientPhone: string;
    notes: string;
  }>((i) =>
    rpcAppointment('update_appointment_details', {
      p_id: i.id,
      p_client_name: i.clientName,
      p_service_name: i.serviceName,
      p_client_phone: emptyToNull(i.clientPhone),
      p_notes: emptyToNull(i.notes),
    }),
  );
}

export function useSetStatus() {
  return useApptMutation<{ id: string; status: AppointmentStatus }>((i) =>
    rpcAppointment('set_appointment_status', { p_id: i.id, p_status: i.status }),
  );
}

export function useCancelAppointment() {
  return useApptMutation<{ id: string; reason: string }>((i) =>
    rpcAppointment('cancel_appointment', { p_id: i.id, p_reason: emptyToNull(i.reason) }),
  );
}

export function useReactivateAppointment() {
  return useApptMutation<{ id: string }>((i) =>
    rpcAppointment('reactivate_appointment', { p_id: i.id }),
  );
}
