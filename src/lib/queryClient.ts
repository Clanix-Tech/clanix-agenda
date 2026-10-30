import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toAppError } from '@/lib/errors';

/**
 * QueryClient global. Qualquer erro de consulta/mutação classificado como `sessao`
 * (42501/401) dispara `onSessionExpired` uma única vez por rajada de erros.
 */
export function createQueryClient(onSessionExpired: () => void): QueryClient {
  let handling = false;
  const onError = (err: unknown) => {
    if (toAppError(err).kind !== 'sessao' || handling) return;
    handling = true;
    try {
      onSessionExpired();
    } finally {
      setTimeout(() => {
        handling = false;
      }, 1000);
    }
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
