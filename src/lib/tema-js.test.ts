import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import src from '../../public/tema.js?raw';
import { THEME_COLORS, THEME_STORAGE_KEY, resolveTheme, type ThemePreference } from './theme';

type Stored = ThemePreference | 'invalida' | 'ausente' | 'lanca';
const preferencias: Stored[] = ['auto', 'claro', 'escuro', 'ausente', 'invalida', 'lanca'];

beforeEach(() => {
  document.head.innerHTML = '<meta name="theme-color" content="#F8F7FF" />';
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('public/tema.js', () => {
  it('usa a mesma chave de armazenamento do módulo', () => {
    expect(src).toContain(`'${THEME_STORAGE_KEY}'`);
  });

  for (const stored of preferencias) {
    for (const systemDark of [false, true]) {
      it(`preferência ${stored} com sistema ${systemDark ? 'escuro' : 'claro'}`, () => {
        vi.stubGlobal(
          'matchMedia',
          vi.fn(() => ({ matches: systemDark })),
        );
        let pref: ThemePreference = 'auto';
        if (stored === 'lanca') {
          vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('bloqueado');
          });
        } else if (stored === 'invalida') {
          localStorage.setItem(THEME_STORAGE_KEY, 'roxo');
        } else if (stored !== 'ausente') {
          localStorage.setItem(THEME_STORAGE_KEY, stored);
          pref = stored;
        }

        new Function(src)();

        const resolved = resolveTheme(pref, systemDark);
        expect(document.documentElement.classList.contains('dark')).toBe(resolved === 'dark');
        expect(document.documentElement.style.colorScheme).toBe(resolved);
        expect(document.querySelector('meta[name="theme-color"]')!.getAttribute('content')).toBe(
          THEME_COLORS[resolved],
        );
      });
    }
  }
});
