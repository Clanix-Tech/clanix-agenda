import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AppointmentStatus } from '@/features/appointments/domain/status';
import { weekDays } from '@/lib/time';
import {
  dayAndMonth,
  monthTitle,
  shiftDate,
  shiftMonth,
  shortDM,
  WEEKDAYS_LONG,
  weekdayOf,
  weekRangeTitle,
} from '../dates';
import type { AgendaView } from '../useAgendaParams';
import { StatusFilter } from './StatusFilter';
import { ViewSwitcher } from './ViewSwitcher';

type Props = {
  view: AgendaView;
  date: string;
  today: string;
  status: AppointmentStatus[] | null;
  weekStartsOn?: 0 | 1;
  /** Dias com coluna na grade da semana; o título usa o primeiro e o último. */
  visibleDays?: string[] | null;
  onView: (v: AgendaView) => void;
  onDate: (d: string) => void;
  onStatus: (s: AppointmentStatus[] | null) => void;
};

const ib =
  'grid size-11 shrink-0 place-items-center rounded-[14px] text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring';

export function AgendaToolbar({
  view,
  date,
  today,
  status,
  weekStartsOn = 1,
  visibleDays,
  onView,
  onDate,
  onStatus,
}: Props) {
  const list = view === 'lista';
  const week = view === 'semana';
  const month = view === 'mes';
  const weekday = WEEKDAYS_LONG[weekdayOf(date)];
  const days = week ? weekDays(date, weekStartsOn) : [];
  const sub = list
    ? 'Próximos 30 dias'
    : week
      ? days.includes(today)
        ? 'Esta semana'
        : 'Semana'
      : month
        ? 'Mês'
        : date === today
          ? `${weekday} · hoje`
          : weekday;
  const title = list
    ? `A partir de ${shortDM(date)}`
    : week
      ? weekRangeTitle(
          ...((visibleDays?.length
            ? [visibleDays[0]!, visibleDays.at(-1)!]
            : [days[0]!, days[6]!]) as [string, string]),
        )
      : month
        ? monthTitle(date)
        : dayAndMonth(date);
  const prevLabel = week || list ? 'Semana anterior' : month ? 'Mês anterior' : 'Dia anterior';
  const nextLabel = week || list ? 'Próxima semana' : month ? 'Próximo mês' : 'Próximo dia';
  const go = (dir: 1 | -1) =>
    onDate(month ? shiftMonth(date, dir) : shiftDate(date, dir * (week || list ? 7 : 1)));
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-card p-1.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-4 lg:p-3">
      <div className="flex items-center justify-between gap-1 lg:justify-start lg:gap-2">
        <button
          type="button"
          onClick={() => onDate(today)}
          className="h-11 rounded-[14px] bg-secondary px-3.5 text-sm font-bold text-secondary-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          Hoje
        </button>
        <button type="button" aria-label={prevLabel} onClick={() => go(-1)} className={ib}>
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <div className="min-w-0 flex-1 text-center lg:min-w-44 lg:flex-none">
          <div className="text-xs font-semibold text-muted-foreground">{sub}</div>
          <div className="font-display text-lg font-extrabold text-foreground">{title}</div>
        </div>
        <button type="button" aria-label={nextLabel} onClick={() => go(1)} className={ib}>
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
      </div>
      <div className="lg:ml-auto">
        <ViewSwitcher view={view} onChange={onView} />
      </div>
      <div className="min-w-0 lg:order-last lg:w-full">
        <StatusFilter value={status} onChange={onStatus} />
      </div>
    </div>
  );
}
