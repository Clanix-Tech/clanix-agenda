import { instantToLocal, todayInTz } from '@/lib/time';

export type Shift = { weekday: number; start_time: string; end_time: string };
export type BusyInterval = { startsAt: string; endsAt: string };
export type FreeInterval = { start: string; end: string };

type Range = [number, number];

/** Minutos do dia (fuso do perfil) de `now`, arredondados para cima ao próximo múltiplo de `step`. */
export function ceilNowToStep(now: Date, tz: string, step = 5): number {
  const n = instantToLocal(now.toISOString(), tz);
  const min = Number(n.time.slice(0, 2)) * 60 + Number(n.time.slice(3, 5));
  const extra = now.getUTCSeconds() || now.getUTCMilliseconds() ? 1 : 0;
  return Math.ceil((min + extra) / step) * step;
}

function toMin(t: string): number {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}

function fromMin(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Turnos do dia da semana de `date` (calendário puro, sem fuso do dispositivo). */
function shiftRanges(date: string, shifts: Shift[]): Range[] {
  const weekday = new Date(
    Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))),
  ).getUTCDay();
  return shifts
    .filter((s) => s.weekday === weekday)
    .map((s): Range => [toMin(s.start_time), toMin(s.end_time)])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
}

function busyRanges(date: string, tz: string, busy: BusyInterval[]): Range[] {
  const out: Range[] = [];
  for (const b of busy) {
    const s = instantToLocal(b.startsAt, tz);
    const e = instantToLocal(b.endsAt, tz);
    if (s.date > date || e.date < date) continue;
    const a = s.date < date ? 0 : toMin(s.time);
    const z = e.date > date ? 1440 : toMin(e.time);
    if (z > a) out.push([a, z]);
  }
  out.sort((x, y) => x[0] - y[0]);
  const merged: Range[] = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

export function freeIntervals(
  date: string,
  tz: string,
  shifts: Shift[],
  busy: BusyInterval[],
  now: Date,
): FreeInterval[] {
  const today = todayInTz(tz, now);
  if (date < today) return [];
  let floor = 0;
  if (date === today) {
    floor = ceilNowToStep(now, tz);
  }
  const busyR = busyRanges(date, tz, busy);
  const result: FreeInterval[] = [];
  for (const [s0, e] of shiftRanges(date, shifts)) {
    let cursor = Math.max(s0, floor);
    for (const [bs, be] of busyR) {
      if (be <= cursor) continue;
      if (bs >= e) break;
      if (bs > cursor) result.push({ start: fromMin(cursor), end: fromMin(bs) });
      cursor = Math.max(cursor, be);
    }
    if (cursor < e) result.push({ start: fromMin(cursor), end: fromMin(e) });
  }
  return result;
}

export function slotStarts(
  free: FreeInterval[],
  durationMinutes: number,
  stepMinutes: 15 | 30 | 60,
): string[] {
  const out: string[] = [];
  for (const f of free) {
    const end = toMin(f.end);
    for (let t = toMin(f.start); t + durationMinutes <= end; t += stepMinutes) out.push(fromMin(t));
  }
  return out;
}

export function isWithinShifts(
  date: string,
  _tz: string,
  shifts: Shift[],
  startTime: string,
  durationMinutes: number,
): boolean {
  const s = toMin(startTime);
  const e = s + durationMinutes;
  return shiftRanges(date, shifts).some(([a, b]) => s >= a && e <= b);
}
