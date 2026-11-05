import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getEnv } from '@/lib/env';
import { loadTurnstile, type TurnstileApi } from './turnstile';

export type CaptchaAction = 'login' | 'cadastro' | 'recuperar' | 'excluir-conta';

export const CAPTCHA_LOAD_ERROR =
  'Não foi possível carregar a verificação de segurança. Confira sua conexão e tente de novo.';
export const CAPTCHA_HINT = 'Conclua a verificação de segurança acima.';

export type Captcha = {
  required: boolean;
  token: string | null;
  error: string | null;
  /** Reinicia o widget. Chamar depois de toda tentativa de envio: o token só vale uma vez. */
  reset(): void;
  element: ReactNode;
};

export function useCaptcha(action: CaptchaAction): Captcha {
  const siteKey = getEnv().turnstileSiteKey;
  // Ref de callback guardada em estado: o widget é renderizado quando o contêiner aparece
  // (mesmo que apareça depois, como num diálogo que abre) e removido quando ele some.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!siteKey || !container) return;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled) return;
        const id = api.render(container, {
          sitekey: siteKey,
          action,
          language: 'pt-br',
          callback: (t) => {
            setError(null);
            setToken(t);
          },
          'expired-callback': () => setToken(null),
          'error-callback': () => {
            setToken(null);
            setError(CAPTCHA_LOAD_ERROR);
          },
        });
        widget.current = { api, id };
      })
      .catch(() => {
        if (!cancelled) setError(CAPTCHA_LOAD_ERROR);
      });
    return () => {
      cancelled = true;
      const w = widget.current;
      widget.current = null;
      if (w) w.api.remove(w.id);
      // Sem widget, o token antigo não vale mais.
      setToken(null);
    };
  }, [siteKey, action, attempt, container]);

  const reset = useCallback(() => {
    setToken(null);
    const w = widget.current;
    if (w) w.api.reset(w.id);
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setToken(null);
    setAttempt((n) => n + 1);
  }, []);

  if (!siteKey) {
    return { required: false, token: null, error: null, reset: () => {}, element: null };
  }

  const element = (
    <div>
      <div ref={setContainer} className="flex min-h-[65px] justify-center" />
      {error && (
        <div role="alert" className="mt-2 space-y-2 text-sm text-[#B91C1C]">
          <p>{error}</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-11 items-center font-semibold text-blue-700 underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Tentar de novo
          </button>
        </div>
      )}
    </div>
  );
  return { required: true, token, error, reset, element };
}
