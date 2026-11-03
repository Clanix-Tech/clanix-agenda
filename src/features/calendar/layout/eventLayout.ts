export type LayoutEvent = { id: string; start: string; end: string };
export type LayoutBox = { id: string; top: number; height: number };

export const MIN_EVENT_HEIGHT = 24;

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Posição vertical (px) de cada evento na coluna do dia; `end` pode ser "24:00". */
export function layoutDay(
  events: LayoutEvent[],
  dayStart: string,
  _dayEnd: string,
  pxPerHour: number,
): LayoutBox[] {
  const base = toMin(dayStart);
  return events.map((e) => {
    const s = toMin(e.start);
    const z = toMin(e.end);
    return {
      id: e.id,
      top: ((s - base) / 60) * pxPerHour,
      height: Math.max(MIN_EVENT_HEIGHT, ((z - s) / 60) * pxPerHour),
    };
  });
}

/** Classes de posição horizontal; ativo e cancelado sobrepostos dividem a coluna sem cobrir um ao outro. */
export function eventPlacement(cancelled: boolean, overlapsOther: boolean): string {
  if (!overlapsOther) return 'left-1 right-1 z-10';
  return cancelled ? 'left-[58%] right-1 z-10' : 'left-1 right-[43%] z-10';
}
