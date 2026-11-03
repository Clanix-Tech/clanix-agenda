import { useEffect, useState } from 'react';

/** Instante atual, atualizado a cada 60 s (intervalo limpo ao desmontar). */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
