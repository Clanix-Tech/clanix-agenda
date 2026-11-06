import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/test/contrast';
import { FAVORITE_COLORS, colorLabel } from './colors';

describe('paleta dos serviços favoritos', () => {
  it.each(FAVORITE_COLORS.map((c) => [c.label, c.hex]))(
    '%s (%s) tem contraste >= 3:1 sobre claro e escuro',
    (_label, hex) => {
      expect(contrastRatio(hex as string, '#FFFFFF')).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(hex as string, '#140836')).toBeGreaterThanOrEqual(3);
    },
  );
});

describe('colorLabel', () => {
  it('rotula a paleta e o Cinza antigo, e ignora cor desconhecida', () => {
    expect(colorLabel('#2563eb')).toBe('Azul');
    expect(colorLabel('#475569')).toBe('Cinza');
    expect(colorLabel('#123456')).toBeNull();
    expect(colorLabel(null)).toBeNull();
  });
});
