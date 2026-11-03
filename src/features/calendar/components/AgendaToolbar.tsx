import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AppointmentStatus } from '@/features/appointments/domain/status';
import { dayAndMonth, shiftDate, shortDM, WEEKDAYS_LONG, weekdayOf } from '../dates';
import type { AgendaView } from '../useAgendaParams';
import { StatusFilter } from './StatusFilter';
import { ViewSwitcher } from './ViewSwitcher';

type Props = {
  view: AgendaView;
  date: string;
  today: string;
  status: AppointmentStatus[] | null;
  onView: (v: AgendaView) => void;
  onDate: (d: string) => void;
  onStatus: (s: AppointmentStatus[] | null) => void;
};

const ib =
  'grid size-11 shrink-0 place-items-center rounded-[14px] text-[#0F2D5B] hover:bg-[#F1F5F9] focus-visible:outline-2 focus-visible:outline-[#2563EB]';

export function AgendaToolbar({ view, date, today, status, onView, onDate, onStatus }: Props) {
  const list = view === 'lista';
  const step = list ? 7 : 1;
  const weekday = WEEKDAYS_LONG[weekdayOf(date)];
  const sub = list ? 'Próximos 30 dias' : date === today ? `${weekday} · hoje` : weekday;
  const title = list ? `A partir de ${shortDM(date)}` : dayAndMonth(date);
  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-[#E2E8F0] bg-white p-1.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-4 lg:p-3">
      <div className="flex items-center justify-between gap-1 lg:justify-start lg:gap-2">
        <button
          type="button"
          onClick={() => onDate(today)}
          className="h-11 rounded-[14px] bg-[#E7F1FF] px-3.5 text-sm font-bold text-[#0F2D5B] focus-visible:outline-2 focus-visible:outline-[#2563EB]"
        >
          Hoje
        </button>
        <button
          type="button"
          aria-label={list ? 'Semana anterior' : 'Dia anterior'}
          onClick={() => onDate(shiftDate(date, -step))}
          className={ib}
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <div className="min-w-0 flex-1 text-center lg:min-w-44 lg:flex-none">
          <div className="text-xs font-semibold text-[#64748B]">{sub}</div>
          <div className="font-[Manrope,sans-serif] text-lg font-extrabold text-[#0F2D5B]">
            {title}
          </div>
        </div>
        <button
          type="button"
          aria-label={list ? 'Próxima semana' : 'Próximo dia'}
          onClick={() => onDate(shiftDate(date, step))}
          className={ib}
        >
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
