import { Button } from '@/components/ui/button';

export function ErrorState({
  message = 'Algo deu errado. Tente novamente.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 p-8 text-center">
      <p className="text-[#0F172A]">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} className="h-11 bg-[#2563EB] px-5 text-white hover:bg-[#1D4ED8]">
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
