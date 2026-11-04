import { splitHighlight } from './highlight';

describe('splitHighlight', () => {
  it('ignora acento e caixa preservando o texto original', () => {
    expect(splitHighlight('JOSÉ Pereira', 'jose')).toEqual([
      { text: 'JOSÉ', match: true },
      { text: ' Pereira', match: false },
    ]);
  });

  it('marca todas as ocorrências', () => {
    expect(splitHighlight('Ana e Mariana', 'ana')).toEqual([
      { text: 'Ana', match: true },
      { text: ' e Mari', match: false },
      { text: 'ana', match: true },
    ]);
  });

  it('sem termo ou sem ocorrência devolve o texto inteiro', () => {
    expect(splitHighlight('Bia', '')).toEqual([{ text: 'Bia', match: false }]);
    expect(splitHighlight('Bia', 'x')).toEqual([{ text: 'Bia', match: false }]);
  });

  it('trata caracteres especiais como texto', () => {
    expect(splitHighlight('50%_off', '%_')).toEqual([
      { text: '50', match: false },
      { text: '%_', match: true },
      { text: 'off', match: false },
    ]);
  });
});
