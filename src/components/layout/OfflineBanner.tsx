import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/lib/useOnlineStatus';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-[#FEF3C7] px-4 py-2 text-center text-sm font-medium text-[#92400E]"
    >
      <WifiOff aria-hidden="true" className="size-4 shrink-0" />
      Sem conexão. Você pode ver a agenda, mas nada será salvo até a internet voltar.
    </div>
  );
}
