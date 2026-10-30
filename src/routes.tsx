import type { RouteObject } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { RootLayout } from '@/components/layout/RootLayout';
import { RequireAuth } from '@/features/auth/RequireAuth';
import Login from '@/features/auth/pages/Login';
import Signup from '@/features/auth/pages/Signup';
import ForgotPassword from '@/features/auth/pages/ForgotPassword';
import ResetPassword from '@/features/auth/pages/ResetPassword';
import DashboardPage from '@/features/dashboard/DashboardPage';
import AgendaPage from '@/features/calendar/pages/AgendaPage';
import ReschedulePage from '@/features/appointments/pages/ReschedulePage';
import { AppointmentForm } from '@/features/appointments/components/AppointmentForm';
import type { NewAppointmentProviderProps } from '@/features/appointments/components/NewAppointmentProvider';
import HistoryPage from '@/features/history/HistoryPage';
import SettingsPage from '@/features/settings/SettingsPage';
import FirstAccessPage from '@/features/business-hours/pages/FirstAccessPage';
import NotFoundPage from '@/pages/NotFoundPage';

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
