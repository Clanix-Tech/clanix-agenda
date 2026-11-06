import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/lib/useOnlineStatus';

/**
 * A região viva fica sempre montada (leitores de tela só anunciam mudanças em uma região que já
 * existe) e é `sticky`: quando aparece, empurra o conteúdo em vez de cobrir cabeçalho e barra.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  return (
    <div role="status" aria-live="polite" className="sticky top-0 z-50 bg-background">
      {!online && (
        <div className="flex items-center justify-center gap-2 border-b border-warning-border bg-warning-surface px-4 py-2 text-center text-sm font-medium text-warning-foreground">
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          Sem conexão. Você pode ver a agenda, mas nada será salvo até a internet voltar.
        </div>
      )}
    </div>
  );
}
