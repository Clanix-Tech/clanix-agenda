import { CircleAlert, Plus, RefreshCw } from 'lucide-react';

export type ConflictItem = { id: string; name: string; start: string; end: string };
export type SuggestedSlot = { start: string; end: string };

type Props = {
  /** Id do texto da explicação (para `aria-describedby` do início e do botão Salvar). */
  id?: string;
  /** Intervalo pedido (HH:mm), quando conhecido. */
  start?: string;
  end?: string;
  conflicts: ConflictItem[];
  suggestions: SuggestedSlot[];
  /** "02/11" */
  dayLabel: string;
  /** "1 hora" */
  durationLabel: string;
  /** `alert` quando o servidor recusou (AE001); `status` quando é o cálculo do próprio app. */
  live: 'alert' | 'status';
  /** Buscando os agendamentos do dia de novo antes de afirmar o conflito. */
  checking?: boolean;
  /** Não foi possível confirmar com dados atuais: o servidor decide ao salvar. */
  unverified?: boolean;
  onPick(start: string): void;
  onRecheck(): void;
};

function joinNames(items: ConflictItem[]) {
  const parts = items.map((c) => `${c.name} (${c.start}–${c.end})`);
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

/** RN18: quem ocupa o horário + até 3 horários livres do mesmo dia (clicar preenche o início). */
export function ConflictPanel({
  id,
  start,
  end,
  conflicts,
  suggestions,
  dayLabel,
  durationLabel,
  live,
  checking = false,
  unverified = false,
  onPick,
  onRecheck,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div
        role={live}
        aria-live={live === 'alert' ? 'assertive' : 'polite'}
        aria-busy={checking}
        className="flex gap-3 rounded-[14px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3.5 text-[#991B1B]"
      >
        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {checking ? (
            <p id={id} className="text-sm leading-[1.45] font-semibold">
              Verificando… Conferindo se esse horário continua ocupado.
            </p>
          ) : (
            <div id={id} className="text-sm leading-[1.45] break-words">
              <strong className="block">Esse horário já está ocupado</strong>
              {conflicts.length > 0 ? (
                <>
                  {start && end ? `${start}–${end} conflita com ` : 'Conflita com '}
                  <b>{joinNames(conflicts)}</b>.
                </>
              ) : (
                'Outro agendamento já ocupa esse horário.'
              )}{' '}
              {unverified
                ? 'Não foi possível confirmar agora; você ainda pode tentar salvar.'
                : suggestions.length > 0
                  ? 'Escolha um dos horários livres abaixo.'
                  : 'Escolha outro horário ou outro dia.'}
            </div>
          )}
          <button
            type="button"
            onClick={onRecheck}
            disabled={checking}
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-[10px] px-2 text-sm font-semibold text-[#991B1B] underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-[#3B82F6]/50 disabled:opacity-60"
          >
            <RefreshCw aria-hidden="true" className={checking ? 'size-4 animate-spin' : 'size-4'} />
            Verificar de novo
          </button>
        </div>
      </div>

      {!checking && (
        <section
          aria-label={`Livres em ${dayLabel} para ${durationLabel}`}
          className="flex flex-col gap-2 rounded-[14px] border border-[#EEF2F6] bg-[#F8FAFC] p-4"
        >
          <h3 className="font-[Manrope,sans-serif] text-[15px] font-bold text-[#0F2D5B]">
            Livres em {dayLabel} para {durationLabel}
          </h3>
          {suggestions.length > 0 ? (
            <>
              {suggestions.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => onPick(s.start)}
                  className="flex min-h-11 w-full items-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-[#93C5FD] bg-[#F5F9FF] px-3 text-sm font-semibold text-[#1D4ED8] outline-none hover:bg-[#E7F1FF] focus-visible:ring-[3px] focus-visible:ring-[#3B82F6]/50"
                >
                  <Plus aria-hidden="true" className="size-4" />
                  {s.start} – {s.end}
                </button>
              ))}
              <p className="text-xs leading-normal text-[#64748B]">
                Mostrando só horários livres dentro do seu expediente.
              </p>
            </>
          ) : (
            <p className="text-sm text-[#64748B]">
              Não há outro horário livre com essa duração neste dia.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
