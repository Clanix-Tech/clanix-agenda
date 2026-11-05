/** Data da última revisão da Política de Privacidade (AAAA-MM-DD). Atualize ao mudar o texto. */
export const PRIVACY_UPDATED_AT = '2026-11-05';

/** `2026-11-05` -> `05/11/2026`. */
export function formatPrivacyDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
