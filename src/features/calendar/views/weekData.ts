import { instantToLocal, localToInstant, weekDays } from '@/lib/time';
import { useAppointmentsRange, type Appointment } from '@/features/appointments/api';
import { useBusinessHours } from '@/features/business-hours/api';
import { useProfile } from '@/features/profile/api';
import { shiftDate, toMinutes, weekdayOf } from '../dates';

export type Row = { appt: Appointment; start: number; end: number };
export type Shift = { weekday: number; start_time: string; end_time: string };

/** Dados da semana: perfil, turnos e atendimentos no fuso do perfil. */
export function useWeekData(date: string, tz: string) {
  const profile = useProfile();
  const weekStartsOn: 0 | 1 = profile.data?.week_starts_on === 0 ? 0 : 1;
  const days = weekDays(date, weekStartsOn);
  const from = localToInstant(days[0]!, '00:00', tz);
  const to = localToInstant(shiftDate(days[6]!, 1), '00:00', tz);
  const appts = useAppointmentsRange(from, to);
  const hours = useBusinessHours();
  const slot = profile.data?.slot_interval_minutes ?? 30;
  return { days, appts, hours, slot };
}

export function rowsOf(appts: Appointment[], tz: string): Map<string, Row[]> {
  const byDay = new Map<string, Row[]>();
  for (const appt of appts) {
    const s = instantToLocal(appt.starts_at, tz);
    const e = instantToLocal(appt.ends_at, tz);
    const row = { appt, start: toMinutes(s.time), end: e.date > s.date ? 1440 : toMinutes(e.time) };
    byDay.set(s.date, [...(byDay.get(s.date) ?? []), row]);
  }
  return byDay;
}

export function shiftsOf(hours: Shift[], d: string): [number, number][] {
  return hours
    .filter((s) => s.weekday === weekdayOf(d))
    .map((s): [number, number] => [toMinutes(s.start_time), toMinutes(s.end_time)])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
}

/** Dias que viram coluna: com turno, ou sem turno mas com atendimento. */
export function visibleDays(days: string[], hours: Shift[], byDay: Map<string, Row[]>): string[] {
  return days.filter((d) => shiftsOf(hours, d).length > 0 || (byDay.get(d)?.length ?? 0) > 0);
}

/** Dias visíveis da semana (para o título da barra); `null` enquanto carrega. */
export function useVisibleWeekDays(date: string, tz: string): string[] | null {
  const { days, appts, hours } = useWeekData(date, tz);
  if (!appts.data || !hours.data) return null;
  const v = visibleDays(days, hours.data, rowsOf(appts.data, tz));
  return v.length > 0 ? v : null;
}
