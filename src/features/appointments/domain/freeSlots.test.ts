import { describe, expect, it } from 'vitest';
import { freeIntervals, isWithinShifts, slotStarts, type Shift } from './freeSlots';

const TZ = 'America/Sao_Paulo';
const shifts: Shift[] = [
  { weekday: 4, start_time: '08:00:00', end_time: '12:00:00' },
  { weekday: 4, start_time: '13:00', end_time: '19:00' },
];
const b = (s: string, e: string) => ({
  startsAt: `2026-10-29T${s}:00-03:00`,
  endsAt: `2026-10-29T${e}:00-03:00`,
});
const eve = new Date('2026-10-28T12:00:00-03:00');

describe('freeIntervals', () => {
  it('subtrai ocupados dos turnos', () => {
    const busy = [
      b('08:30', '09:30'),
      b('10:00', '11:00'),
      b('11:30', '12:00'),
      b('14:00', '15:00'),
      b('15:00', '16:00'),
      b('17:00', '18:00'),
    ];
    expect(freeIntervals('2026-10-29', TZ, shifts, busy, eve)).toEqual([
      { start: '08:00', end: '08:30' },
      { start: '09:30', end: '10:00' },
      { start: '11:00', end: '11:30' },
      { start: '13:00', end: '14:00' },
      { start: '16:00', end: '17:00' },
      { start: '18:00', end: '19:00' },
    ]);
  });

  it('adjacência não cria lacuna e sobreposição é mesclada', () => {
    const r = freeIntervals(
      '2026-10-29',
      TZ,
      shifts,
      [b('14:00', '15:00'), b('15:00', '16:00'), b('14:30', '15:30')],
      eve,
    );
    expect(r).toContainEqual({ start: '13:00', end: '14:00' });
    expect(r).toContainEqual({ start: '16:00', end: '19:00' });
    expect(r.some((i) => i.start >= '14:00' && i.start < '16:00')).toBe(false);
  });

  it('domingo sem turno retorna []', () => {
    expect(freeIntervals('2026-11-01', TZ, shifts, [], eve)).toEqual([]);
  });

  it('data passada retorna []', () => {
    expect(
      freeIntervals('2026-10-29', TZ, shifts, [], new Date('2026-10-30T10:00:00-03:00')),
    ).toEqual([]);
  });

  it('ignora ocupados de outro dia e recorta os que atravessam o dia', () => {
    const busy = [
      { startsAt: '2026-10-28T08:00:00-03:00', endsAt: '2026-10-28T09:00:00-03:00' },
      { startsAt: '2026-10-28T23:00:00-03:00', endsAt: '2026-10-29T08:30:00-03:00' },
    ];
    const r = freeIntervals('2026-10-29', TZ, shifts, busy, eve);
    expect(r[0]).toEqual({ start: '08:30', end: '12:00' });
  });

  it('hoje corta o passado arredondando para cima em 5 min', () => {
    const now = new Date('2026-10-29T13:41:00-03:00');
    const r = freeIntervals('2026-10-29', TZ, shifts, [], now);
    expect(r).toEqual([{ start: '13:45', end: '19:00' }]);
    const exact = new Date('2026-10-29T13:40:00-03:00');
    expect(freeIntervals('2026-10-29', TZ, shifts, [], exact)[0]).toEqual({
      start: '13:40',
      end: '19:00',
    });
  });
});

describe('slotStarts', () => {
  it('lista inícios onde cabe a duração', () => {
    expect(slotStarts([{ start: '13:00', end: '14:00' }], 45, 15)).toEqual(['13:00', '13:15']);
  });
  it('passo de 30 e vazio quando não cabe', () => {
    expect(slotStarts([{ start: '09:00', end: '10:30' }], 60, 30)).toEqual(['09:00', '09:30']);
    expect(slotStarts([{ start: '09:00', end: '09:30' }], 60, 30)).toEqual([]);
  });
});

describe('isWithinShifts', () => {
  it('cabe inteiro em um turno', () => {
    expect(isWithinShifts('2026-10-29', TZ, shifts, '08:00', 240)).toBe(true);
    expect(isWithinShifts('2026-10-29', TZ, shifts, '11:30', 60)).toBe(false);
    expect(isWithinShifts('2026-10-29', TZ, shifts, '18:30', 30)).toBe(true);
    expect(isWithinShifts('2026-10-29', TZ, shifts, '18:30', 45)).toBe(false);
    expect(isWithinShifts('2026-11-01', TZ, shifts, '09:00', 30)).toBe(false);
  });
});
