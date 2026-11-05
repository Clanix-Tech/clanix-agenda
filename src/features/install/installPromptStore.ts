/** Evento do Chrome/Edge/Android (ainda fora do tipo padrão do DOM). */
export type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

// O navegador solta `beforeinstallprompt` uma única vez por carregamento da página. Por isso o
// evento é capturado aqui, no início do app (main.tsx), e não dentro de uma tela que pode ainda
// não ter montado ou ser desmontada ao trocar de aba.
let current: BeforeInstallPromptEvent | null = null;
let started = false;
const listeners = new Set<() => void>();

function set(next: BeforeInstallPromptEvent | null) {
  if (current === next) return;
  current = next;
  listeners.forEach((l) => l());
}

/** Começa a escutar o navegador. Pode ser chamada várias vezes; só a primeira vale. */
export function startInstallPromptCapture(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    // Segura o aviso padrão: quem decide quando mostrar é o botão da tela.
    e.preventDefault();
    set(e as BeforeInstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => set(null));
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getInstallPromptSnapshot = (): BeforeInstallPromptEvent | null => current;

/** O evento só pode ser usado uma vez: tira da loja e devolve. */
export function takeInstallPrompt(): BeforeInstallPromptEvent | null {
  const event = current;
  set(null);
  return event;
}
