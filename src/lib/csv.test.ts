import { toCsv } from './csv';

describe('toCsv', () => {
  it('usa BOM, ; e aspas duplicadas, e neutraliza fórmula', () => {
    expect(toCsv([['=1+1', 'a;b', 'x"y']])).toBe('\uFEFF"\'=1+1";"a;b";"x""y"');
  });

  it.each(['=A1', '+55', '-1', '@soma', '\tx', '\rx'])('neutraliza %j', (cell) => {
    expect(toCsv([[cell]])).toBe(`\uFEFF"'${cell}"`);
  });

  it('não mexe em texto comum e separa linhas com CRLF', () => {
    expect(
      toCsv([
        ['Ana', ''],
        ['b', 'c\nd'],
      ]),
    ).toBe('\uFEFF"Ana";""\r\n"b";"c\nd"');
  });
});

describe('toCsv: neutralização reforçada', () => {
  it.each([
    ' =1',
    '  +1',
    '\u00a0-1',
    '\n@x',
    '\uFF1D1',
    '\uFF0B1',
    '\uFF0D1',
    '\uFF20x',
    ' \uFF1D1',
  ])('neutraliza %j', (c) => {
    expect(toCsv([[c]])).toBe(`\uFEFF"'${c}"`);
  });

  it('não neutraliza espaço seguido de texto comum', () => {
    expect(toCsv([[' ana']])).toBe('\uFEFF" ana"');
  });
});
