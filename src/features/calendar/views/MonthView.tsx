import { Link, useSearchParams } from 'react-router';
import { cn } from '@/lib/utils';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import { instantToLocal, localToInstant, monthMatrix, todayInTz } from '@/lib/time';
import { useAppointmentsRange, type Appointment } from '@/features/appointments/api';
import { statusMeta, type AppointmentStatus } from '@/features/appointments/domain/status';
import { APPOINTMENT_PARAM } from '@/features/appointments/openParam';
import { useBusinessHours } from '@/features/business-hours/api';
import { useProfile } from '@/features/profile/api';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { dayAndMonth, shiftDate, weekdayDay, weekdayOf } from '../dates';
import { useNow } from '../useNow';
import { useOpenAppointment } from '../useOpenAppointment';

type Props = { date: string; tz: string; status: AppointmentStatus[] | null };

const HATCH = 'repeating-linear-gradient(135deg,#F1F5F9 0 6px,#F8FAFC 6px 12px)';

export function MonthView({ date, tz, status }: Props) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const profile = useProfile();
  const weekStartsOn: 0 | 1 = profile.data?.week_starts_on === 0 ? 0 : 1;
  const weeks = monthMatrix(date, weekStartsOn);
  const first = weeks[0]![0]!;
  const last = weeks[weeks.length - 1]![6]!;
  const appts = useAppointmentsRange(
    localToInstant(first, '00:00', tz),
    localToInstant(shiftDate(last, 1), '00:00', tz),
  );
  const hours = useBusinessHours();
  const openAppointment = useOpenAppointment();
  const [sp] = useSearchParams();
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

  const today = todayInTz(tz, now);
  const openWeekdays = new Set(hours.data.map((s) => s.weekday));
  const byDay = new Map<string, Appointment[]>();
  for (const a of appts.data) {
    const d = instantToLocal(a.starts_at, tz).date;
    byDay.set(d, [...(byDay.get(d) ?? []), a]);
  }
  const month = date.slice(0, 7);

  const dayLink = (d: string) => {
    const next = new URLSearchParams(sp);
    next.delete(APPOINTMENT_PARAM);
    next.set('visao', 'dia');
    next.set('data', d);
    return { search: `?${next.toString()}` };
  };

  if (!desktop) {
    return (
      <div>
        <div
          aria-hidden="true"
          className="mb-1 grid grid-cols-7 gap-0.5 max-[359px]:-mx-3 max-[359px]:gap-0 text-center text-[11px] font-semibold text-[#64748B]"
        >
          {weeks[0]!.map((d) => (
            <span key={d}>{weekdayDay(d).split(' ')[0]}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 max-[359px]:-mx-3 max-[359px]:gap-0">
          {weeks.flat().map((d) => {
            const n = (byDay.get(d) ?? []).filter((a) => a.status !== 'cancelado').length;
            const closed = !openWeekdays.has(weekdayOf(d));
            return (
              <Link
                key={d}
                to={dayLink(d)}
                aria-label={`${dayAndMonth(d)}, ${n} ${n === 1 ? 'atendimento' : 'atendimentos'}${
                  closed ? ', fechado' : ''
                }`}
                aria-current={d === today ? 'date' : undefined}
                className={cn(
                  'flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border text-[#0F2D5B] focus-visible:outline-2 focus-visible:outline-[#2563EB]',
                  d === today ? 'border-[#3B82F6]' : 'border-[#E2E8F0]',
                  d.slice(0, 7) !== month && 'opacity-50',
                )}
                style={closed ? { background: HATCH } : { background: '#fff' }}
              >
                <b aria-hidden="true" className="text-sm font-bold">
                  {Number(d.slice(8, 10))}
                </b>
                <span
                  aria-hidden="true"
                  className="flex h-3 items-center gap-0.5 text-[10px] font-semibold text-[#1D4ED8]"
                >
                  {n > 0 && (
                    <>
                      <span className="size-1.5 rounded-full bg-[#3B82F6]" />
                      {n}
                    </>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white">
      <div className="grid grid-cols-7 border-b border-[#E2E8F0] bg-[#F8FAFC]">
        {weeks[0]!.map((d) => (
          <div key={d} className="px-3 py-2 text-xs font-bold text-[#64748B]">
            {weekdayDay(d).split(' ')[0]}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((d) => {
          const closed = !openWeekdays.has(weekdayOf(d));
          const isToday = d === today;
          const list = (byDay.get(d) ?? [])
            .filter((a) => !status || status.includes(a.status))
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
          const extra = list.length - 2;
          return (
            <div
              key={d}
              role="group"
              aria-label={dayAndMonth(d)}
              aria-current={isToday ? 'date' : undefined}
              className={cn(
                'flex min-h-[112px] min-w-0 flex-col gap-1 border p-1.5',
                isToday ? 'border-[#3B82F6]' : 'border-[#E2E8F0]',
                d.slice(0, 7) !== month && 'opacity-60',
              )}
              style={closed ? { background: HATCH } : undefined}
            >
              <div className="flex items-center justify-between">
                <Link
                  to={dayLink(d)}
                  aria-label={`Ver dia ${dayAndMonth(d)}`}
                  className={cn(
                    'grid h-7 min-w-7 place-items-center rounded-full px-1 text-[13px] font-bold text-[#0F2D5B] hover:bg-[#E7F1FF] focus-visible:outline-2 focus-visible:outline-[#2563EB]',
                    isToday && 'bg-[#E7F1FF]',
                  )}
                >
                  {Number(d.slice(8, 10))}
                </Link>
                {closed && (
                  <span className="text-[11px] font-semibold text-[#64748B]">Fechado</span>
                )}
              </div>
              {list.slice(0, 2).map((a) => {
                const past = new Date(a.ends_at) <= now;
                const cancelled = a.status === 'cancelado';
                const s = instantToLocal(a.starts_at, tz).time;
                const e = instantToLocal(a.ends_at, tz).time;
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-label={`${a.client_name}, ${s}–${e}, ${statusMeta[a.status].label}`}
                    onClick={() => openAppointment(a.id)}
                    className={cn(
                      'flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11px] focus-visible:outline-2 focus-visible:outline-[#2563EB]',
                      past || cancelled
                        ? 'bg-[#F1F5F9] text-[#475569]'
                        : 'bg-[#E7F1FF] text-[#1D4ED8]',
                    )}
                  >
                    <span className="shrink-0 font-semibold">{s}</span>
                    <span
                      title={a.client_name}
                      className={cn('truncate', cancelled && 'line-through')}
                    >
                      {a.client_name}
                    </span>
                  </button>
                );
              })}
              {extra > 0 && (
                <Link
                  to={dayLink(d)}
                  className="px-1.5 py-1 text-[11px] font-semibold text-[#1D4ED8] hover:underline focus-visible:outline-2 focus-visible:outline-[#2563EB]"
                >
                  +{extra} mais
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
