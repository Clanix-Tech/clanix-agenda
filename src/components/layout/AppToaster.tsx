import { Toaster } from '@/components/ui/sonner';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';

/** Altura da navegação inferior (84 px) + folga; a área segura do iPhone soma por cima. */
export const MOBILE_TOAST_BOTTOM = 'calc(100px + env(safe-area-inset-bottom))';

/**
 * Avisos (sonner). Abaixo de 1024 px ficam acima da navegação inferior: em cima dela, o aviso
 * cobria Início/Agenda/Histórico/Ajustes e, com o dedo/ponteiro sobre ele, o sonner pausa o
 * tempo de fechar — a navegação ficava presa.
 */
export function AppToaster() {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const lifted = desktop ? undefined : { bottom: MOBILE_TOAST_BOTTOM };
  return <Toaster offset={lifted} mobileOffset={lifted} />;
}
