import { type ReactElement, type ReactNode } from 'react';
import { render, renderHook } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router';
import { vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { createQueryClient, type ExpireRef } from '@/lib/queryClient';
import { createFakeSupabase, makeSession, type FakeSupabase } from '@/test/fakeSupabase';

// Qualquer módulo importado a partir daqui que use `@/lib/supabase` recebe o fake atual.
const holder = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('@/lib/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, prop) => Reflect.get(holder.current as object, prop) }),
}));

const mediaListeners = new Set<() => void>();

/**
 * Simula `window.matchMedia` para uma largura de janela (suporta `(min-width: Npx)`).
 * Avisa os assinantes atuais, então mudar a largura com a tela montada simula um
 * redimensionamento (envolva em `act`).
 */
export function setViewportWidth(width: number) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      matches: min ? width >= Number(min[1]) : false,
      media: query,
      addEventListener: (_type: string, l: () => void) => mediaListeners.add(l),
      removeEventListener: (_type: string, l: () => void) => mediaListeners.delete(l),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  mediaListeners.forEach((l) => l());
}

export type RenderOptions = {
  route?: string;
  /** `true` = sessão padrão de teste; `false`/ausente = sem sessão. */
  session?: Session | boolean | null;
  supabase?: FakeSupabase;
  /** Tabela de rotas; padrão: `ui` em `*`. */
  routes?: RouteObject[];
};

export function renderWithProviders(ui: ReactElement | null, options: RenderOptions = {}) {
  const session =
    options.session === true ? makeSession() : options.session ? options.session : null;
  const fake = options.supabase ?? createFakeSupabase({ session });
  holder.current = fake;

  const routes = options.routes ?? [{ path: '*', element: ui }];
  const router = createMemoryRouter(routes, { initialEntries: [options.route ?? '/'] });
  const expireRef: ExpireRef = { current: () => {} };
  const queryClient = createQueryClient(expireRef);

  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider expireRef={expireRef}>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...result, router, queryClient, supabase: fake };
}

/** `renderHook` com QueryClient, AuthProvider e o fake de Supabase (sem roteador). */
export function renderHookWithProviders<T>(
  hook: () => T,
  options: { session?: Session | boolean | null; supabase?: FakeSupabase } = {},
) {
  const session =
    options.session === true ? makeSession() : options.session ? options.session : null;
  const fake = options.supabase ?? createFakeSupabase({ session });
  holder.current = fake;
  const expireRef: ExpireRef = { current: () => {} };
  const queryClient = createQueryClient(expireRef);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider expireRef={expireRef}>{children}</AuthProvider>
    </QueryClientProvider>
  );
  const result = renderHook(hook, { wrapper });
  return { ...result, queryClient, supabase: fake };
}
