import { useCallback, useEffect, useState } from 'react';

/** Evento do Chrome/Edge/Android (ainda fora do tipo padrão do DOM). */
type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * Instalação pelo navegador. `canPrompt` só fica verdadeiro depois que o navegador soltou o
 * `beforeinstallprompt` (Chrome/Edge/Android); no Safari e no Firefox nunca fica.
 */
export function useInstallPrompt(): {
  canPrompt: boolean;
  prompt(): Promise<'accepted' | 'dismissed'>;
} {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBefore = (e: Event) => {
      // Segura o aviso padrão do navegador: quem decide quando mostrar é o botão da tela.
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const prompt = useCallback(async () => {
    if (!event) return 'dismissed' as const;
    // O evento só pode ser usado uma vez; o navegador solta outro se ainda der para instalar.
    setEvent(null);
    await event.prompt();
    return (await event.userChoice).outcome;
  }, [event]);

  return { canPrompt: event !== null, prompt };
}
