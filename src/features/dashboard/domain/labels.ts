import { instantToLocal } from '@/lib/time';
import { shiftDate, weekdayDay } from '@/features/calendar/dates';

export function greeting(hour: number): string {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** "em 20 min", "em 3 h", "às 17:00", "amanhã às 09:00", "Sex 30 às 09:00". */
export function whenLabel(startsAt: string, tz: string, now: Date): string {
  const diffMin = Math.floor((new Date(startsAt).getTime() - now.getTime()) / 60_000);
  if (diffMin < 60) return `em ${Math.max(diffMin, 0)} min`;
  if (diffMin < 360) return `em ${Math.floor(diffMin / 60)} h`;
  const { date, time } = instantToLocal(startsAt, tz);
  const today = instantToLocal(now.toISOString(), tz).date;
  if (date === today) return `às ${time}`;
  if (date === shiftDate(today, 1)) return `amanhã às ${time}`;
  return `${weekdayDay(date)} às ${time}`;
}

/** "Hoje", "Amanhã", "Sex, 30/10". */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Hoje';
  if (date === shiftDate(today, 1)) return 'Amanhã';
  const w = weekdayDay(date).split(' ')[0];
  return `${w}, ${date.slice(8, 10)}/${date.slice(5, 7)}`;
}
