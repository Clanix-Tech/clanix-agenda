/** Mostrado enquanto a parte (chunk) da página carrega. */
export function PageFallback() {
  return (
    <p role="status" className="p-6 text-sm text-[#64748B]">
      Carregando…
    </p>
  );
}
