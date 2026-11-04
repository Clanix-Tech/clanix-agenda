/** Fuso do perfil padrão: toda data/hora dos testes é calculada nele, nunca no fuso da máquina. */
export const TZ = 'America/Sao_Paulo';

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Data de hoje (AAAA-MM-DD) no fuso informado. */
export function todayIn(tz = TZ, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(date: string, n: number): string {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  return new Date(
    Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)),
  ).getUTCDay();
}

export const isBusinessDay = (date: string) => weekdayOf(date) >= 1 && weekdayOf(date) <= 5;

/** Os próximos `count` dias úteis (seg–sex) depois de hoje no fuso do perfil (nunca hoje). */
export function nextBusinessDays(count: number, tz = TZ, now = new Date()): string[] {
  const out: string[] = [];
  let d = todayIn(tz, now);
  while (out.length < count) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) out.push(d);
  }
  return out;
}

/** Hoje, se for dia útil; senão o próximo dia útil. */
export function currentOrNextBusinessDay(tz = TZ, now = new Date()): string {
  const today = todayIn(tz, now);
  return isBusinessDay(today) ? today : nextBusinessDays(1, tz, now)[0]!;
}

function offsetMinutes(instant: Date, tz: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(instant)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? '');
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/** Data + hora locais no fuso → ISO 8601 com offset explícito (ex.: 2026-11-10T14:00:00-03:00). */
export function toInstant(date: string, hhmm: string, tz = TZ): string {
  const asUtc = Date.parse(`${date}T${hhmm}:00Z`);
  // Duas passadas cobrem a troca de offset perto do horário pedido.
  let offset = offsetMinutes(new Date(asUtc), tz);
  offset = offsetMinutes(new Date(asUtc - offset * 60_000), tz);
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${date}T${hhmm}:00${sign}${hh}:${mm}`;
}

/** "10/11/2026" */
export const dateBR = (date: string) =>
  `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

/** Rótulo do botão de dia na remarcação: "Ter 10". */
export const dayChip = (date: string) => `${WEEKDAYS_SHORT[weekdayOf(date)]} ${date.slice(8, 10)}`;
