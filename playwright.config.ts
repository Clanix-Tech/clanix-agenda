import { defineConfig, devices } from '@playwright/test';
import { readLocalStatus, readLocalVapidPublicKey } from './tests/e2e/support/localStatus.ts';

const PORT = 5174;
const PWA_PORT = 5175;
const BASE_URL = `http://localhost:${PORT}`;
const PWA_URL = `http://localhost:${PWA_PORT}`;

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
  // O servidor de desenvolvimento do Vite serve módulos soltos: mais de 4 navegadores ao mesmo tempo
  // deixam a primeira carga de cada página lenta demais nesta máquina (falsos estouros de tempo).
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Folga para a primeira carga de cada página no servidor de desenvolvimento (módulos soltos):
  // nos traces, com 4 navegadores, uma navegação chegou a levar de 5 s a 60 s nesta máquina.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      testIgnore: /pwa.spec.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        // Navegador em outro fuso: a agenda continua no fuso do perfil (America/Sao_Paulo).
        timezoneId: 'Europe/Lisbon',
      },
    },
    {
      name: 'webkit-iphone',
      testIgnore: /pwa.spec.ts/,
      use: { ...devices['iPhone 15'], timezoneId: 'America/Sao_Paulo' },
    },
    {
      name: 'chromium-android',
      testIgnore: /pwa.spec.ts/,
      use: { ...devices['Pixel 7'], timezoneId: 'America/Sao_Paulo' },
    },
    {
      name: 'pwa',
      testMatch: /pwa.spec.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: PWA_URL,
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: [
    {
      command: `npx vite --mode test --port ${PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: serverEnv,
    },
    {
      // O service worker só existe no build: o projeto `pwa` usa o resultado do build servido pelo preview.
      command: `npx vite build --mode test && npx vite preview --port ${PWA_PORT} --strictPort`,
      url: PWA_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: serverEnv,
    },
  ],
});
