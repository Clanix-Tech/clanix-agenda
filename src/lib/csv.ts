const BOM = '\uFEFF';
const FORMULA_START = /^(?:[\t\r]|\s*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20])/;

/** Toda célula entre aspas; início de fórmula (`= + - @ TAB CR`) ganha `'` na frente. */
function cell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV para planilhas em pt-BR: separador `;`, UTF-8 com BOM, linhas CRLF. */
export function toCsv(rows: string[][]): string {
  return BOM + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}
