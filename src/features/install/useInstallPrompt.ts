import { useCallback, useSyncExternalStore } from 'react';
import {
  getInstallPromptSnapshot,
  startInstallPromptCapture,
  subscribeInstallPrompt,
  takeInstallPrompt,
} from './installPromptStore';

/**
 * Instalação pelo navegador. `canPrompt` só fica verdadeiro depois que o navegador soltou o
 * `beforeinstallprompt` (Chrome/Edge/Android); no Safari e no Firefox nunca fica. O evento vem da
 * loja global (capturado no início do app), então não se perde ao trocar de aba.
 */
export function useInstallPrompt(): {
  canPrompt: boolean;
  prompt(): Promise<'accepted' | 'dismissed'>;
} {
  startInstallPromptCapture();
  const event = useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPromptSnapshot,
    getInstallPromptSnapshot,
  );

  const prompt = useCallback(async () => {
    const taken = takeInstallPrompt();
    if (!taken) return 'dismissed' as const;
    await taken.prompt();
    return (await taken.userChoice).outcome;
  }, []);

  return { canPrompt: event !== null, prompt };
}
