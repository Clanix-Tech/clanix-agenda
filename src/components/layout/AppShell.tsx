import { Outlet } from 'react-router';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import {
  NewAppointmentProvider,
  type NewAppointmentProviderProps,
} from '@/features/appointments/components/NewAppointmentProvider';
import { AppointmentSheet } from '@/features/appointments/components/AppointmentSheet';
import { SideRail } from './SideRail';
import { BottomNav } from './BottomNav';

/** Rotas protegidas com navegação: barra lateral (≥1024 px) ou navegação inferior. */
export function AppShell({ renderForm }: Pick<NewAppointmentProviderProps, 'renderForm'> = {}) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  return (
    <NewAppointmentProvider renderForm={renderForm}>
      <div className="flex min-h-screen bg-[#F8FAFC] text-[#0F172A]">
        {desktop && <SideRail />}
        <main
          className={`min-w-0 flex-1 ${desktop ? '' : 'pb-[calc(100px+env(safe-area-inset-bottom))]'}`}
        >
          <Outlet />
        </main>
        {!desktop && <BottomNav />}
      </div>
      <AppointmentSheet />
    </NewAppointmentProvider>
  );
}
