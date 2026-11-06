import { useMemo, useState, type MouseEvent } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import { instantToLocal, todayInTz } from '@/lib/time';
import type { Appointment } from '@/features/appointments/api';
import { ceilNowToStep, freeIntervals } from '@/features/appointments/domain/freeSlots';
import { statusMeta, type AppointmentStatus } from '@/features/appointments/domain/status';
import { useNewAppointment } from '@/features/appointments/components/NewAppointmentProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { toMinutes, weekdayDay } from '../dates';
import { eventPlacement, layoutDay, type LayoutBox } from '../layout/eventLayout';
import { useNow } from '../useNow';
import { useOpenAppointment } from '../useOpenAppointment';
import { NowLine } from '../components/NowLine';
import { DayView } from './DayView';
import { rowsOf, shiftsOf, useWeekData, visibleDays, type Row, type Shift } from './weekData';

type Props = {
  date: string;
  tz: string;
  status: AppointmentStatus[] | null;
  onDate: (date: string) => void;
};

const PX_PER_HOUR = 52;
const HATCH = 'repeating-linear-gradient(135deg,var(--muted) 0 6px,var(--background) 6px 12px)';
const fmt = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const EVENT_COLORS: Record<AppointmentStatus, string> = {
  agendado: 'border-status-agendado-border bg-status-agendado text-status-agendado-foreground',
  concluido: 'border-status-concluido-border bg-status-concluido text-status-concluido-foreground',
  nao_compareceu:
    'border-status-nao-compareceu-border bg-status-nao-compareceu text-status-nao-compareceu-foreground',
  cancelado:
    'border-dashed border-status-cancelado-border bg-status-cancelado text-status-cancelado-foreground',
};

type EventModel = { row: Row; box: LayoutBox; overlapsOther: boolean };
type ColumnModel = {
  d: string;
  shifts: [number, number][];
  hatched: [number, number][];
  events: EventModel[];
};
type GridModel = { startMin: number; endMin: number; columns: ColumnModel[] };

function buildGrid(
  days: string[],
  hours: Shift[],
  byDay: Map<string, Row[]>,
  status: AppointmentStatus[] | null,
): GridModel {
  const visible = visibleDays(days, hours, byDay);
  // Faixa de horas da semana: menor início e maior fim dos turnos; amplia para não esconder atendimentos.
  let lo = Infinity;
  let hi = -Infinity;
  for (const d of days) {
    for (const [a, b] of shiftsOf(hours, d)) {
      lo = Math.min(lo, a);
      hi = Math.max(hi, b);
    }
  }
  if (!Number.isFinite(lo)) {
    lo = 8 * 60;
    hi = 19 * 60;
  }
  for (const d of visible) {
    for (const r of byDay.get(d) ?? []) {
      lo = Math.min(lo, r.start);
      hi = Math.max(hi, r.end);
    }
  }
  const startMin = Math.floor(lo / 60) * 60;
  const endMin = Math.min(1440, Math.ceil(hi / 60) * 60);

  const columns = visible.map((d): ColumnModel => {
    const shifts = shiftsOf(hours, d);
    const shown = (byDay.get(d) ?? []).filter((r) => !status || status.includes(r.appt.status));
    const boxes = layoutDay(
      shown.map((r) => ({ id: r.appt.id, start: fmt(r.start), end: fmt(r.end) })),
      fmt(startMin),
      fmt(endMin),
      PX_PER_HOUR,
    );
    const events = shown.map((row, i): EventModel => {
      const cancelled = row.appt.status === 'cancelado';
      const overlapsOther = shown.some(
        (o) =>
          o !== row &&
          (o.appt.status === 'cancelado') !== cancelled &&
          o.start < row.end &&
          o.end > row.start,
      );
      return { row, box: boxes[i]!, overlapsOther };
    });
    const hatched: [number, number][] = [];
    let cursor = startMin;
    for (const [a, b] of shifts) {
      if (a > cursor) hatched.push([cursor, a]);
      cursor = Math.max(cursor, b);
    }
    if (cursor < endMin) hatched.push([cursor, endMin]);
    return { d, shifts, hatched, events };
  });
  return { startMin, endMin, columns };
}

export function WeekView(props: Props) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  return desktop ? <WeekGrid {...props} /> : <WeekStrip {...props} />;
}

function WeekGrid({ date, tz, status }: Props) {
  const { days, appts, hours, slot } = useWeekData(date, tz);

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
  return (
    <WeekGridBody
      days={days}
      appts={appts.data}
      hours={hours.data}
      tz={tz}
      status={status}
      slot={slot}
    />
  );
}

function WeekGridBody({
  days,
  appts,
  hours,
  tz,
  status,
  slot,
}: {
  days: string[];
  appts: Appointment[];
  hours: Shift[];
  tz: string;
  status: AppointmentStatus[] | null;
  slot: number;
}) {
  const { open } = useNewAppointment();
  const openAppointment = useOpenAppointment();
  const now = useNow();
  const [hover, setHover] = useState<{ date: string; min: number } | null>(null);

  const model = useMemo(
    () => buildGrid(days, hours, rowsOf(appts, tz), status),
    // `days` é recriado a cada render; a semana é identificada pelo primeiro dia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days[0], appts, hours, tz, status],
  );
  const { startMin, endMin, columns } = model;

  if (columns.length === 0) {
    return <EmptyState title="Nenhum dia de atendimento nesta semana." />;
  }

  const height = ((endMin - startMin) / 60) * PX_PER_HOUR;
  const hourLabels = Array.from({ length: (endMin - startMin) / 60 }, (_, i) => startMin + i * 60);

  const today = todayInTz(tz, now);
  const nowLocal = instantToLocal(now.toISOString(), tz).time;
  const nowMin = toMinutes(nowLocal);
  // Mesmo piso de freeIntervals: agora arredondado para cima ao próximo múltiplo de 5 min.
  const floorNow = ceilNowToStep(now, tz);

  // "Próximo" só vale na semana que contém hoje.
  const nextId = days.includes(today)
    ? appts
        .filter((a) => a.status === 'agendado' && new Date(a.starts_at) >= now)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]?.id
    : undefined;

  const toTop = (min: number) => ((min - startMin) / 60) * PX_PER_HOUR;

  /** Horário clicável sob o ponteiro: dentro de um turno, nunca no passado, arredondado ao intervalo. */
  const slotAt = (e: MouseEvent<HTMLDivElement>, c: ColumnModel): number | null => {
    if ((e.target as HTMLElement).closest('button')) return null;
    if (c.d < today) return null;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const raw = Math.floor(startMin + (y / PX_PER_HOUR) * 60);
    const shift = c.shifts.find(([a, b]) => raw >= a && raw < b);
    if (!shift) return null;
    const min = Math.max(Math.floor(raw / slot) * slot, shift[0]);
    if (c.d === today && min < floorNow) return null;
    return min;
  };

  return (
    <div className="overflow-hidden rounded-card border border-border bg-card">
      <div
        className="grid"
        style={{ gridTemplateColumns: `48px repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        <div>
          <div className="h-14 border-b border-border" />
          <div className="relative" style={{ height }}>
            {hourLabels.map((m) => (
              <span
                key={m}
                className="absolute right-1.5 text-[11px] tabular-nums text-muted-foreground"
                style={{ top: toTop(m) + 2 }}
              >
                {fmt(m)}
              </span>
            ))}
          </div>
        </div>

        {columns.map((c) => {
          const d = c.d;
          const label = weekdayDay(d);
          const closed = c.shifts.length === 0;
          const isToday = d === today;

          return (
            <div
              key={d}
              role="group"
              aria-label={label}
              aria-current={isToday ? 'date' : undefined}
              className="min-w-0 border-l border-border"
            >
              <div
                className={cn(
                  'flex h-14 items-center justify-between gap-1 border-b border-border px-2',
                  isToday && 'bg-primary text-primary-foreground',
                )}
              >
                <span
                  className={cn(
                    'text-[13px] font-bold',
                    isToday ? 'text-primary-foreground' : 'text-foreground-secondary',
                  )}
                >
                  {label}
                </span>
                {!closed && (
                  <button
                    type="button"
                    aria-label={`Novo agendamento em ${label}`}
                    onClick={() => open({ date: d })}
                    className={cn(
                      'grid size-11 shrink-0 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-ring',
                      isToday
                        ? 'text-primary-foreground hover:bg-primary-hover focus-visible:outline-primary-foreground'
                        : 'text-link hover:bg-card',
                    )}
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
                  backgroundImage: `repeating-linear-gradient(to bottom,var(--border) 0 1px,transparent 1px ${PX_PER_HOUR}px)`,
                }}
                onClick={(e) => {
                  const min = slotAt(e, c);
                  if (min !== null) open({ date: d, startTime: fmt(min) });
                }}
                onMouseMove={(e) => {
                  const min = slotAt(e, c);
                  // Mesmo valor devolve o mesmo objeto: o React não re-renderiza a grade.
                  setHover((prev) =>
                    min === null
                      ? prev === null
                        ? prev
                        : null
                      : prev && prev.date === d && prev.min === min
                        ? prev
                        : { date: d, min },
                  );
                }}
                onMouseLeave={() => setHover(null)}
              >
                {c.hatched.map(([a, b]) => (
                  <div
                    key={a}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0"
                    style={{ top: toTop(a), height: toTop(b) - toTop(a), background: HATCH }}
                  />
                ))}
                {closed && (
                  <span className="pointer-events-none absolute inset-x-0 top-2 text-center text-xs font-semibold text-muted-foreground">
                    Fechado
                  </span>
                )}

                {hover?.date === d && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-1 flex items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-primary bg-card text-xs font-semibold text-link"
                    style={{ top: toTop(hover.min), height: (slot / 60) * PX_PER_HOUR }}
                  >
                    <Plus className="size-3.5" />
                    Agendar {fmt(hover.min)}
                  </div>
                )}

                {c.events.map(({ row: r, box, overlapsOther }) => {
                  const a = r.appt;
                  const cancelled = a.status === 'cancelado';
                  const next = a.id === nextId;
                  const meta = statusMeta[a.status];
                  const Icon = meta.icon;
                  const range = `${fmt(r.start)}–${fmt(r.end)}`;
                  const compact = box.height < 40;
                  const statusLine = next
                    ? `Próximo · ${fmt(r.start)}`
                    : cancelled
                      ? meta.label
                      : a.status === 'nao_compareceu'
                        ? `Faltou · ${fmt(r.start)}`
                        : `${meta.label} · ${range}`;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      title={meta.label}
                      aria-label={`${a.client_name}, ${range}, ${meta.label}`}
                      onClick={() => openAppointment(a.id)}
                      className={cn(
                        'absolute flex gap-px overflow-hidden rounded-[10px] border px-2 py-1 text-left text-xs leading-tight focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                        compact ? 'flex-row items-center gap-1' : 'flex-col',
                        next
                          ? 'border-primary bg-primary text-primary-foreground'
                          : EVENT_COLORS[a.status],
                        eventPlacement(cancelled, overlapsOther),
                      )}
                      style={{ top: box.top, height: box.height }}
                    >
                      {compact && <Icon aria-hidden="true" className="size-3 shrink-0" />}
                      <b
                        title={a.client_name}
                        className={cn('truncate font-semibold', cancelled && 'line-through')}
                      >
                        {a.client_name}
                      </b>
                      {!compact && (
                        <span className="flex items-center gap-1">
                          <Icon aria-hidden="true" className="size-3 shrink-0" />
                          <span className="truncate">{statusLine}</span>
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
                    style={{ top: toTop(nowMin) - 4 }}
                  >
                    <NowLine time={nowLocal} variant="line" />
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
      <div
        role="group"
        aria-label="Dias da semana"
        className="grid grid-cols-7 gap-0.5 max-[359px]:-mx-3 max-[359px]:gap-0"
      >
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
                'flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[14px] border text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : d === today
                    ? 'border-primary bg-secondary'
                    : 'border-border bg-card',
              )}
            >
              <span aria-hidden="true" className="text-[11px] font-semibold">
                {wd}
              </span>
              <b aria-hidden="true" className="font-display text-base font-extrabold">
                {num}
              </b>
              <span aria-hidden="true" className="flex h-3 items-center gap-1 text-[11px]">
                {n}
                {hasFree && <span className="size-1.5 rounded-full bg-primary" />}
              </span>
            </button>
          );
        })}
      </div>
      <DayView date={date} tz={tz} status={status} />
    </div>
  );
}
