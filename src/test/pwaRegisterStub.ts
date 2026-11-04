/** Substituto do módulo virtual do vite-plugin-pwa nos testes (cada teste troca por vi.mock). */
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as const,
    offlineReady: [false, () => {}] as const,
    updateServiceWorker: async () => {},
  };
}
