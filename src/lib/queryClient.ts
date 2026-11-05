import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toAppError } from '@/lib/errors';

/** Ponte entre o QueryClient (criado fora do React) e o AuthProvider (que registra o handler). */
export type ExpireRef = { current: () => void };

/**
 * QueryClient global. Qualquer erro de consulta/mutação classificado como `sessao`
 * (42501/401) chama `expireRef.current()` (idempotente no AuthProvider).
 */
export function createQueryClient(expireRef: ExpireRef): QueryClient {
  const onError = (err: unknown) => {
    if (toAppError(err).kind === 'sessao') expireRef.current();
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // `always`: offline a consulta falha como `rede` (ErrorState + aviso de conexão) em vez de
        // ficar pausada em "Carregando…" para sempre.
        networkMode: 'always',
        retry: (count, err) => toAppError(err).kind === 'rede' && count < 2,
      },
      // `always`: sem internet a gravação falha na hora (erro de rede → "Nada foi salvo" e
      // "Tentar novamente"), em vez de ficar pausada e gravar sozinha quando a conexão volta.
      mutations: { retry: false, networkMode: 'always' },
    },
  });
}
