export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-40 items-center justify-center gap-3 p-8 text-[#64748B]"
    >
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-[#E2E8F0] border-t-[#2563EB]"
      />
      <span>{label}</span>
    </div>
  );
}
