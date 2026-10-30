import { cn } from '@/lib/utils';
import { statusMeta, type AppointmentStatus } from '@/features/appointments/domain/status';

export function StatusBadge({
  status,
  compact = false,
}: {
  status: AppointmentStatus;
  compact?: boolean;
}) {
  const { label, icon: Icon, className } = statusMeta[status];
  const text = compact && status === 'nao_compareceu' ? 'Faltou' : label;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span>{text}</span>
    </span>
  );
}
