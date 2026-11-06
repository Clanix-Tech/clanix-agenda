import { cn } from '@/lib/utils';
import type { AgendaView } from '../useAgendaParams';

const OPTIONS: { value: AgendaView; label: string }[] = [
  { value: 'dia', label: 'Dia' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'lista', label: 'Lista' },
];

export function ViewSwitcher({
  view,
  onChange,
}: {
  view: AgendaView;
  onChange: (v: AgendaView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Modo de visualização"
      className="flex gap-0.5 rounded-xl bg-muted p-[3px]"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={view === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-11 flex-1 rounded-[9px] px-3 text-[13px] font-semibold text-foreground-secondary focus-visible:outline-2 focus-visible:outline-ring lg:flex-none lg:px-4',
            view === o.value && 'bg-card text-foreground shadow-sm',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
