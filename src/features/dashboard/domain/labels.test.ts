import { dayLabel, greeting, whenLabel } from './labels';

const TZ = 'America/Sao_Paulo';
const NOW = new Date('2026-10-29T08:00:00-03:00');
const at = (iso: string) => whenLabel(iso, TZ, NOW);

describe('whenLabel', () => {
  it('limites de minutos e horas', () => {
    expect(at('2026-10-29T08:59:00-03:00')).toBe('em 59 min');
    expect(at('2026-10-29T09:00:00-03:00')).toBe('em 1 h');
    expect(at('2026-10-29T13:59:00-03:00')).toBe('em 5 h');
    expect(at('2026-10-29T14:00:00-03:00')).toBe('às 14:00');
  });
  it('amanhã e dias seguintes', () => {
    expect(at('2026-10-30T09:00:00-03:00')).toBe('amanhã às 09:00');
    expect(at('2026-10-31T09:00:00-03:00')).toBe('Sáb 31 às 09:00');
    expect(at('2026-11-06T10:30:00-03:00')).toBe('Sex 6 às 10:30');
  });
  it('usa o fuso do perfil para decidir hoje/amanhã', () => {
    const late = new Date('2026-10-29T22:00:00-03:00'); // 01:00 UTC do dia 30
    expect(whenLabel('2026-10-30T09:00:00-03:00', TZ, late)).toBe('amanhã às 09:00');
  });
});

describe('greeting', () => {
  it('limites', () => {
    expect(greeting(11)).toBe('Bom dia');
    expect(greeting(12)).toBe('Boa tarde');
    expect(greeting(17)).toBe('Boa tarde');
    expect(greeting(18)).toBe('Boa noite');
  });
});

describe('dayLabel', () => {
  it('Hoje, Amanhã e data', () => {
    expect(dayLabel('2026-10-29', '2026-10-29')).toBe('Hoje');
    expect(dayLabel('2026-10-30', '2026-10-29')).toBe('Amanhã');
    expect(dayLabel('2026-11-06', '2026-10-29')).toBe('Sex, 06/11');
  });
});
