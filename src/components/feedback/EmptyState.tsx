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
      <p className="font-display text-lg font-bold text-[#0F2D5B]">{title}</p>
      {description && <p className="max-w-sm text-[#64748B]">{description}</p>}
      {action}
    </div>
  );
}
