import { useSyncExternalStore } from 'react';

export type ThemePreference = 'auto' | 'claro' | 'escuro';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'clanix-tema';
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#F8F7FF',
  dark: '#0B0420',
};

const DARK_QUERY = '(prefers-color-scheme: dark)';

// Par de `public/tema.js`: a mesma regra roda lá antes da primeira pintura. Mantenha os dois iguais.
export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'claro' || value === 'escuro' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

export function resolveTheme(p: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (p === 'claro') return 'light';
  if (p === 'escuro') return 'dark';
  return systemDark ? 'dark' : 'light';
}

export function applyTheme(resolved: ResolvedTheme, doc: Document = document): void {
  const root = doc.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved]);
}

function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches;
}

const subscribers = new Set<() => void>();
let started = false;
let stopListening: (() => void) | null = null;
let snapshot: { preference: ThemePreference; resolved: ResolvedTheme } | null = null;

function refresh(): void {
  const preference = readThemePreference();
  const resolved = resolveTheme(preference, systemPrefersDark());
  if (!snapshot || snapshot.preference !== preference || snapshot.resolved !== resolved) {
    snapshot = { preference, resolved };
  }
  applyTheme(resolved);
  subscribers.forEach((notify) => notify());
}

export function initTheme(): void {
  if (started) return;
  started = true;
  refresh();
  if (typeof matchMedia !== 'function') return;
  const media = matchMedia(DARK_QUERY);
  const onChange = () => {
    if (readThemePreference() === 'auto') refresh();
  };
  media.addEventListener('change', onChange);
  stopListening = () => media.removeEventListener('change', onChange);
}

export function setThemePreference(p: ThemePreference): void {
  try {
    if (p === 'auto') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, p);
  } catch {
    // Sem armazenamento a escolha vale só nesta sessão.
  }
  // Se o storage falhou, `refresh` leria de volta o valor antigo: usa a escolha direto.
  const resolved = resolveTheme(p, systemPrefersDark());
  snapshot = { preference: p, resolved };
  applyTheme(resolved);
  subscribers.forEach((notify) => notify());
}

function getSnapshot() {
  if (!snapshot) {
    const preference = readThemePreference();
    snapshot = { preference, resolved: resolveTheme(preference, systemPrefersDark()) };
  }
  return snapshot;
}

function subscribe(notify: () => void) {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

export function useTheme() {
  const { preference, resolved } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { preference, resolved, setPreference: setThemePreference };
}

/** Só para testes: volta o módulo ao estado inicial. */
export function resetThemeForTests(): void {
  stopListening?.();
  stopListening = null;
  started = false;
  snapshot = null;
  subscribers.clear();
}
