/** Paleta dos serviços favoritos: dado do usuário, com contraste >= 3:1 sobre #FFFFFF e #140836 (colors.test.ts). A cor nunca vai sozinha (ponto + nome).
 *  `scripts/dados-teste-local.mjs` não importa TS: mantenha os hex de lá iguais aos daqui. */
export const FAVORITE_COLORS = [
  { hex: '#2563EB', label: 'Azul' },
  { hex: '#16A34A', label: 'Verde' },
  { hex: '#B45309', label: 'Âmbar' },
  { hex: '#DB2777', label: 'Rosa' },
  { hex: '#7C3AED', label: 'Roxo' },
  { hex: '#64748B', label: 'Cinza' },
];

/** Cinza antigo (#475569, reprovava no tema escuro): serviços já salvos com ele continuam rotulados. */
const LEGACY_LABELS: Record<string, string> = { '#475569': 'Cinza' };

export const colorLabel = (hex: string | null): string | null => {
  if (!hex) return null;
  const h = hex.toLowerCase();
  return FAVORITE_COLORS.find((c) => c.hex.toLowerCase() === h)?.label ?? LEGACY_LABELS[h] ?? null;
};
