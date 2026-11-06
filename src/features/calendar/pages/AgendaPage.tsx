import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import { useProfile } from '@/features/profile/api';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AgendaToolbar } from '../components/AgendaToolbar';
import { useAgendaParams } from '../useAgendaParams';
import { DayView } from '../views/DayView';
import { ListView } from '../views/ListView';
import { MonthView } from '../views/MonthView';
import { WeekView } from '../views/WeekView';
import { useVisibleWeekDays } from '../views/weekData';
import type { ComponentProps } from 'react';

/** Barra da semana no computador: o título acompanha as colunas realmente visíveis. */
function WeekToolbar(props: ComponentProps<typeof AgendaToolbar> & { tz: string }) {
  const { tz, ...rest } = props;
  const visibleDays = useVisibleWeekDays(props.date, tz);
  return <AgendaToolbar {...rest} visibleDays={visibleDays} />;
}

export default function AgendaPage() {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const profile = useProfile();
  const { view, date, status, set, tz, today } = useAgendaParams();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3.5 px-4 pt-5 pb-6 lg:px-8 lg:pt-8">
      <h1 className="px-1 font-display text-2xl font-bold text-foreground">Agenda</h1>
      {profile.isPending ? (
        <LoadingState label="Carregando a agenda…" />
      ) : profile.isError ? (
        <ErrorState
          message="Não foi possível carregar seu perfil."
          onRetry={() => void profile.refetch()}
        />
      ) : (
        <>
          {view === 'semana' && desktop ? (
            <WeekToolbar
              tz={tz}
              view={view}
              date={date}
              today={today}
              status={status}
              weekStartsOn={profile.data.week_starts_on === 0 ? 0 : 1}
              onView={(v) => set({ view: v })}
              onDate={(d) => set({ date: d })}
              onStatus={(s) => set({ status: s })}
            />
          ) : (
            <AgendaToolbar
              view={view}
              date={date}
              today={today}
              status={status}
              weekStartsOn={profile.data.week_starts_on === 0 ? 0 : 1}
              onView={(v) => set({ view: v })}
              onDate={(d) => set({ date: d })}
              onStatus={(s) => set({ status: s })}
            />
          )}
          {view === 'lista' ? (
            <ListView date={date} tz={tz} status={status} />
          ) : view === 'semana' ? (
            <WeekView date={date} tz={tz} status={status} onDate={(d) => set({ date: d })} />
          ) : view === 'mes' ? (
            <MonthView date={date} tz={tz} status={status} />
          ) : (
            <DayView date={date} tz={tz} status={status} />
          )}
        </>
      )}
    </div>
  );
}
