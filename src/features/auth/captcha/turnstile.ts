/** Opções do widget que o app usa (subconjunto da API do Cloudflare Turnstile). */
export type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  language?: string;
  theme?: 'light' | 'dark' | 'auto';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
};

export type TurnstileApi = {
  render(container: HTMLElement, options: TurnstileRenderOptions): string;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let pending: Promise<TurnstileApi> | null = null;

/** Carrega o script uma única vez. Se falhar, a promessa em cache é descartada para permitir nova tentativa. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window !== 'undefined' && window.turnstile) {
    return Promise.resolve(window.turnstile);
  }
  if (pending) return pending;
  const attempt = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else {
        script.remove();
        reject(new Error('turnstile indisponível'));
      }
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('falha ao carregar o script do turnstile'));
    };
    document.head.appendChild(script);
  });
  pending = attempt;
  attempt.catch(() => {
    if (pending === attempt) pending = null;
  });
  return attempt;
}
