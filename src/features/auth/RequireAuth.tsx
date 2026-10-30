import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { LoadingState } from '@/components/feedback/LoadingState';

export const FIRST_ACCESS_PATH = '/primeiro-acesso';

/**
 * Protege rotas. `hasBusinessHours` vem do hook da Task 7; `undefined` (ainda carregando
 * ou não ligado) é tratado como `true`.
 */
export function RequireAuth({ hasBusinessHours }: { hasBusinessHours?: boolean }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState label="Carregando…" />;
  if (!session) return <Navigate to="/entrar" replace state={{ from: location }} />;
  if (hasBusinessHours === false && location.pathname !== FIRST_ACCESS_PATH) {
    return <Navigate to={FIRST_ACCESS_PATH} replace />;
  }
  return <Outlet />;
}
