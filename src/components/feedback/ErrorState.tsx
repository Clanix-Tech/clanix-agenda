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
      <p className="text-foreground">{message}</p>
      {onRetry && <Button onClick={onRetry}>Tentar novamente</Button>}
    </div>
  );
}
