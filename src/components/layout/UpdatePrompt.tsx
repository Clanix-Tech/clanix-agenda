import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';

const TOAST_ID = 'nova-versao';

/** Aviso persistente de nova versão do app (service worker em modo `prompt`). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;
    toast('Nova versão disponível', {
      id: TOAST_ID,
      duration: Infinity,
      action: { label: 'Atualizar', onClick: () => void updateServiceWorker(true) },
    });
    return () => {
      toast.dismiss(TOAST_ID);
    };
  }, [needRefresh, updateServiceWorker]);

  return null;
}
