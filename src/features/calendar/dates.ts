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
