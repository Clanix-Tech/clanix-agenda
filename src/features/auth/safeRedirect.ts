function hasUnsafeChar(text: string, forbidColon: boolean): boolean {
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 32 || ch === '\\' || (forbidColon && ch === ':')) return true;
  }
  return false;
}

/** Aceita só caminhos internos (`/x`, `/x?y=1`); qualquer outra coisa vira `/`. */
export function safeRedirectPath(from: unknown): string {
  if (typeof from !== 'object' || from === null) return '/';
  const { pathname, search } = from as { pathname?: unknown; search?: unknown };
  if (typeof pathname !== 'string') return '/';
  const query = typeof search === 'string' ? search : '';
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return '/';
  if (hasUnsafeChar(pathname, true) || hasUnsafeChar(query, false)) return '/';
  return `${pathname}${query}`;
}
