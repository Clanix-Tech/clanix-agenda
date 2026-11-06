import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  THEME_COLORS,
  applyTheme,
  initTheme,
  readThemePreference,
  resetThemeForTests,
  resolveTheme,
  setThemePreference,
  useTheme,
} from './theme';

let systemIsDark = false;
let listeners: Array<() => void> = [];

function systemDark(value: boolean) {
  systemIsDark = value;
  listeners.forEach((l) => l());
}

beforeEach(() => {
  systemIsDark = false;
  listeners = [];
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      get matches() {
        return query === '(prefers-color-scheme: dark)' && systemIsDark;
      },
      media: query,
      addEventListener: (_: string, l: () => void) => listeners.push(l),
      removeEventListener: (_: string, l: () => void) => {
        listeners = listeners.filter((x) => x !== l);
      },
    })),
  );
  localStorage.clear();
  document.head.innerHTML = '<meta name="theme-color" content="#F8F7FF" />';
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
  resetThemeForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('tema', () => {
  it('sem preferência salva vale automático e segue o sistema', () => {
    expect(readThemePreference()).toBe('auto');
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('claro', true)).toBe('light');
    expect(resolveTheme('escuro', false)).toBe('dark');
  });

  it('valor inválido ou storage que lança vira automático', () => {
    localStorage.setItem('clanix-tema', 'roxo');
    expect(readThemePreference()).toBe('auto');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(readThemePreference()).toBe('auto');
  });

  it('applyTheme liga a classe dark, color-scheme e theme-color', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')!.getAttribute('content')).toBe(
      THEME_COLORS.dark,
    );
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')!.getAttribute('content')).toBe(
      '#F8F7FF',
    );
  });

  it('em automático acompanha a troca do sistema; forçado ignora', () => {
    initTheme();
    systemDark(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    setThemePreference('claro');
    systemDark(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('clanix-tema')).toBe('claro');
    setThemePreference('auto');
    expect(localStorage.getItem('clanix-tema')).toBeNull();
  });

  it('initTheme é idempotente', () => {
    initTheme();
    initTheme();
    expect(listeners).toHaveLength(1);
  });

  it('setThemePreference não quebra com storage bloqueado', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cheio');
    });
    expect(() => setThemePreference('escuro')).not.toThrow();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('useTheme re-renderiza ao trocar a preferência', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe('auto');
    expect(result.current.resolved).toBe('light');
    act(() => result.current.setPreference('escuro'));
    expect(result.current.preference).toBe('escuro');
    expect(result.current.resolved).toBe('dark');
  });
});
