import { useState } from 'react';
import { Link } from 'react-router';
import { Smartphone, X } from 'lucide-react';
import { isIOSSafari, isStandalone } from '@/features/notifications/push';

/** Flag de interface (não é dado de cliente): a pessoa já fechou o aviso. */
export const HIDE_INSTALL_BANNER_KEY = 'aeo:ocultar-banner-instalar';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(HIDE_INSTALL_BANNER_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberDismissed(): void {
  try {
    localStorage.setItem(HIDE_INSTALL_BANNER_KEY, '1');
  } catch {
    // Modo privado: fecha só nesta visita.
  }
}

/**
 * Aviso discreto no Safari do iPhone/iPad fora do app instalado (lá o lembrete só funciona
 * instalado). Fica no fluxo da página, no topo do conteúdo: nunca cobre a navegação inferior
 * nem os avisos (toasts). Só é montado em telas com login (AppShell).
 */
export function IosInstallBanner() {
  const [visible, setVisible] = useState(() => isIOSSafari() && !isStandalone() && !wasDismissed());
  if (!visible) return null;

  const close = () => {
    rememberDismissed();
    setVisible(false);
  };

  return (
    <aside
      aria-label="Instalar o app"
      className="flex items-center gap-2 border-b border-secondary-border bg-secondary py-1 pr-1 pl-4 text-sm text-secondary-foreground"
    >
      <Smartphone aria-hidden="true" className="size-5 shrink-0 text-secondary-foreground" />
      <p className="min-w-0 flex-1 leading-snug">
        <span className="font-semibold">Instale o app para receber lembretes</span>{' '}
        <Link
          to="/instalar"
          className="inline-flex min-h-11 items-center font-semibold text-secondary-foreground underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          Ver como
        </Link>
      </p>
      <button
        type="button"
        aria-label="Fechar aviso"
        onClick={close}
        className="grid size-11 shrink-0 place-items-center rounded-xl text-secondary-foreground outline-none hover:bg-card/60 focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </aside>
  );
}
