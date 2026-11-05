import { Button } from '@/components/ui/button';

/** Erro de rota (ex.: parte da página que não carregou depois de uma nova versão). */
export function RouteError() {
  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <p className="text-[#0F172A]">Não foi possível carregar esta tela.</p>
      <Button
        onClick={() => window.location.reload()}
        className="h-11 bg-[#2563EB] px-5 text-white hover:bg-[#1D4ED8]"
      >
        Recarregar
      </Button>
    </div>
  );
}
