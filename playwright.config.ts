import { defineConfig, devices } from '@playwright/test';
import { readLocalStatus, readLocalVapidPublicKey } from './tests/e2e/support/localStatus.ts';

const PORT = 5174;
const BASE_URL = `http://localhost:${PORT}`;

// O servidor web sobe antes do global-setup; por isso URL e chave publicável são lidas aqui
// (uma vez: os workers herdam as variáveis). A chave secreta só é lida no global-setup.
function publicEnv(): { url: string; publishableKey: string } {
  const { E2E_SUPABASE_URL: url, E2E_SUPABASE_PUBLISHABLE_KEY: publishableKey } = process.env;
  if (url && publishableKey) return { url, publishableKey };
  const status = readLocalStatus();
  process.env.E2E_SUPABASE_URL = status.url;
  process.env.E2E_SUPABASE_PUBLISHABLE_KEY = status.publishableKey;
  process.env.E2E_MAILPIT_URL = status.mailpitUrl;
  return { url: status.url, publishableKey: status.publishableKey };
}
const supabase = publicEnv();
// Chave pública VAPID (opcional): o servidor web sobe antes do global-setup gravar o .env.test.local.
const vapidPublicKey = readLocalVapidPublicKey();
const serverEnv = {
  VITE_SUPABASE_URL: supabase.url,
  VITE_SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
  ...(vapidPublicKey ? { VITE_VAPID_PUBLIC_KEY: vapidPublicKey } : {}),
};

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Sem novas tentativas: instabilidade precisa aparecer, não ser escondida.
  retries: 0,
  // Os navegadores dividem a máquina com o Supabase local (Docker). Com 8 ao mesmo tempo, a
  // primeira navegação de uma página nova chegou a levar 28 s nesta máquina (mesmo no build);
  // com 4, o tempo total é praticamente o mesmo e sem esses picos.
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  // O WebKit no Windows é lento: os cenários longos (agendamento completo, interruptores do
  // expediente) levam de 30 a 35 s no iPhone, e o padrão de 30 s do Playwright estoura.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Os aparelhos rodam com o service worker bloqueado: `page.route` só intercepta o que não passa
  // por ele. O projeto `pwa` testa justamente o service worker, no mesmo build.
  projects: [
    {
      name: 'chromium-desktop',
      testIgnore: /pwa.spec.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        // Navegador em outro fuso: a agenda continua no fuso do perfil (America/Sao_Paulo).
        timezoneId: 'Europe/Lisbon',
        serviceWorkers: 'block',
      },
    },
    {
      name: 'webkit-iphone',
      testIgnore: /pwa.spec.ts/,
      use: { ...devices['iPhone 15'], timezoneId: 'America/Sao_Paulo', serviceWorkers: 'block' },
    },
    {
      name: 'chromium-android',
      testIgnore: /pwa.spec.ts/,
      use: { ...devices['Pixel 7'], timezoneId: 'America/Sao_Paulo', serviceWorkers: 'block' },
    },
    {
      name: 'pwa',
      testMatch: /pwa.spec.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        serviceWorkers: 'allow',
      },
    },
  ],
  // Todos os testes rodam no build de produção (modo `test`), servido pelo `vite preview` com os
  // mesmos cabeçalhos do site publicado (dist/_headers): a CSP vale durante os testes.
  webServer: {
    command: `npx vite build --mode test && npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: serverEnv,
  },
});
