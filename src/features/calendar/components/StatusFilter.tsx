import { cn } from '@/lib/utils';
import type { AppointmentStatus } from '@/features/appointments/domain/status';

const OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: 'agendado', label: 'Agendados' },
  { value: 'concluido', label: 'Concluídos' },
  { value: 'nao_compareceu', label: 'Faltas' },
  { value: 'cancelado', label: 'Cancelados' },
];

export function StatusFilter({
  value,
  onChange,
}: {
  value: AppointmentStatus[] | null;
  onChange: (v: AppointmentStatus[] | null) => void;
}) {
  const toggle = (s: AppointmentStatus) => {
    const cur = value ?? [];
    const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
    onChange(next.length ? next : null);
  };
  const pill =
    'h-11 shrink-0 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[#2563EB]';
  const on = 'border-[#0F2D5B] bg-[#0F2D5B] text-white';
  const off = 'border-[#E2E8F0] bg-white text-[#475569]';
  return (
    <div role="group" aria-label="Filtrar por status" className="flex gap-2 overflow-x-auto">
      <button
        type="button"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
        className={cn(pill, value === null ? on : off)}
      >
        Todos
      </button>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={!!value?.includes(o.value)}
          onClick={() => toggle(o.value)}
          className={cn(pill, value?.includes(o.value) ? on : off)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
