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
