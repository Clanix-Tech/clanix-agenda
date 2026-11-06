import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center">
      <p className="font-display text-lg font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
