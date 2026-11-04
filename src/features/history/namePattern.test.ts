import { accentInsensitivePattern } from './namePattern';

const matches = (term: string, name: string) =>
  new RegExp(accentInsensitivePattern(term), 'i').test(name);

describe('accentInsensitivePattern', () => {
  it('casa sem acento e sem diferenciar caixa', () => {
    expect(matches('joao', 'João Silva')).toBe(true);
    expect(matches('JOAO', 'joão')).toBe(true);
    expect(matches('conceicao', 'Conceição')).toBe(true);
    expect(matches('jose', 'JOSÉ Pereira')).toBe(true);
    expect(matches('nunes', 'Núñes')).toBe(true);
    expect(matches('munoz', 'Muñoz')).toBe(true);
    expect(matches('nuno', 'Nuño')).toBe(true);
  });

  it('aceita o termo com acento também', () => {
    expect(matches('João', 'joao')).toBe(true);
    expect(matches('João', 'JOÃO')).toBe(true);
  });

  it('escapa metacaracteres de regex', () => {
    expect(matches('a.b', 'axb')).toBe(false);
    expect(matches('a.b', 'a.b')).toBe(true);
    expect(matches('(a', 'x (a')).toBe(true);
    expect(matches('a|b', 'a')).toBe(false);
    expect(matches('a\\b', 'a\\b')).toBe(true);
    expect(matches('50%_off', '50%_off')).toBe(true);
    expect(matches('50%_off', '500xoff')).toBe(false);
  });

  it('apara espaços das pontas', () => {
    expect(accentInsensitivePattern('  ana ')).toBe(accentInsensitivePattern('ana'));
  });
});
