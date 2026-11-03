import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { CalendarDays, Clock, FileText, Phone, Tag, type LucideIcon } from 'lucide-react';
import { ResponsiveSheet } from '@/components/layout/ResponsiveSheet';
import { StatusBadge } from '@/components/status/StatusBadge';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Button } from '@/components/ui/button';
import { toAppError } from '@/lib/errors';
import { formatDateBR, formatLongDate, formatTime, instantToLocal } from '@/lib/time';
import { useProfile } from '@/features/profile/api';
import { useAppointment, useAppointmentHistory, type Appointment } from '../api';
import { durationLabel } from '../domain/duration';
import { useNewAppointment } from './NewAppointmentProvider';
import { AppointmentForm } from './AppointmentForm';
import { HistoryList } from './HistoryList';
import { StatusActions } from './StatusActions';

import { APPOINTMENT_PARAM } from '../openParam';

/** "Próximo · em 20 min", "em 2 h" ou "às HH:mm" nas próximas 24 h; só para agendado. */
function upcomingLabel(a: Appointment, tz: string, now = Date.now()): string | null {
  if (a.status !== 'agendado') return null;
  const diff = Date.parse(a.starts_at) - now;
  if (diff < 0 || diff > 24 * 3_600_000) return null;
  const at = formatTime(a.starts_at, tz);
  if (
    instantToLocal(a.starts_at, tz).date !== instantToLocal(new Date(now).toISOString(), tz).date
  ) {
    return `Próximo · amanhã às ${at}`;
  }
  const min = Math.ceil(diff / 60_000);
  if (min < 60) return `Próximo · em ${min} min`;
  if (min < 180) return `Próximo · em ${Math.round(min / 60)} h`;
  return `Próximo · às ${at}`;
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[#EEF2F6] py-2.5 text-[15px] last:border-b-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#E7F1FF] text-[#1D4ED8]">
        <Icon aria-hidden="true" className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1 break-words">
        <small className="block text-xs text-[#64748B]">{label}</small>
        {children}
      </span>
    </div>
  );
}

/** Detalhes do atendimento (T06), aberto por `?atendimento=<id>` em qualquer página protegida. */
export function AppointmentSheet() {
  const [params, setParams] = useSearchParams();
  const id = params.get(APPOINTMENT_PARAM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId === id;
  const newAppointment = useNewAppointment();
  const profile = useProfile();
  const appointment = useAppointment(id ?? undefined);
  const history = useAppointmentHistory(id ?? undefined);

  if (!id && editingId !== null) setEditingId(null);
  if (!id) return null;

  const close = () => {
    setEditingId(null);
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete(APPOINTMENT_PARAM);
        return next;
      },
      { replace: true },
    );
  };

  const a = appointment.data;
  if (editing && a) {
    // O formulário tem a própria gaveta; ao terminar, volta aos detalhes do mesmo atendimento.
    return <AppointmentForm mode="edit" appointment={a} onDone={() => setEditingId(null)} />;
  }

  const tz = profile.data?.timezone;
  let body: ReactNode;
  if (appointment.isError || profile.isError) {
    const err = toAppError(appointment.error ?? profile.error);
    body = (
      <ErrorState
        message={err.message}
        onRetry={
          err.kind === 'nao_encontrado'
            ? undefined
            : () => {
                void appointment.refetch();
                void profile.refetch();
              }
        }
      />
    );
  } else if (!a || !tz) {
    body = <LoadingState />;
  } else {
    const start = instantToLocal(a.starts_at, tz);
    const minutes = Math.round((Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60_000);
    const next = upcomingLabel(a, tz);
    body = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={a.status} />
          {next && <span className="text-xs font-bold text-[#1D4ED8]">{next}</span>}
        </div>
        <p
          className={`font-[Manrope,sans-serif] text-2xl font-extrabold break-words text-[#0F2D5B] ${a.status === 'cancelado' ? 'line-through' : ''}`}
        >
          {a.client_name}
        </p>
        <div className="rounded-[18px] border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-0.5">
          <InfoRow icon={CalendarDays} label="Data">
            {`${formatLongDate(a.starts_at, tz).split(',')[0]}, ${formatDateBR(start.date, tz)}`}
          </InfoRow>
          <InfoRow icon={Clock} label="Horário">
            {`${formatTime(a.starts_at, tz)} – ${formatTime(a.ends_at, tz)} · ${durationLabel(minutes)}`}
          </InfoRow>
          <InfoRow icon={Tag} label="Serviço">
            {a.service_name}
          </InfoRow>
          {a.client_phone && (
            <InfoRow icon={Phone} label="Telefone">
              <span className="flex items-center justify-between gap-2">
                <span>{a.client_phone}</span>
                <Button asChild variant="ghost" className="h-11 px-3 text-[#1D4ED8]">
                  <a href={`tel:${a.client_phone.replace(/[^\d+]/g, '')}`}>Ligar</a>
                </Button>
              </span>
            </InfoRow>
          )}
          {a.notes && (
            <InfoRow icon={FileText} label="Observações">
              <span className="whitespace-pre-wrap">{a.notes}</span>
            </InfoRow>
          )}
        </div>
        <StatusActions
          appointment={a}
          onEdit={() => setEditingId(id)}
          onCreateNew={() => {
            close();
            newAppointment.open({ date: start.date });
          }}
        />
        <section className="border-t border-[#EEF2F6] pt-3.5">
          <h3 className="mb-3 font-[Manrope,sans-serif] text-[15px] font-bold text-[#0F2D5B]">
            Histórico
          </h3>
          {history.isError ? (
            <ErrorState
              message={toAppError(history.error).message}
              onRetry={() => void history.refetch()}
            />
          ) : history.data ? (
            <HistoryList entries={history.data} timezone={tz} />
          ) : (
            <LoadingState />
          )}
        </section>
      </div>
    );
  }

  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && close()} title="Detalhes do atendimento">
      {body}
    </ResponsiveSheet>
  );
}
