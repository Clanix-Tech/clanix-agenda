/** Aritmética de calendário puro (YYYY-MM-DD), sem influência do fuso do dispositivo. */
const parts = (date: string): [number, number, number] => [
  Number(date.slice(0, 4)),
  Number(date.slice(5, 7)),
  Number(date.slice(8, 10)),
];

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const WEEKDAYS_LONG = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];
const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** "29 de outubro" */
export function dayAndMonth(date: string): string {
  const [, m, d] = parts(date);
  return `${d} de ${MONTHS[m - 1]}`;
}

/** "29/10" */
export function shortDM(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/** "qui 29/10" */
export function weekdayShortDM(date: string): string {
  return `${WEEKDAYS_SHORT[weekdayOf(date)]} ${shortDM(date)}`;
}

export const toMinutes = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Soma meses a uma data, mantendo o dia dentro do tamanho do mês de destino (31/01 + 1 = 28/02). */
export function shiftMonth(date: string, months: number): string {
  const [y, m, d] = parts(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ny, nm, Math.min(d, last))).toISOString().slice(0, 10);
}

/** "Sex 30" */
export function weekdayDay(date: string): string {
  const w = WEEKDAYS_SHORT[weekdayOf(date)]!;
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} ${Number(date.slice(8, 10))}`;
}

/** "26 a 31 de outubro de 2026" */
export function weekRangeTitle(first: string, last: string): string {
  const [, m1, d1] = parts(first);
  const [y2, m2, d2] = parts(last);
  if (m1 === m2) return `${d1} a ${d2} de ${MONTHS[m2 - 1]} de ${y2}`;
  return `${d1} de ${MONTHS[m1 - 1]} a ${d2} de ${MONTHS[m2 - 1]} de ${y2}`;
}

/** "Outubro de 2026" */
export function monthTitle(date: string): string {
  const [y, m] = parts(date);
  return `${MONTHS[m - 1]!.charAt(0).toUpperCase()}${MONTHS[m - 1]!.slice(1)} de ${y}`;
}
