export type Part = { text: string; match: boolean };

const fold = (ch: string) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Parte `text` em trechos, marcando as ocorrências de `term` sem diferenciar caixa nem acento. */
export function splitHighlight(text: string, term: string): Part[] {
  const needle = Array.from(term.trim()).map(fold).join('');
  if (!needle) return [{ text, match: false }];

  const chars = Array.from(text);
  let hay = '';
  const origin: number[] = []; // posição em `hay` -> índice do caractere original
  chars.forEach((ch, i) => {
    const f = fold(ch);
    for (let k = 0; k < f.length; k++) origin.push(i);
    hay += f;
  });

  const marked = new Array<boolean>(chars.length).fill(false);
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length)) {
    for (let k = at; k < at + needle.length; k++) marked[origin[k]!] = true;
  }

  const parts: Part[] = [];
  chars.forEach((ch, i) => {
    const last = parts[parts.length - 1];
    if (last && last.match === marked[i]) last.text += ch;
    else parts.push({ text: ch, match: marked[i]! });
  });
  return parts;
}
