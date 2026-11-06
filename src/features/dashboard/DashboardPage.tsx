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
import { useAppointmentsRange } from '@/features/appointments/api';
import { ceilNowToStep, freeIntervals } from '@/features/appointments/domain/freeSlots';
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
import { dayLabel, greetingAt, whenLabel } from './domain/labels';

const NOW_PLUS_DAYS = 14;
const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
// Sobre o card em gradiente o anel precisa do tom claro, que contrasta com o roxo.
const FOCUS_ON_BRAND =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground';

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-[18px] border border-border bg-card p-3.5">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="font-display text-[28px] leading-tight font-extrabold text-foreground">
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
      className="rounded-[18px] border border-border bg-card p-4"
    >
      <div
        aria-hidden="true"
        className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold text-muted-foreground"
      >
        {weeks[0]!.map((d) => (
          <span key={d}>{weekdayDay(d).split(' ')[0]}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 justify-items-center gap-1">
        {weeks.flat().map((d) => {
          const n = counts.get(d) ?? 0;
          const muted = !openWeekdays.has(weekdayOf(d));
          return (
            <Link
              key={d}
              to={`/agenda?visao=dia&data=${d}`}
              aria-label={`${Number(d.slice(8, 10))}/${d.slice(5, 7)}${n > 0 ? ', com atendimentos' : ''}`}
              aria-current={d === today ? 'date' : undefined}
              className={cn(
                'flex size-11 flex-col items-center justify-center rounded-lg text-sm font-semibold',
                FOCUS,
                d === today
                  ? 'bg-primary text-primary-foreground'
                  : muted || d.slice(0, 7) !== month
                    ? 'text-muted-foreground'
                    : 'text-foreground',
              )}
            >
              <span aria-hidden="true">{Number(d.slice(8, 10))}</span>
              <span
                aria-hidden="true"
                className={cn(
                  'size-1 rounded-full',
                  n > 0 ? (d === today ? 'bg-primary-foreground' : 'bg-primary') : 'bg-transparent',
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
  const floor = ceilNowToStep(now, tz);
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
        'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground',
        FOCUS,
      )}
    >
      <Plus aria-hidden="true" className="size-4" />
      Novo agendamento
    </button>
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 pt-5 pb-6 lg:max-w-[1280px] lg:px-8 lg:pt-8">
      <header>
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          {greetingAt(now, tz)}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatLongDate(now.toISOString(), tz)} · {nowLocal.date.slice(8, 10)}/
          {nowLocal.date.slice(5, 7)}/{nowLocal.date.slice(0, 4)}
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-[18px] border border-border bg-card">
          <EmptyState
            title="Sua agenda está livre. Que tal marcar o primeiro atendimento?"
            action={newBtn}
          />
        </div>
      ) : next ? (
        <section
          aria-label="Próximo atendimento"
          className="rounded-[22px] bg-gradient-destaque p-5 text-primary-foreground"
        >
          <p className="text-xs font-semibold tracking-wide text-primary-foreground uppercase">
            Próximo atendimento
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold">
            {whenLabel(next.starts_at, tz, now)}
          </p>
          <p title={next.client_name} className="mt-2 truncate text-lg font-semibold">
            {next.client_name}
          </p>
          <p title={next.service_name} className="truncate text-sm text-primary-foreground">
            {next.service_name}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => openAppointment(next.id)}
              className={cn(
                'min-h-11 rounded-xl bg-primary-foreground px-5 text-sm font-semibold text-primary-active',
                FOCUS_ON_BRAND,
              )}
            >
              Ver detalhes
            </button>
            <Link
              to={`/agenda/remarcar/${next.id}`}
              className={cn(
                'inline-flex min-h-11 items-center rounded-xl border border-primary-foreground/60 px-5 text-sm font-semibold text-primary-foreground',
                FOCUS_ON_BRAND,
              )}
            >
              Remarcar
            </Link>
          </div>
        </section>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-[18px] border border-border bg-card p-6 text-center">
          <p className="text-foreground-secondary">Nenhum atendimento agendado nos próximos 14 dias.</p>
          {newBtn}
        </div>
      )}

      {/* Computador: o calendário vai para baixo quando falta largura (nunca cobre a tabela). */}
      <div className={desktop ? 'flex flex-wrap items-start gap-6' : 'grid gap-5'}>
        <div className={cn('flex min-w-0 flex-col gap-5', desktop && 'flex-[999_1_600px]')}>
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
            <h2 id="livres-hoje" className="mb-2 font-display text-lg font-bold text-foreground">
              Horários livres hoje
            </h2>
            {free.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem horários livres hoje.</p>
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
                        'min-h-11 rounded-xl border-[1.5px] border-dashed border-secondary-border bg-secondary px-4 text-sm font-semibold text-link',
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
            <h2 id="proximos" className="mb-2 font-display text-lg font-bold text-foreground">
              Próximos atendimentos
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum atendimento agendado nos próximos 14 dias.
              </p>
            ) : desktop ? (
              <div className="overflow-x-auto rounded-[18px] border border-border bg-card">
                <table className="w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[130px]" />
                    <col />
                    <col className="w-[22%]" />
                    <col className="w-[130px]" />
                    <col className="w-[170px]" />
                  </colgroup>
                  <thead className="bg-muted text-xs text-muted-foreground">
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
                        <tr key={a.id} className="border-t border-border">
                          <td className="px-3 py-2 whitespace-nowrap">
                            {dayLabel(l.date, today)} · {l.time}
                          </td>
                          <td className="truncate px-3 py-2" title={a.client_name}>
                            {a.client_name}
                          </td>
                          <td className="truncate px-3 py-2" title={a.service_name}>
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
                                  'min-h-11 rounded-lg border border-border px-3 font-semibold text-foreground',
                                  FOCUS,
                                )}
                              >
                                Ver
                              </button>
                              <Link
                                to={`/agenda/remarcar/${a.id}`}
                                aria-label={`Remarcar ${a.client_name}`}
                                className={cn(
                                  'inline-flex min-h-11 items-center rounded-lg border border-border px-3 font-semibold text-foreground',
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
              </div>
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
                          'flex min-h-[64px] w-full items-center gap-3 rounded-[18px] border border-border bg-card p-2.5 text-left',
                          FOCUS,
                        )}
                      >
                        <span className="flex h-12 w-[62px] shrink-0 flex-col items-center justify-center rounded-xl bg-secondary text-foreground">
                          <b className="font-display text-[15px] font-extrabold">{l.time}</b>
                          <span className="text-[11px] text-foreground-secondary">
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
                            className="block truncate text-[13px] text-muted-foreground"
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
          <div className="max-w-[360px] min-w-0 flex-[1_1_300px]">
            <MiniCalendar
              today={today}
              weekStartsOn={weekStartsOn}
              counts={counts}
              openWeekdays={openWeekdays}
            />
          </div>
        )}
      </div>
    </div>
  );
}
