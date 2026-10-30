import { describe, expect, it } from 'vitest';
import {
  addMinutesToTime,
  formatDateBR,
  formatLongDate,
  formatTime,
  instantToLocal,
  localToInstant,
  monthMatrix,
  todayInTz,
  weekDays,
} from '@/lib/time';

const SP = 'America/Sao_Paulo';

describe('time', () => {
  it('localToInstant usa o fuso informado', () => {
    expect(localToInstant('2026-11-02', '14:00', SP)).toBe('2026-11-02T14:00:00-03:00');
    expect(localToInstant('2026-11-02', '14:00', 'America/Manaus')).toBe(
      '2026-11-02T14:00:00-04:00',
    );
  });
  it('ignora o fuso do dispositivo (Europe/Lisbon nos testes)', () => {
    // verão de Lisboa: UTC+1 => offset -60 (prova que TZ do vitest foi aplicado)
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-60);
    expect(instantToLocal('2026-11-02T17:00:00Z', SP)).toEqual({
      date: '2026-11-02',
      time: '14:00',
      weekday: 1,
    });
    expect(formatTime('2026-11-02T17:00:00Z', SP)).toBe('14:00');
    expect(todayInTz(SP, new Date('2026-10-30T02:30:00Z'))).toBe('2026-10-29');
  });
  it('todayInTz sem now devolve YYYY-MM-DD', () => {
    expect(todayInTz(SP)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('formata datas', () => {
    expect(formatDateBR('2026-10-29T17:00:00Z', SP)).toBe('29/10/2026');
    expect(formatDateBR('2026-10-29', SP)).toBe('29/10/2026');
    expect(formatLongDate('2026-10-29T17:00:00Z', SP)).toBe('Quinta-feira, 29 de outubro');
  });
  it('addMinutesToTime', () => {
    expect(addMinutesToTime('23:30', 45)).toBeNull();
    expect(addMinutesToTime('13:00', 45)).toBe('13:45');
    expect(addMinutesToTime('23:00', 59)).toBe('23:59');
  });
  it('weekDays', () => {
    expect(weekDays('2026-10-29', 1)[0]).toBe('2026-10-26');
    expect(weekDays('2026-10-29', 0)[0]).toBe('2026-10-25');
    expect(weekDays('2026-10-29', 1)).toHaveLength(7);
  });
  it('monthMatrix', () => {
    const m = monthMatrix('2026-10-15', 1);
    expect(m).toHaveLength(5);
    expect(m[0]?.[0]).toBe('2026-09-28');
    expect(m.every((w) => w.length === 7)).toBe(true);
  });
});
