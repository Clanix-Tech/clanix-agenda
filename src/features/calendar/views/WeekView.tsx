import { useState, type MouseEvent } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import { instantToLocal, localToInstant, todayInTz, weekDays } from '@/lib/time';
import { useAppointmentsRange, type Appointment } from '@/features/appointments/api';
import { freeIntervals } from '@/features/appointments/domain/freeSlots';
import { statusMeta, type AppointmentStatus } from '@/features/appointments/domain/status';
import { useNewAppointment } from '@/features/appointments/components/NewAppointmentProvider';
import { useBusinessHours } from '@/features/business-hours/api';
import { useProfile } from '@/features/profile/api';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { shiftDate, toMinutes, weekdayDay, weekdayOf } from '../dates';
import { layoutDay } from '../layout/eventLayout';
import { useNow } from '../useNow';
import { useOpenAppointment } from '../useOpenAppointment';
import { NowLine } from '../components/NowLine';
import { DayView } from './DayView';

type Props = {
  date: string;
  tz: string;
  status: AppointmentStatus[] | null;
  onDate: (date: string) => void;
};

const PX_PER_HOUR = 52;
const HATCH = 'repeating-linear-gradient(135deg,#F1F5F9 0 6px,#F8FAFC 6px 12px)';
const fmt = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

type Row = { appt: Appointment; start: number; end: number };

const EVENT_COLORS: Record<AppointmentStatus, string> = {
  agendado: 'border-[#BFDBFE] bg-[#E7F1FF] text-[#1D4ED8]',
  concluido: 'border-[#BBF7D0] bg-[#DCFCE7] text-[#166534]',
  nao_compareceu: 'border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]',
  cancelado: 'border-dashed border-[#94A3B8] bg-[#F1F5F9] text-[#475569]',
};

/** Dados da semana: perfil, turnos e atendimentos agrupados por dia no fuso do perfil. */
function useWeekData(date: string, tz: string) {
  const profile = useProfile();
  const weekStartsOn: 0 | 1 = profile.data?.week_starts_on === 0 ? 0 : 1;
  const days = weekDays(date, weekStartsOn);
  const from = localToInstant(days[0]!, '00:00', tz);
  const to = localToInstant(shiftDate(days[6]!, 1), '00:00', tz);
  const appts = useAppointmentsRange(from, to);
  const hours = useBusinessHours();
  const slot = profile.data?.slot_interval_minutes ?? 30;
  return { days, appts, hours, slot };
}

function rowsOf(appts: Appointment[], tz: string): Map<string, Row[]> {
  const byDay = new Map<string, Row[]>();
  for (const appt of appts) {
    const s = instantToLocal(appt.starts_at, tz);
    const e = instantToLocal(appt.ends_at, tz);
    const row = { appt, start: toMinutes(s.time), end: e.date > s.date ? 1440 : toMinutes(e.time) };
    byDay.set(s.date, [...(byDay.get(s.date) ?? []), row]);
  }
  return byDay;
}

export function WeekView(props: Props) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  return desktop ? <WeekGrid {...props} /> : <WeekStrip {...props} />;
}

function WeekGrid({ date, tz, status }: Props) {
  const { days, appts, hours, slot } = useWeekData(date, tz);
  const { open } = useNewAppointment();
  const openAppointment = useOpenAppointment();
  const now = useNow();
  const [hover, setHover] = useState<{ date: string; min: number } | null>(null);

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

  const byDay = rowsOf(appts.data, tz);
  const shiftsOf = (d: string) =>
    hours.data
      .filter((s) => s.weekday === weekdayOf(d))
      .map((s): [number, number] => [toMinutes(s.start_time), toMinutes(s.end_time)])
      .filter(([a, b]) => b > a)
      .sort((a, b) => a[0] - b[0]);

  const columns = days.filter((d) => shiftsOf(d).length > 0 || (byDay.get(d)?.length ?? 0) > 0);

  // Faixa de horas da semana: menor início e maior fim dos turnos; amplia para não esconder atendimentos.
  let lo = Infinity;
  let hi = -Infinity;
  for (const d of days) {
    for (const [a, b] of shiftsOf(d)) {
      lo = Math.min(lo, a);
      hi = Math.max(hi, b);
    }
  }
  if (!Number.isFinite(lo)) {
    lo = 8 * 60;
    hi = 19 * 60;
  }
  for (const d of columns) {
    for (const r of byDay.get(d) ?? []) {
      lo = Math.min(lo, r.start);
      hi = Math.max(hi, r.end);
    }
  }
  const startMin = Math.floor(lo / 60) * 60;
  const endMin = Math.min(1440, Math.ceil(hi / 60) * 60);
  const height = ((endMin - startMin) / 60) * PX_PER_HOUR;
  const hourLabels = Array.from({ length: (endMin - startMin) / 60 }, (_, i) => startMin + i * 60);

  const today = todayInTz(tz, now);
  const nowMin = toMinutes(instantToLocal(now.toISOString(), tz).time);
  const nowTime = instantToLocal(now.toISOString(), tz).time;

  const nextId = appts.data
    .filter((a) => a.status === 'agendado' && new Date(a.starts_at) >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]?.id;

  const toTop = (min: number) => ((min - startMin) / 60) * PX_PER_HOUR;

  const slotAt = (e: MouseEvent<HTMLDivElement>, d: string): number | null => {
    if ((e.target as HTMLElement).closest('button')) return null;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const min = Math.floor((startMin + (y / PX_PER_HOUR) * 60) / slot) * slot;
    return shiftsOf(d).some(([a, b]) => min >= a && min < b) ? min : null;
  };

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white">
      <div
        className="grid"
        style={{ gridTemplateColumns: `48px repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        <div>
          <div className="h-14 border-b border-[#E2E8F0]" />
          <div className="relative" style={{ height }}>
            {hourLabels.map((m) => (
              <span
                key={m}
                className="absolute right-1.5 text-[11px] text-[#64748B]"
                style={{ top: toTop(m) + 2 }}
              >
                {fmt(m)}
              </span>
            ))}
          </div>
        </div>

        {columns.map((d) => {
          const label = weekdayDay(d);
          const shifts = shiftsOf(d);
          const closed = shifts.length === 0;
          const isToday = d === today;
          const all = byDay.get(d) ?? [];
          const shown = all.filter((r) => !status || status.includes(r.appt.status));
          const boxes = layoutDay(
            shown.map((r) => ({ id: r.appt.id, start: fmt(r.start), end: fmt(r.end) })),
            fmt(startMin),
            fmt(endMin),
            PX_PER_HOUR,
          );
          const active = all.filter((r) => r.appt.status !== 'cancelado');

          // Faixas fechadas (almoço, antes/depois do expediente, dia sem turno).
          const hatched: [number, number][] = [];
          let cursor = startMin;
          for (const [a, b] of shifts) {
            if (a > cursor) hatched.push([cursor, a]);
            cursor = Math.max(cursor, b);
          }
          if (cursor < endMin) hatched.push([cursor, endMin]);

          return (
            <div
              key={d}
              role="group"
              aria-label={label}
              aria-current={isToday ? 'date' : undefined}
              className="min-w-0 border-l border-[#E2E8F0]"
            >
              <div
                className={cn(
                  'flex h-14 items-center justify-between gap-1 border-b border-[#E2E8F0] px-2',
                  isToday && 'bg-[#E7F1FF]',
                )}
              >
                <span
                  className={cn(
                    'text-[13px] font-bold',
                    isToday ? 'text-[#0F2D5B]' : 'text-[#334155]',
                  )}
                >
                  {label}
                </span>
                {!closed && (
                  <button
                    type="button"
                    aria-label={`Novo agendamento em ${label}`}
                    onClick={() => open({ date: d })}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-[#1D4ED8] hover:bg-white focus-visible:outline-2 focus-visible:outline-[#2563EB]"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                  </button>
                )}
              </div>
              {/* O clique na área livre complementa o botão "+" do cabeçalho, que é o caminho por teclado. */}
              <div
                data-testid={`col-${d}`}
                className="relative"
                style={{
                  height,
                  backgroundImage: `repeating-linear-gradient(to bottom,#EEF2F6 0 1px,transparent 1px ${PX_PER_HOUR}px)`,
                }}
                onClick={(e) => {
                  const min = slotAt(e, d);
                  if (min !== null) open({ date: d, startTime: fmt(min) });
                }}
                onMouseMove={(e) => {
                  const min = slotAt(e, d);
                  setHover(min === null ? null : { date: d, min });
                }}
                onMouseLeave={() => setHover(null)}
              >
                {hatched.map(([a, b]) => (
                  <div
                    key={a}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0"
                    style={{ top: toTop(a), height: toTop(b) - toTop(a), background: HATCH }}
                  />
                ))}
                {closed && (
                  <span className="pointer-events-none absolute inset-x-0 top-2 text-center text-xs font-semibold text-[#64748B]">
                    Fechado
                  </span>
                )}

                {hover?.date === d && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-1 flex items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-[#3B82F6] bg-white text-xs font-semibold text-[#1D4ED8]"
                    style={{ top: toTop(hover.min), height: (slot / 60) * PX_PER_HOUR }}
                  >
                    <Plus className="size-3.5" />
                    Agendar {fmt(hover.min)}
                  </div>
                )}

                {shown.map((r, i) => {
                  const box = boxes[i]!;
                  const a = r.appt;
                  const cancelled = a.status === 'cancelado';
                  const overlapsActive =
                    cancelled && active.some((o) => o.start < r.end && o.end > r.start);
                  const next = a.id === nextId;
                  const Icon = statusMeta[a.status].icon;
                  const range = `${fmt(r.start)}–${fmt(r.end)}`;
                  const compact = box.height < 40;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      aria-label={`${a.client_name}, ${range}, ${statusMeta[a.status].label}`}
                      onClick={() => openAppointment(a.id)}
                      className={cn(
                        'absolute flex flex-col gap-px overflow-hidden rounded-[10px] border px-2 py-1 text-left text-xs leading-tight focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2563EB]',
                        EVENT_COLORS[a.status],
                        next && 'border-[#0F2D5B] bg-[#0F2D5B] text-white',
                        overlapsActive ? 'z-0 left-[58%] right-1' : 'left-1 right-1 z-10',
                        compact && 'justify-center',
                      )}
                      style={{ top: box.top, height: box.height }}
                    >
                      <b
                        title={a.client_name}
                        className={cn('truncate font-semibold', cancelled && 'line-through')}
                      >
                        {a.client_name}
                      </b>
                      {!compact && (
                        <span className="flex items-center gap-1">
                          <Icon aria-hidden="true" className="size-3 shrink-0" />
                          <span className="truncate">
                            {next ? `${fmt(r.start)} · Próximo` : range}
                          </span>
                        </span>
                      )}
                      {box.height >= 64 && (
                        <span title={a.service_name} className="truncate opacity-80">
                          {a.service_name}
                        </span>
                      )}
                    </button>
                  );
                })}

                {isToday && nowMin >= startMin && nowMin <= endMin && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20"
                    style={{ top: toTop(nowMin) - 8 }}
                  >
                    <NowLine time={nowTime} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekStrip({ date, tz, status, onDate }: Props) {
  const { days, appts, hours } = useWeekData(date, tz);
  const now = useNow();

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

  const byDay = rowsOf(appts.data, tz);
  const today = todayInTz(tz, now);

  return (
    <div className="flex flex-col gap-3.5">
      <div role="group" aria-label="Dias da semana" className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const active = (byDay.get(d) ?? []).filter((r) => r.appt.status !== 'cancelado');
          const n = active.length;
          const hasFree =
            freeIntervals(
              d,
              tz,
              hours.data,
              active.map((r) => ({ startsAt: r.appt.starts_at, endsAt: r.appt.ends_at })),
              now,
            ).length > 0;
          const selected = d === date;
          const label = weekdayDay(d);
          const [wd, num] = label.split(' ');
          return (
            <button
              key={d}
              type="button"
              aria-pressed={selected}
              aria-label={`${label}, ${n} ${n === 1 ? 'atendimento' : 'atendimentos'}, ${
                hasFree ? 'com horário livre' : 'sem horário livre'
              }`}
              onClick={() => onDate(d)}
              className={cn(
                'flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[14px] border text-[#0F2D5B] focus-visible:outline-2 focus-visible:outline-[#2563EB]',
                selected
                  ? 'border-[#0F2D5B] bg-[#0F2D5B] text-white'
                  : d === today
                    ? 'border-[#3B82F6] bg-[#E7F1FF]'
                    : 'border-[#E2E8F0] bg-white',
              )}
            >
              <span aria-hidden="true" className="text-[11px] font-semibold">
                {wd}
              </span>
              <b aria-hidden="true" className="font-[Manrope,sans-serif] text-base font-extrabold">
                {num}
              </b>
              <span aria-hidden="true" className="flex h-3 items-center gap-1 text-[11px]">
                {n}
                {hasFree && <span className="size-1.5 rounded-full bg-[#3B82F6]" />}
              </span>
            </button>
          );
        })}
      </div>
      <DayView date={date} tz={tz} status={status} />
    </div>
  );
}
