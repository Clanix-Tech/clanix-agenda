import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useBusinessHours } from '@/features/business-hours/api';

export const FIRST_ACCESS_PATH = '/primeiro-acesso';

/** Protege rotas e leva quem ainda não tem expediente ao primeiro acesso. */
export function RequireAuth() {
  const { session, loading, signOutReason } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState label="Carregando…" />;
  if (!session)
    return (
      <Navigate
        to={signOutReason === 'conta_excluida' ? '/entrar?conta=excluida' : '/entrar'}
        replace
        state={{
          // R20: depois de "Sair" o próximo login começa no Início; link direto e sessão
          // expirada continuam voltando para onde a pessoa estava.
          from: signOutReason === 'sessao' || signOutReason === null ? location : undefined,
          reason: signOutReason === 'sessao' ? 'sessao' : undefined,
        }}
      />
    );
  return <BusinessHoursGate />;
}

function BusinessHoursGate() {
  const location = useLocation();
  const { data, isPending, refetch } = useBusinessHours();
  const onFirstAccess = location.pathname === FIRST_ACCESS_PATH;

  if (isPending) return <LoadingState label="Carregando…" />;
  // Erro sem dado: não dá para saber se há expediente — nunca redireciona às cegas.
  if (!data) return <ErrorState onRetry={() => void refetch()} />;
  if (data.length === 0 && !onFirstAccess) return <Navigate to={FIRST_ACCESS_PATH} replace />;
  if (data.length > 0 && onFirstAccess) return <Navigate to="/" replace />;
  return <Outlet />;
}
