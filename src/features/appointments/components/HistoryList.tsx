import { formatDateBR, formatTime } from '@/lib/time';
import { statusMeta, type AppointmentStatus } from '../domain/status';
import type { HistoryEntry } from '../api';

type Values = Record<string, unknown> | null;

const asValues = (v: unknown): Values =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const str = (v: Values, key: string): string | null => {
  const x = v?.[key];
  return typeof x === 'string' && x !== '' ? x : null;
};

function statusLabel(v: string | null): string | null {
  if (!v) return null;
  return v in statusMeta ? statusMeta[v as AppointmentStatus].label : null;
}

/** "28/10 às 15:00" no fuso do perfil. */
function shortInstant(iso: string, tz: string): string {
  return `${formatDateBR(iso, tz).slice(0, 5)} às ${formatTime(iso, tz)}`;
}

function describeEntry(entry: HistoryEntry, tz: string): { text: string; detail?: string } {
  const before = asValues(entry.previous_values);
  const after = asValues(entry.new_values);
  switch (entry.action) {
    case 'criado':
      return { text: 'Agendamento criado' };
    case 'editado':
      return { text: 'Dados editados' };
    case 'remarcado': {
      const from = str(before, 'starts_at');
      const to = str(after, 'starts_at');
      return {
        text:
          from && to
            ? `Remarcado de ${shortInstant(from, tz)} para ${shortInstant(to, tz)}`
            : 'Remarcado',
      };
    }
    case 'status_alterado': {
      const from = statusLabel(str(before, 'status'));
      const to = statusLabel(str(after, 'status'));
      return { text: from && to ? `Status: ${from} → ${to}` : 'Status alterado' };
    }
    case 'cancelado': {
      const reason = str(after, 'cancellation_reason');
      return { text: 'Cancelado', detail: reason ? `Motivo: ${reason}` : undefined };
    }
    case 'reativado':
      return { text: 'Reativado' };
    default:
      return { text: 'Alteração registrada' };
  }
}

export function HistoryList({ entries, timezone }: { entries: HistoryEntry[]; timezone: string }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem registros ainda.</p>;
  }
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0 text-[13px]">
      {entries.map((e) => {
        const { text, detail } = describeEntry(e, timezone);
        return (
          <li key={e.id} className="flex gap-2.5">
            <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
            <span className="min-w-0 break-words">
              <span className="font-semibold">{text}</span>
              {detail && <span className="block text-foreground-secondary">{detail}</span>}
              <span className="block text-xs text-muted-foreground">
                {`${formatDateBR(e.created_at, timezone)} às ${formatTime(e.created_at, timezone)}`}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
