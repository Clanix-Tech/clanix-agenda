import { TZDate } from '@date-fns/tz';
import {
  addDays,
  addWeeks,
  endOfMonth,
  format,
  formatISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

type WeekStart = 0 | 1;

const INVALID = 'Data ou hora inválida';

/** Estrito: YYYY-MM-DD de calendário real (rejeita 2026-02-30). */
function parseDate(date: string): [number, number, number] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError(INVALID);
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new RangeError(INVALID);
  }
  return [y, m - 1, d];
}

/** Estrito: HH:mm com horas 0-23 e minutos 0-59; null se inválido. */
function tryParseTime(time: string): [number, number] | null {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const h = Number(time.slice(0, 2));
  const m = Number(time.slice(3, 5));
  if (h > 23 || m > 59) return null;
  return [h, m];
}

function parseTime(time: string): [number, number] {
  const r = tryParseTime(time);
  if (!r) throw new RangeError(INVALID);
  return r;
}

function ymd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Data (YYYY-MM-DD) + hora (HH:mm) no fuso `tz` -> ISO 8601 com offset. */
export function localToInstant(date: string, time: string, tz: string): string {
  const [y, mo, d] = parseDate(date);
  const [h, mi] = parseTime(time);
  return formatISO(new TZDate(y, mo, d, h, mi, 0, tz));
}

export function instantToLocal(
  iso: string,
  tz: string,
): { date: string; time: string; weekday: number } {
  const d = new TZDate(new Date(iso), tz);
  return { date: format(d, 'yyyy-MM-dd'), time: format(d, 'HH:mm'), weekday: d.getDay() };
}

export function formatDateBR(isoOrDate: string, tz: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
    const [y, m, d] = isoOrDate.split('-');
    return `${d}/${m}/${y}`;
  }
  return format(new TZDate(new Date(isoOrDate), tz), 'dd/MM/yyyy');
}

export function formatTime(iso: string, tz: string): string {
  return format(new TZDate(new Date(iso), tz), 'HH:mm');
}

export function formatLongDate(iso: string, tz: string): string {
  const s = format(new TZDate(new Date(iso), tz), "EEEE, d 'de' MMMM", { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Soma minutos a HH:mm; null se passar de 23:59 (RN12). */
export function addMinutesToTime(time: string, minutes: number): string | null {
  const parsed = tryParseTime(time);
  if (!parsed || !Number.isFinite(minutes)) return null;
  const total = parsed[0] * 60 + parsed[1] + minutes;
  if (total > 23 * 60 + 59 || total < 0) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function todayInTz(tz: string, now: Date = new Date()): string {
  return format(new TZDate(now, tz), 'yyyy-MM-dd');
}

// Cálculos de calendário usam TZDate em UTC como "data pura", sem influência do fuso do dispositivo.
function pure(date: string): TZDate {
  const [y, m, d] = parseDate(date);
  return new TZDate(y, m, d, 12, 0, 0, 'UTC');
}

export function weekDays(date: string, weekStartsOn: WeekStart): string[] {
  const start = startOfWeek(pure(date), { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => ymd(addDays(start, i)));
}

export function monthMatrix(date: string, weekStartsOn: WeekStart): string[][] {
  const base = pure(date);
  const first = startOfWeek(startOfMonth(base), { weekStartsOn });
  const last = endOfMonth(base);
  const weeks: string[][] = [];
  for (let w = first; w <= last; w = addWeeks(w, 1)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => ymd(addDays(w, i))));
  }
  return weeks;
}
