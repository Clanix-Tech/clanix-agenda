import { instantToLocal, todayInTz, weekDays } from '@/lib/time';
import type { Appointment } from '@/features/appointments/api';

export type Indicators = {
  today: number;
  todayRemaining: number;
  todayNoShows: number;
  next: Appointment | null;
  week: number;
  monthCancellations: number;
};

/** Pura: usa só as linhas recebidas; datas sempre no fuso do perfil. */
export function computeIndicators(
  appts: Appointment[],
  tz: string,
  now: Date,
  weekStartsOn: 0 | 1,
): Indicators {
  const today = todayInTz(tz, now);
  const week = new Set(weekDays(today, weekStartsOn));
  const month = today.slice(0, 7);

  let todayCount = 0;
  let todayRemaining = 0;
  let todayNoShows = 0;
  let weekCount = 0;
  let monthCancellations = 0;
  let next: Appointment | null = null;

  for (const a of appts) {
    const day = instantToLocal(a.starts_at, tz).date;
    if (a.status === 'cancelado') {
      if (day.slice(0, 7) === month) monthCancellations++;
      continue;
    }
    if (day === today) {
      todayCount++;
      if (a.status === 'nao_compareceu') todayNoShows++;
      if (a.status === 'agendado' && new Date(a.ends_at) > now) todayRemaining++;
    }
    if (week.has(day)) weekCount++;
    if (
      a.status === 'agendado' &&
      new Date(a.starts_at) >= now &&
      (!next || new Date(a.starts_at) < new Date(next.starts_at))
    ) {
      next = a;
    }
  }

  return {
    today: todayCount,
    todayRemaining,
    todayNoShows,
    next,
    week: weekCount,
    monthCancellations,
  };
}
