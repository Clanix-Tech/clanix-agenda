import { useState } from 'react';
import { Search } from 'lucide-react';
import { instantToLocal, localToInstant, todayInTz } from '@/lib/time';
import { useAppointmentsRange } from '@/features/appointments/api';
import type { AppointmentStatus } from '@/features/appointments/domain/status';
import { useNewAppointment } from '@/features/appointments/components/NewAppointmentProvider';
import { StatusBadge } from '@/components/status/StatusBadge';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { shiftDate, shortDM, weekdayShortDM } from '../dates';
import { useNow } from '../useNow';
import { useOpenAppointment } from '../useOpenAppointment';
import { normalize } from '../search';

type Props = { date: string; tz: string; status: AppointmentStatus[] | null };

function heading(day: string, today: string): string {
  if (day === today) return `Hoje · ${weekdayShortDM(day)}`;
  if (day === shiftDate(today, 1)) return `Amanhã · ${weekdayShortDM(day)}`;
  const s = weekdayShortDM(day);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ListView({ date, tz, status }: Props) {
  const from = localToInstant(date, '00:00', tz);
  const to = localToInstant(shiftDate(date, 30), '00:00', tz);
  const appts = useAppointmentsRange(from, to);
  const { open } = useNewAppointment();
  const openAppointment = useOpenAppointment();
  const now = useNow();
  const [query, setQuery] = useState('');

  const search = (
    <label className="relative block">
      <span className="sr-only">Buscar por cliente ou serviço</span>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-[#64748B]"
      />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar cliente ou serviço"
        className="h-11 w-full rounded-[14px] border border-[#E2E8F0] bg-white pr-3 pl-10 text-base focus-visible:outline-2 focus-visible:outline-[#2563EB]"
      />
    </label>
  );

  if (appts.isPending) return <LoadingState label="Carregando a agenda…" />;
  if (appts.isError) {
    return (
      <ErrorState
        message="Não foi possível carregar a agenda."
        onRetry={() => void appts.refetch()}
      />
    );
  }

  const q = normalize(query.trim());
  const rows = appts.data.filter(
    (a) =>
      (!status || status.includes(a.status)) &&
      (!q || normalize(a.client_name).includes(q) || normalize(a.service_name).includes(q)),
  );

  const groups = new Map<string, typeof rows>();
  for (const a of rows) {
    const day = instantToLocal(a.starts_at, tz).date;
    groups.set(day, [...(groups.get(day) ?? []), a]);
  }
  const today = todayInTz(tz, now);

  return (
    <div className="flex flex-col gap-4">
      {search}
      {rows.length === 0 ? (
        <EmptyState
          title="Nenhum atendimento por aqui."
          description={`Próximos 30 dias a partir de ${shortDM(date)}.`}
          action={
            <Button
              onClick={() => open({ date })}
              className="h-11 bg-[#2563EB] px-5 text-white hover:bg-[#1D4ED8]"
            >
              Novo agendamento
            </Button>
          }
        />
      ) : (
        [...groups.entries()].map(([day, list]) => (
          <section key={day} aria-label={heading(day, today)} className="flex flex-col gap-2">
            <h2 className="px-1 font-display text-sm font-extrabold text-[#0F2D5B]">
              {heading(day, today)}
            </h2>
            {list.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => openAppointment(a.id)}
                className="flex min-h-[68px] w-full items-center gap-3 rounded-[18px] border border-[#E2E8F0] bg-white p-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
              >
                <span className="flex h-12 w-[62px] shrink-0 flex-col items-center justify-center rounded-xl bg-[#E7F1FF] text-[#0F2D5B]">
                  <b className="font-display text-[15px] font-extrabold">
                    {instantToLocal(a.starts_at, tz).time}
                  </b>
                  <span className="text-[11px] text-[#475569]">
                    {instantToLocal(a.ends_at, tz).time}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <b
                    title={a.client_name}
                    className={cn(
                      'block truncate text-[15px] font-semibold',
                      a.status === 'cancelado' && 'text-[#475569] line-through',
                    )}
                  >
                    {a.client_name}
                  </b>
                  <span
                    title={a.service_name}
                    className="block truncate text-[13px] text-[#64748B]"
                  >
                    {a.service_name}
                  </span>
                </span>
                <StatusBadge status={a.status} compact />
              </button>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
