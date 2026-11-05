import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toAppError } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  readDeviceState,
  sendTestNotification,
  subscribeThisDevice,
  unsubscribeThisDevice,
  vapidPublicKey,
  type DeviceState,
} from './push';

export const pushDeviceKey = (userId: string | undefined) => ['push-device', userId] as const;

const CHECK_FAILED = 'Não foi possível verificar este aparelho.';
const TEST_NOT_DELIVERED =
  'A notificação de teste não chegou a nenhum aparelho. Desative e ative de novo neste aparelho.';

/**
 * Lembretes neste aparelho. `state` é sempre lido do navegador e do banco (nunca suposto):
 * `null` enquanto verifica. Uma ação por vez (trava síncrona contra duplo clique); depois de
 * cada ação o estado é lido de novo.
 */
export function usePushDevice() {
  const { user, expireSession } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = pushDeviceKey(user?.id);
  const configured = vapidPublicKey() !== null;

  // `staleTime: 0`: ao voltar para a aba (ex.: depois de liberar nas configurações) lê de novo.
  const query = useQuery({ queryKey, queryFn: readDeviceState, enabled: !!user, staleTime: 0 });

  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /** `start` é chamada na hora (dentro do clique): o pedido de permissão depende disso. */
  const run = (start: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError(null);
    let pending: Promise<void>;
    try {
      pending = start();
    } catch (err) {
      pending = Promise.reject(err);
    }
    void pending
      .catch((err: unknown) => {
        const appError = toAppError(err);
        if (appError.kind === 'sessao') void expireSession();
        setActionError(appError.message);
      })
      .then(() => queryClient.invalidateQueries({ queryKey }))
      .finally(() => {
        lock.current = false;
        setBusy(false);
      });
  };

  const state: DeviceState | null = query.data ?? null;
  const checkError = query.isError && !query.data ? CHECK_FAILED : null;

  return {
    state,
    busy,
    error: actionError ?? checkError,
    configured,
    activate: () => {
      if (!configured) return;
      run(subscribeThisDevice);
    },
    deactivate: () => run(unsubscribeThisDevice),
    sendTest: () =>
      run(async () => {
        const { sent } = await sendTestNotification();
        if (sent > 0) toast.success('Notificação de teste enviada.');
        else setActionError(TEST_NOT_DELIVERED);
      }),
    refresh: () => {
      void query.refetch();
    },
  };
}
