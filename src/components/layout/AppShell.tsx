import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import {
  NewAppointmentProvider,
  type NewAppointmentProviderProps,
} from '@/features/appointments/components/NewAppointmentProvider';
import { AppointmentSheet } from '@/features/appointments/components/AppointmentSheet';
import { IosInstallBanner } from '@/features/install/IosInstallBanner';
import { SideRail } from './SideRail';
import { BottomNav } from './BottomNav';
import { PageFallback } from './PageFallback';

/** Rotas protegidas com navegação: barra lateral (≥1024 px) ou navegação inferior. */
export function AppShell({ renderForm }: Pick<NewAppointmentProviderProps, 'renderForm'> = {}) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  return (
    <NewAppointmentProvider renderForm={renderForm}>
      <a
        href="#conteudo"
        onClick={(e) => {
          // Foco explícito: não depende do navegador mover o foco para o alvo do #.
          e.preventDefault();
          document.getElementById('conteudo')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-primary-foreground focus:outline-2 focus:outline-offset-2 focus:outline-ring"
      >
        Pular para o conteúdo
      </a>
      <div className="flex min-h-screen bg-background text-foreground">
        {desktop && <SideRail />}
        <main
          id="conteudo"
          tabIndex={-1}
          className={`outline-none min-w-0 flex-1 ${desktop ? '' : 'pb-[calc(100px+env(safe-area-inset-bottom))]'}`}
        >
          <IosInstallBanner />
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
        {!desktop && <BottomNav />}
      </div>
      <AppointmentSheet />
    </NewAppointmentProvider>
  );
}
