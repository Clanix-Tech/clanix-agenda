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
        retry: (count, err) => toAppError(err).kind === 'rede' && count < 2,
      },
      mutations: { retry: false },
    },
  });
}
