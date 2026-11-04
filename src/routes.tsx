/* eslint-disable react-refresh/only-export-components -- tabela de rotas, não é módulo de componente */
import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { RootLayout } from '@/components/layout/RootLayout';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { AppointmentForm } from '@/features/appointments/components/AppointmentForm';
import type { NewAppointmentProviderProps } from '@/features/appointments/components/NewAppointmentProvider';

// Uma parte (chunk) por página: o primeiro acesso não baixa as telas que a pessoa não abriu.
// O <Suspense> fica no RootLayout, acima de todas as rotas.
const Login = lazy(() => import('@/features/auth/pages/Login'));
const Signup = lazy(() => import('@/features/auth/pages/Signup'));
const ForgotPassword = lazy(() => import('@/features/auth/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/features/auth/pages/ResetPassword'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const AgendaPage = lazy(() => import('@/features/calendar/pages/AgendaPage'));
const ReschedulePage = lazy(() => import('@/features/appointments/pages/ReschedulePage'));
const HistoryPage = lazy(() => import('@/features/history/HistoryPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const FirstAccessPage = lazy(() => import('@/features/business-hours/pages/FirstAccessPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

/** "+" e horários livres abrem o formulário real de novo agendamento (Task 8). */
const renderNewAppointment: NewAppointmentProviderProps['renderForm'] = ({ prefill, close }) => (
  <AppointmentForm mode="create" prefill={prefill} onDone={close} />
);

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: '/entrar', element: <Login /> },
      { path: '/cadastro', element: <Signup /> },
      { path: '/recuperar-senha', element: <ForgotPassword /> },
      { path: '/redefinir-senha', element: <ResetPassword /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/primeiro-acesso', element: <FirstAccessPage /> },
          {
            element: <AppShell renderForm={renderNewAppointment} />,
            children: [
              { path: '/', element: <DashboardPage /> },
              { path: '/agenda', element: <AgendaPage /> },
              { path: '/agenda/remarcar/:id', element: <ReschedulePage /> },
              { path: '/historico', element: <HistoryPage /> },
              { path: '/ajustes/:secao?', element: <SettingsPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
