const pad = (n: number) => String(n).padStart(2, '0');

/** Rótulo de seleção: "45 min", "1 hora", "1h30", "2 horas". */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return h === 1 ? '1 hora' : `${h} horas`;
  return `${h}h${pad(m)}`;
}

/** Rótulo curto (chips de serviço): "45 min", "1h", "1h30". */
export function durationShort(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${pad(m)}`;
}

const FIXED = [15, 30, 45, 60, 90, 120];

/** Opções do campo Duração: fixas + padrão do perfil + extras (favorito, valor atual), sem repetir. */
export function durationOptions(...extra: Array<number | null | undefined>): number[] {
  const all = [...FIXED, ...extra].filter(
    (n): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0,
  );
  return [...new Set(all)].sort((a, b) => a - b);
}
