const REGEX_META = /[\\.+*?^$()[\]{}|]/;

const CLASSES: Record<string, string> = {
  a: '[aáàâãäAÁÀÂÃÄ]',
  e: '[eéèêëEÉÈÊË]',
  i: '[iíìîïIÍÌÎÏ]',
  o: '[oóòôõöOÓÒÔÕÖ]',
  u: '[uúùûüUÚÙÛÜ]',
  c: '[cçCÇ]',
  n: '[nñNÑ]',
};

/**
 * Expressão regular POSIX (para `imatch`/`~*` do PostgREST) que casa o termo sem diferenciar
 * caixa nem acento. Metacaracteres do termo são escapados: `a.b` não casa `axb`.
 */
export function accentInsensitivePattern(term: string): string {
  return Array.from(term.trim())
    .map((ch) => {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const cls = CLASSES[base];
      if (cls) return cls;
      if (/^[a-z]$/.test(base)) return `[${base}${base.toUpperCase()}]`;
      return REGEX_META.test(ch) ? `\\${ch}` : ch;
    })
    .join('');
}
