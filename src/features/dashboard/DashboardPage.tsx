import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import {
  formatLongDate,
  instantToLocal,
  localToInstant,
  monthMatrix,
  todayInTz,
  weekDays,
} from '@/lib/time';
import { useAppointmentsRange, type Appointment } from '@/features/appointments/api';
import { freeIntervals } from '@/features/appointments/domain/freeSlots';
import { useNewAppointment } from '@/features/appointments/components/NewAppointmentProvider';
import { useBusinessHours } from '@/features/business-hours/api';
import { useProfile } from '@/features/profile/api';
import { StatusBadge } from '@/components/status/StatusBadge';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { shiftDate, shiftMonth, toMinutes, weekdayDay, weekdayOf } from '@/features/calendar/dates';
import { useNow } from '@/features/calendar/useNow';
import { useOpenAppointment } from '@/features/calendar/useOpenAppointment';
import { computeIndicators } from './domain/indicators';

const NOW_PLUS_DAYS = 14;
const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]';

function greeting(hour: number): string {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** "em 20 min", "em 3 h", "às 17:00", "amanhã às 09:00", "Sex 30 às 09:00". */
function whenLabel(a: Appointment, tz: string, now: Date, today: string): string {
  const diffMin = Math.floor((new Date(a.starts_at).getTime() - now.getTime()) / 60_000);
  if (diffMin < 60) return `em ${Math.max(diffMin, 0)} min`;
  if (diffMin < 360) return `em ${Math.floor(diffMin / 60)} h`;
  const { date, time } = instantToLocal(a.starts_at, tz);
  if (date === today) return `às ${time}`;
  if (date === shiftDate(today, 1)) return `amanhã às ${time}`;
  return `${weekdayDay(date)} às ${time}`;
}

function dayLabel(date: string, today: string): string {
  if (date === today) return 'Hoje';
  if (date === shiftDate(today, 1)) return 'Amanhã';
  const w = weekdayDay(date).split(' ')[0];
  return `${w}, ${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-[18px] border border-[#E2E8F0] bg-white p-3.5">
      <p className="text-xs font-semibold text-[#64748B]">{label}</p>
      <p className="font-[Manrope,sans-serif] text-[28px] leading-tight font-extrabold text-[#0F2D5B]">
        {value}
      </p>
      {hint && <p className="text-xs text-[#64748B]">{hint}</p>}
    </div>
  );
}

function MiniCalendar({
  today,
  weekStartsOn,
  counts,
  openWeekdays,
}: {
  today: string;
  weekStartsOn: 0 | 1;
  counts: Map<string, number>;
  openWeekdays: Set<number>;
}) {
  const weeks = monthMatrix(today, weekStartsOn);
  const month = today.slice(0, 7);
  return (
    <section
      aria-label="Calendário do mês"
      className="rounded-[18px] border border-[#E2E8F0] bg-white p-4"
    >
      <div
        aria-hidden="true"
        className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold text-[#64748B]"
      >
        {weeks[0]!.map((d) => (
          <span key={d}>{weekdayDay(d).split(' ')[0]}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((d) => {
          const n = counts.get(d) ?? 0;
          const muted = weekdayOf(d) === 0 || !openWeekdays.has(weekdayOf(d));
          return (
            <Link
              key={d}
              to={`/agenda?visao=dia&data=${d}`}
              aria-label={`${Number(d.slice(8, 10))}/${d.slice(5, 7)}${n > 0 ? ', com atendimentos' : ''}`}
              aria-current={d === today ? 'date' : undefined}
              className={cn(
                'flex h-9 flex-col items-center justify-center rounded-lg text-sm font-semibold',
                FOCUS,
                d === today ? 'bg-[#0F2D5B] text-white' : 'text-[#0F2D5B]',
                muted && d !== today && 'text-[#94A3B8]',
                d.slice(0, 7) !== month && 'opacity-40',
              )}
            >
              <span aria-hidden="true">{Number(d.slice(8, 10))}</span>
              <span
                aria-hidden="true"
                className={cn(
                  'size-1 rounded-full',
                  n > 0 ? (d === today ? 'bg-white' : 'bg-[#3B82F6]') : 'bg-transparent',
                )}
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const profile = useProfile();
  const hours = useBusinessHours();
  const { open } = useNewAppointment();
  const openAppointment = useOpenAppointment();
  const now = useNow();

  const tz = profile.data?.timezone ?? 'America/Sao_Paulo';
  const weekStartsOn: 0 | 1 = profile.data?.week_starts_on === 0 ? 0 : 1;
  const today = todayInTz(tz, now);

  // Uma consulta cobre o mês, a semana e os próximos 14 dias.
  const monthStart = `${today.slice(0, 8)}01`;
  const monthEnd = shiftMonth(monthStart, 1);
  const week = weekDays(today, weekStartsOn);
  const from = [monthStart, week[0]!].sort()[0]!;
  const to = [monthEnd, shiftDate(week[6]!, 1), shiftDate(today, NOW_PLUS_DAYS + 1)].sort().at(-1)!;
  const appts = useAppointmentsRange(
    localToInstant(from, '00:00', tz),
    localToInstant(to, '00:00', tz),
  );

  if (profile.isPending || hours.isPending || appts.isPending) {
    return <LoadingState label="Carregando seu painel…" />;
  }
  if (profile.isError || hours.isError || appts.isError) {
    return (
      <ErrorState
        message="Não foi possível carregar o painel."
        onRetry={() => {
          void profile.refetch();
          void hours.refetch();
          void appts.refetch();
        }}
      />
    );
  }

  const rows = appts.data;
  const ind = computeIndicators(rows, tz, now, weekStartsOn);
  const nowLocal = instantToLocal(now.toISOString(), tz);
  const firstName = (profile.data.display_name ?? '').trim().split(/\s+/)[0] ?? '';

  const upcoming = rows
    .filter((a) => a.status === 'agendado' && new Date(a.starts_at) >= now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 5);

  // Horários livres de hoje, sem passado (mesmo piso de 5 min da visão Dia).
  const nowMin = toMinutes(nowLocal.time);
  const floor =
    Math.ceil((nowMin + (now.getUTCSeconds() || now.getUTCMilliseconds() ? 1 : 0)) / 5) * 5;
  const free = freeIntervals(
    today,
    tz,
    hours.data,
    rows
      .filter((a) => a.status !== 'cancelado' && instantToLocal(a.starts_at, tz).date === today)
      .map((a) => ({ startsAt: a.starts_at, endsAt: a.ends_at })),
    new Date(localToInstant(today, '00:00', tz)),
  ).filter((f) => floor < toMinutes(f.end));
  const fmt = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

  const counts = new Map<string, number>();
  for (const a of rows) {
    if (a.status === 'cancelado') continue;
    const d = instantToLocal(a.starts_at, tz).date;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const openWeekdays = new Set(hours.data.map((s) => s.weekday));
  const next = ind.next;

  const newBtn = (
    <button
      type="button"
      onClick={() => open()}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-5 text-sm font-semibold text-white',
        FOCUS,
      )}
    >
      <Plus aria-hidden="true" className="size-4" />
      Novo agendamento
    </button>
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 pt-5 pb-6 lg:px-8 lg:pt-8">
      <header>
        <h1 className="font-[Manrope,sans-serif] text-2xl font-extrabold text-[#0F2D5B]">
          {greeting(Number(nowLocal.time.slice(0, 2)))}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-sm text-[#64748B]">
          {formatLongDate(now.toISOString(), tz)} · {nowLocal.date.slice(8, 10)}/
          {nowLocal.date.slice(5, 7)}/{nowLocal.date.slice(0, 4)}
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-[18px] border border-[#E2E8F0] bg-white">
          <EmptyState
            title="Sua agenda está livre. Que tal marcar o primeiro atendimento?"
            action={newBtn}
          />
        </div>
      ) : next ? (
        <section
          aria-label="Próximo atendimento"
          className="rounded-[22px] bg-[#0F2D5B] p-5 text-white"
        >
          <p className="text-xs font-semibold tracking-wide text-[#CBD5E1] uppercase">
            Próximo atendimento
          </p>
          <p className="mt-1 font-[Manrope,sans-serif] text-2xl font-extrabold">
            {whenLabel(next, tz, now, today)}
          </p>
          <p title={next.client_name} className="mt-2 truncate text-lg font-semibold">
            {next.client_name}
          </p>
          <p title={next.service_name} className="truncate text-sm text-[#CBD5E1]">
            {next.service_name}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => openAppointment(next.id)}
              className={cn(
                'min-h-11 rounded-xl bg-white px-5 text-sm font-semibold text-[#0F2D5B]',
                FOCUS,
              )}
            >
              Ver detalhes
            </button>
            <Link
              to={`/agenda/remarcar/${next.id}`}
              className={cn(
                'inline-flex min-h-11 items-center rounded-xl border border-white/60 px-5 text-sm font-semibold text-white',
                FOCUS,
              )}
            >
              Remarcar
            </Link>
          </div>
        </section>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-[18px] border border-[#E2E8F0] bg-white p-6 text-center">
          <p className="text-[#334155]">Nenhum atendimento agendado a seguir.</p>
          {newBtn}
        </div>
      )}

      <div className={cn('grid gap-5', desktop && 'grid-cols-[1fr_320px] items-start')}>
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-label="Indicadores" className="grid grid-cols-3 gap-2.5">
            <Kpi
              label="Hoje"
              value={ind.today}
              hint={`${ind.todayRemaining} ${ind.todayRemaining === 1 ? 'restante' : 'restantes'}`}
            />
            <Kpi label="Semana" value={ind.week} />
            <Kpi label="Cancelamentos do mês" value={ind.monthCancellations} />
          </section>

          <section aria-labelledby="livres-hoje">
            <h2
              id="livres-hoje"
              className="mb-2 font-[Manrope,sans-serif] text-lg font-bold text-[#0F2D5B]"
            >
              Horários livres hoje
            </h2>
            {free.length === 0 ? (
              <p className="text-sm text-[#64748B]">Sem horários livres hoje.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {free.map((f) => {
                  const startTime = toMinutes(f.start) < floor ? fmt(floor) : f.start;
                  return (
                    <button
                      key={f.start}
                      type="button"
                      onClick={() => open({ date: today, startTime })}
                      className={cn(
                        'min-h-11 rounded-xl border-[1.5px] border-dashed border-[#93C5FD] bg-[#F5F9FF] px-4 text-sm font-semibold text-[#1D4ED8]',
                        FOCUS,
                      )}
                    >
                      {startTime} – {f.end}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="proximos">
            <h2
              id="proximos"
              className="mb-2 font-[Manrope,sans-serif] text-lg font-bold text-[#0F2D5B]"
            >
              Próximos atendimentos
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-[#64748B]">Nenhum atendimento agendado a seguir.</p>
            ) : desktop ? (
              <table className="w-full overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white text-left text-sm">
                <thead className="bg-[#F8FAFC] text-xs text-[#64748B]">
                  <tr>
                    <th className="px-3 py-2">Quando</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Serviço</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((a) => {
                    const l = instantToLocal(a.starts_at, tz);
                    return (
                      <tr key={a.id} className="border-t border-[#E2E8F0]">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {dayLabel(l.date, today)} · {l.time}
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-2" title={a.client_name}>
                          {a.client_name}
                        </td>
                        <td className="max-w-[160px] truncate px-3 py-2" title={a.service_name}>
                          {a.service_name}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={a.status} compact />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              aria-label={`Ver detalhes de ${a.client_name}`}
                              onClick={() => openAppointment(a.id)}
                              className={cn(
                                'min-h-11 rounded-lg border border-[#E2E8F0] px-3 font-semibold text-[#0F2D5B]',
                                FOCUS,
                              )}
                            >
                              Ver
                            </button>
                            <Link
                              to={`/agenda/remarcar/${a.id}`}
                              aria-label={`Remarcar ${a.client_name}`}
                              className={cn(
                                'inline-flex min-h-11 items-center rounded-lg border border-[#E2E8F0] px-3 font-semibold text-[#0F2D5B]',
                                FOCUS,
                              )}
                            >
                              Remarcar
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <ul className="flex flex-col gap-2">
                {upcoming.map((a) => {
                  const l = instantToLocal(a.starts_at, tz);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => openAppointment(a.id)}
                        className={cn(
                          'flex min-h-[64px] w-full items-center gap-3 rounded-[18px] border border-[#E2E8F0] bg-white p-2.5 text-left',
                          FOCUS,
                        )}
                      >
                        <span className="flex h-12 w-[62px] shrink-0 flex-col items-center justify-center rounded-xl bg-[#E7F1FF] text-[#0F2D5B]">
                          <b className="font-[Manrope,sans-serif] text-[15px] font-extrabold">
                            {l.time}
                          </b>
                          <span className="text-[11px] text-[#475569]">
                            {dayLabel(l.date, today)}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <b
                            title={a.client_name}
                            className="block truncate text-[15px] font-semibold"
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
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {desktop && (
          <MiniCalendar
            today={today}
            weekStartsOn={weekStartsOn}
            counts={counts}
            openWeekdays={openWeekdays}
          />
        )}
      </div>
    </div>
  );
}
