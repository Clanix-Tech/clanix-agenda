import { useState, type ReactNode } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { instantToLocal, localToInstant, todayInTz } from '@/lib/time';
import { useAppointmentsRange, type Appointment } from '@/features/appointments/api';
import {
  ceilNowToStep,
  freeIntervals,
  type FreeInterval,
} from '@/features/appointments/domain/freeSlots';
import type { AppointmentStatus } from '@/features/appointments/domain/status';
import { useNewAppointment } from '@/features/appointments/components/NewAppointmentProvider';
import { useBusinessHours } from '@/features/business-hours/api';
import { StatusBadge } from '@/components/status/StatusBadge';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { shiftDate, toMinutes, weekdayOf } from '../dates';
import { useNow } from '../useNow';
import { useOpenAppointment } from '../useOpenAppointment';
import { NowLine } from '../components/NowLine';

type Props = { date: string; tz: string; status: AppointmentStatus[] | null };

type Row = { appt: Appointment; start: number; end: number };
type Item = { key: string; min: number; node: ReactNode };

const fmt = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function AppointmentCard({
  row,
  start,
  end,
  next,
  onOpen,
}: {
  row: Appointment;
  start: string;
  end: string;
  next: boolean;
  onOpen: () => void;
}) {
  const cancelled = row.status === 'cancelado';
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex min-h-[68px] w-full items-center gap-3 rounded-[18px] border p-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]',
        next
          ? 'border-[#0F2D5B] bg-[#0F2D5B] text-white'
          : 'border-[#E2E8F0] bg-white text-[#0F172A]',
      )}
    >
      <span
        className={cn(
          'flex h-12 w-[62px] shrink-0 flex-col items-center justify-center rounded-xl',
          next ? 'bg-white/15 text-white' : 'bg-[#E7F1FF] text-[#0F2D5B]',
        )}
      >
        <b className="font-[Manrope,sans-serif] text-[15px] font-extrabold">{start}</b>
        <span className={cn('text-[11px]', next ? 'text-[#CBD5E1]' : 'text-[#475569]')}>{end}</span>
      </span>
      <span className="min-w-0 flex-1">
        <b
          title={row.client_name}
          className={cn(
            'block truncate text-[15px] font-semibold',
            cancelled && 'text-[#475569] line-through',
          )}
        >
          {row.client_name}
        </b>
        <span
          title={row.service_name}
          className={cn('block truncate text-[13px]', next ? 'text-[#CBD5E1]' : 'text-[#64748B]')}
        >
          {row.service_name}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {next && (
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#0F2D5B]">
            Próximo
          </span>
        )}
        <StatusBadge status={row.status} compact />
      </span>
    </button>
  );
}

function FreeCard({
  interval,
  cancelled,
  onPick,
}: {
  interval: FreeInterval;
  cancelled: Appointment[];
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex min-h-[68px] w-full items-center gap-3 rounded-[18px] border-[1.5px] border-dashed border-[#93C5FD] bg-[#F5F9FF] p-2.5 text-left text-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
    >
      <span className="flex h-12 w-[62px] shrink-0 flex-col items-center justify-center rounded-xl bg-white">
        <b className="font-[Manrope,sans-serif] text-[15px] font-extrabold">{interval.start}</b>
        <span className="text-[11px]">{interval.end}</span>
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">Horário livre</b>
        {cancelled.length > 0 ? (
          cancelled.map((c) => (
            <span key={c.id} className="block truncate text-[13px] text-[#475569]">
              <span title={c.client_name} className="line-through">
                {c.client_name}
              </span>{' '}
              cancelou
            </span>
          ))
        ) : (
          <span className="block text-[13px]">Toque para agendar</span>
        )}
      </span>
      <Plus aria-hidden="true" className="size-[22px] shrink-0" />
    </button>
  );
}

function DayViewInner({ date, tz, status }: Props) {
  const from = localToInstant(date, '00:00', tz);
  const to = localToInstant(shiftDate(date, 1), '00:00', tz);
  const appts = useAppointmentsRange(from, to);
  const hours = useBusinessHours();
  const { open } = useNewAppointment();
  const openAppointment = useOpenAppointment();
  const now = useNow();
  const [expanded, setExpanded] = useState(false);

  if (appts.isPending || hours.isPending) return <LoadingState label="Carregando a agenda…" />;
  if (appts.isError || hours.isError) {
    return (
      <ErrorState
        message="Não foi possível carregar a agenda."
        onRetry={() => {
          void appts.refetch();
          void hours.refetch();
        }}
      />
    );
  }

  const today = todayInTz(tz, now);
  const isToday = date === today;
  const nowMin = toMinutes(instantToLocal(now.toISOString(), tz).time);

  const rows: Row[] = appts.data.map((appt) => {
    const s = instantToLocal(appt.starts_at, tz);
    const e = instantToLocal(appt.ends_at, tz);
    return { appt, start: toMinutes(s.time), end: e.date > date ? 1440 : toMinutes(e.time) };
  });
  const active = rows.filter((r) => r.appt.status !== 'cancelado');

  const startOfToday = new Date(localToInstant(today, '00:00', tz));
  // Mesmo piso de freeIntervals: agora arredondado para cima ao próximo múltiplo de 5 min.
  const floor = isToday ? ceilNowToStep(now, tz) : 0;
  const free = freeIntervals(
    date,
    tz,
    hours.data,
    active.map((r) => ({ startsAt: r.appt.starts_at, endsAt: r.appt.ends_at })),
    startOfToday,
  ).filter((f) => !isToday || floor < toMinutes(f.end));

  const visible = rows.filter((r) => !status || status.includes(r.appt.status));

  // Cancelado dentro de um horário livre vira nota nesse cartão; os demais seguem como cartões.
  const freeOf = (r: Row) =>
    free.find((f) => r.start >= toMinutes(f.start) && r.start < toMinutes(f.end));
  const cancelledByFree = new Map<FreeInterval, Appointment[]>();
  const cards: Row[] = [];
  for (const r of visible) {
    const f = r.appt.status === 'cancelado' ? freeOf(r) : undefined;
    if (f) cancelledByFree.set(f, [...(cancelledByFree.get(f) ?? []), r.appt]);
    else cards.push(r);
  }

  const done = isToday
    ? cards.filter((r) => r.appt.status !== 'cancelado' && new Date(r.appt.ends_at) <= now)
    : [];
  const doneSet = new Set(done);
  const rest = cards.filter((r) => !doneSet.has(r));

  const nextId = isToday
    ? active
        .filter((r) => r.appt.status === 'agendado' && new Date(r.appt.starts_at) >= now)
        .sort((a, b) => a.start - b.start)[0]?.appt.id
    : undefined;

  const hhmm = (iso: string) => instantToLocal(iso, tz).time;
  const card = (r: Row) => (
    <AppointmentCard
      row={r.appt}
      start={hhmm(r.appt.starts_at)}
      end={hhmm(r.appt.ends_at)}
      next={r.appt.id === nextId}
      onOpen={() => openAppointment(r.appt.id)}
    />
  );

  const items: Item[] = rest.map((r) => ({
    key: r.appt.id,
    min: r.start,
    node: card(r),
  }));

  for (const f of free) {
    const fs = toMinutes(f.start);
    const startTime = isToday && fs < floor ? fmt(floor) : f.start;
    items.push({
      key: `free-${f.start}`,
      min: fs,
      node: (
        <FreeCard
          interval={f}
          cancelled={cancelledByFree.get(f) ?? []}
          onPick={() => open({ date, startTime })}
        />
      ),
    });
  }

  const shifts = hours.data
    .filter((s) => s.weekday === weekdayOf(date))
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
  for (let i = 1; i < shifts.length; i++) {
    const a = toMinutes(shifts[i - 1]!.end_time);
    const b = toMinutes(shifts[i]!.start_time);
    if (b > a) {
      items.push({
        key: `lunch-${a}`,
        min: a,
        node: (
          <div className="flex items-center gap-2.5 px-1.5 text-xs font-semibold text-[#64748B]">
            <span>
              {fmt(a)} – {fmt(b)} · Almoço
            </span>
            <span aria-hidden="true" className="h-px flex-1 bg-[#E2E8F0]" />
          </div>
        ),
      });
    }
  }

  if (isToday) {
    items.push({
      key: 'now',
      min: nowMin - 0.5,
      node: <NowLine time={hhmm(now.toISOString())} />,
    });
  }
  items.sort((a, b) => a.min - b.min);

  const doneLabel =
    done.length > 0
      ? `${done.length} ${done.length === 1 ? 'já realizado' : 'já realizados'} (${fmt(Math.min(...done.map((r) => r.start)))} – ${fmt(
          Math.max(...done.map((r) => r.end)),
        )})`
      : '';
  const n = active.length;

  return (
    <div className="flex flex-col gap-3.5">
      <p className="px-1 text-sm text-[#334155]">
        <strong className="text-[#0F2D5B]">
          {n} {n === 1 ? 'atendimento' : 'atendimentos'}
        </strong>{' '}
        · {free.length} {free.length === 1 ? 'horário livre' : 'horários livres'}
      </p>

      {done.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="flex h-11 items-center justify-center gap-1.5 rounded-[14px] bg-[#EEF2F6] text-[13px] font-semibold text-[#475569] focus-visible:outline-2 focus-visible:outline-[#2563EB]"
          >
            {doneLabel}
            <ChevronDown
              aria-hidden="true"
              className={cn('size-4 transition-transform', expanded && 'rotate-180')}
            />
          </button>
          {expanded &&
            done.sort((a, b) => a.start - b.start).map((r) => <div key={r.appt.id}>{card(r)}</div>)}
        </>
      )}

      {items.every((i) => i.key === 'now') && done.length === 0 && (
        <p className="p-6 text-center text-[#64748B]">Nada para este dia.</p>
      )}
      {items.map((it) => (
        <div key={it.key}>{it.node}</div>
      ))}
    </div>
  );
}

/** Com `key={date}`, trocar de dia recomeça com os realizados recolhidos. */
export function DayView(props: Props) {
  return <DayViewInner key={props.date} {...props} />;
}
