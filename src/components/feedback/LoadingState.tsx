export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-40 items-center justify-center gap-3 p-8 text-muted-foreground"
    >
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-border border-t-primary"
      />
      <span>{label}</span>
    </div>
  );
}
