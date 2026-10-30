import { useSyncExternalStore } from 'react';

/** Assina uma media query; sem `matchMedia` (ambientes antigos/testes) devolve `false`. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => mql.removeEventListener('change', notify);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  );
}

export const DESKTOP_QUERY = '(min-width: 1024px)';
