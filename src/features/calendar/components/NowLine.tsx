/**
 * Linha do "agora". `labelled` (Dia, T01): ponto + "Agora · HH:mm" + linha. `line` (grade da
 * semana, T03): só ponto e linha de 2 px, para não escrever por cima dos eventos; o horário fica
 * no nome acessível.
 */
export function NowLine({
  time,
  variant = 'labelled',
}: {
  time: string;
  variant?: 'labelled' | 'line';
}) {
  if (variant === 'line') {
    return (
      <div role="separator" aria-label={`Agora, ${time}`} className="flex items-center">
        <span aria-hidden="true" className="-ml-1 size-2 shrink-0 rounded-full bg-[#2563EB]" />
        <span aria-hidden="true" className="h-0.5 flex-1 bg-[#2563EB]" />
      </div>
    );
  }
  return (
    <div
      role="separator"
      aria-label={`Agora, ${time}`}
      className="flex items-center gap-2 px-1.5 text-xs font-bold text-[#2563EB]"
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-[#2563EB]" />
      <span>Agora · {time}</span>
      <span aria-hidden="true" className="h-0.5 flex-1 rounded bg-[#3B82F6]" />
    </div>
  );
}
