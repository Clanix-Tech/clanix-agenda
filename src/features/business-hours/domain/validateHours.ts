import type { Shift } from '@/features/appointments/domain/freeSlots';

export const MAX_SHIFTS = 21;
export const MAX_TIME = '23:59';
export const MSG_END = 'O fim precisa ser depois do início';
export const MSG_OVERLAP = 'Turnos não podem se sobrepor';
export const MSG_MAX = 'Máximo de 21 turnos';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Mensagem de erro de cada turno (índice do array) e uma mensagem global, se houver. */
export type HoursValidation = { byIndex: Map<number, string>; global: string | null };

export function validateShifts(shifts: Shift[]): HoursValidation {
  const byIndex = new Map<number, string>();
  shifts.forEach((s, i) => {
    // "HH:mm" compara corretamente como texto; vazio/inválido ou >= 24:00 conta como erro de fim.
    if (!TIME.test(s.start_time) || !TIME.test(s.end_time) || s.end_time <= s.start_time) {
      byIndex.set(i, MSG_END);
    }
  });
  const byDay = new Map<number, number[]>();
  shifts.forEach((s, i) => {
    if (!byIndex.has(i)) byDay.set(s.weekday, [...(byDay.get(s.weekday) ?? []), i]);
  });
  for (const idxs of byDay.values()) {
    const sorted = [...idxs].sort((a, b) =>
      shifts[a]!.start_time.localeCompare(shifts[b]!.start_time),
    );
    for (let k = 1; k < sorted.length; k++) {
      const prev = shifts[sorted[k - 1]!]!;
      const cur = shifts[sorted[k]!]!;
      if (cur.start_time < prev.end_time) byIndex.set(sorted[k]!, MSG_OVERLAP);
    }
  }
  return {
    byIndex,
    global: shifts.length >= MAX_SHIFTS ? MSG_MAX : null,
  };
}

export function isValid(shifts: Shift[]): boolean {
  const v = validateShifts(shifts);
  return v.byIndex.size === 0 && shifts.length <= MAX_SHIFTS;
}
