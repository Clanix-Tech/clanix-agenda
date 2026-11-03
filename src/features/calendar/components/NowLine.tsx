export function NowLine({ time }: { time: string }) {
  return (
    <div
      role="separator"
      aria-label={`Agora, ${time}`}
      className="flex items-center gap-2 px-1.5 text-xs font-bold text-[#2563EB]"
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-[#2563EB]" />
      <span>Agora · {time}</span>
      <span aria-hidden="true" className="h-0.5 flex-1 rounded bg-[#3B82F6]" />
    </div>
  );
}
