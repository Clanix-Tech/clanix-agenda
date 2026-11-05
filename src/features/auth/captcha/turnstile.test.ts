import type { TurnstileApi } from './turnstile';

const SELECTOR = 'script[src*="challenges.cloudflare.com"]';
const api: TurnstileApi = { render: () => 'w', reset: () => {}, remove: () => {} };

async function fresh() {
  vi.resetModules();
  return import('./turnstile');
}
const scripts = () => document.head.querySelectorAll<HTMLScriptElement>(SELECTOR);

afterEach(() => {
  scripts().forEach((s) => s.remove());
  delete window.turnstile;
});

describe('loadTurnstile', () => {
  it('reaproveita window.turnstile sem inserir script', async () => {
    window.turnstile = api;
    const { loadTurnstile } = await fresh();
    await expect(loadTurnstile()).resolves.toBe(api);
    expect(scripts()).toHaveLength(0);
  });

  it('insere o script uma única vez e compartilha a promessa', async () => {
    const { loadTurnstile, TURNSTILE_SCRIPT_URL } = await fresh();
    const a = loadTurnstile();
    const b = loadTurnstile();
    expect(a).toBe(b);
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0]!.src).toBe(TURNSTILE_SCRIPT_URL);
    window.turnstile = api;
    scripts()[0]!.onload!(new Event('load'));
    await expect(a).resolves.toBe(api);
  });

  it('onerror rejeita, remove o script e a próxima chamada recarrega', async () => {
    const { loadTurnstile } = await fresh();
    const first = loadTurnstile();
    scripts()[0]!.onerror!(new Event('error'));
    await expect(first).rejects.toThrow();
    expect(scripts()).toHaveLength(0);

    const second = loadTurnstile();
    expect(second).not.toBe(first);
    expect(scripts()).toHaveLength(1);
    window.turnstile = api;
    scripts()[0]!.onload!(new Event('load'));
    await expect(second).resolves.toBe(api);
  });

  it('script carregado sem window.turnstile rejeita, remove o script e permite nova tentativa', async () => {
    const { loadTurnstile } = await fresh();
    const first = loadTurnstile();
    scripts()[0]!.onload!(new Event('load'));
    await expect(first).rejects.toThrow();
    expect(scripts()).toHaveLength(0);
    void loadTurnstile();
    expect(scripts()).toHaveLength(1);
  });
});
