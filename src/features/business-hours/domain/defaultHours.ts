import type { Shift } from '@/features/appointments/domain/freeSlots';

/** Padrão do primeiro acesso: seg–sex, 09:00–12:00 e 13:00–18:00 (0 = domingo). */
export const DEFAULT_SHIFTS: Shift[] = [1, 2, 3, 4, 5].flatMap((weekday) => [
  { weekday, start_time: '09:00', end_time: '12:00' },
  { weekday, start_time: '13:00', end_time: '18:00' },
]);
