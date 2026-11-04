import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { localToInstant, todayInTz } from '@/lib/time';
import { shiftDate } from '@/features/calendar/dates';
import type { Appointment } from '@/features/appointments/api';
import { apptKeys } from '@/features/appointments/keys';
import { accentInsensitivePattern } from './namePattern';
import type { AppointmentStatus } from '@/features/appointments/domain/status';

export const PAGE_SIZE = 25;
export const DEFAULT_RANGE_DAYS = 30;

/** Filtros efetivos (datas `AAAA-MM-DD`; vazio = sem limite). */
export type HistoryFilters = {
  q: string;
  statuses: AppointmentStatus[];
  service: string;
  from: string;
  to: string;
};

/** Período padrão: 30 dias antes até 30 dias depois de hoje, no fuso do perfil. */
export function defaultPeriod(tz: string, now: Date = new Date()): { from: string; to: string } {
  const today = todayInTz(tz, now);
  return { from: shiftDate(today, -DEFAULT_RANGE_DAYS), to: shiftDate(today, DEFAULT_RANGE_DAYS) };
}

const baseQuery = (withCount: boolean) =>
  supabase.from('appointments').select('*', withCount ? { count: 'exact' } : undefined);
type Query = ReturnType<typeof baseQuery>;

/** Só filtros do usuário; o isolamento por dono é feito pelo RLS do banco. */
function build(filters: HistoryFilters, tz: string, withCount: boolean): Query {
  let q = baseQuery(withCount);
  const term = filters.q.trim();
  if (term) q = q.filter('client_name', 'imatch', accentInsensitivePattern(term));
  if (filters.statuses.length) q = q.in('status', filters.statuses);
  if (filters.service) q = q.eq('service_name', filters.service);
  if (filters.from) q = q.gte('starts_at', localToInstant(filters.from, '00:00', tz));
  if (filters.to) q = q.lt('starts_at', localToInstant(shiftDate(filters.to, 1), '00:00', tz));
  return q.order('starts_at', { ascending: false }).order('id', { ascending: true });
}

export type HistoryPageResult = { rows: Appointment[]; count: number };

export async function fetchHistoryRange(
  filters: HistoryFilters,
  tz: string,
  from: number,
  to: number,
  withCount = true,
): Promise<HistoryPageResult> {
  const { data, error, count } = await build(filters, tz, withCount).range(from, to);
  if (error) throw error;
  return { rows: data, count: count ?? data.length };
}

/** Só consulta depois que o fuso do perfil é conhecido (`tz` indefinido = desligado). */
export function useHistorySearch(filters: HistoryFilters, tz: string | undefined, page: number) {
  return useQuery({
    enabled: !!tz,
    queryKey: apptKeys.search({ ...filters, tz, page }),
    placeholderData: keepPreviousData,
    queryFn: () => fetchHistoryRange(filters, tz!, (page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  });
}
