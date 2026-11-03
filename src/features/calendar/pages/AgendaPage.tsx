import { useProfile } from '@/features/profile/api';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AgendaToolbar } from '../components/AgendaToolbar';
import { useAgendaParams } from '../useAgendaParams';
import { DayView } from '../views/DayView';
import { ListView } from '../views/ListView';

export default function AgendaPage() {
  const profile = useProfile();
  const { view, date, status, set, tz, today } = useAgendaParams();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3.5 px-4 pt-5 pb-6 lg:px-8 lg:pt-8">
      <h1 className="px-1 font-[Manrope,sans-serif] text-2xl font-extrabold text-[#0F2D5B]">
        Agenda
      </h1>
      {profile.isPending ? (
        <LoadingState label="Carregando a agenda…" />
      ) : profile.isError ? (
        <ErrorState
          message="Não foi possível carregar seu perfil."
          onRetry={() => void profile.refetch()}
        />
      ) : (
        <>
          <AgendaToolbar
            view={view}
            date={date}
            today={today}
            status={status}
            onView={(v) => set({ view: v })}
            onDate={(d) => set({ date: d })}
            onStatus={(s) => set({ status: s })}
          />
          {/* Semana e mês entram na Task 12; até lá mostram o dia selecionado. */}
          {view === 'lista' ? (
            <ListView date={date} tz={tz} status={status} />
          ) : (
            <DayView date={date} tz={tz} status={status} />
          )}
        </>
      )}
    </div>
  );
}
