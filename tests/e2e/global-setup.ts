import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { FullConfig } from '@playwright/test';
import { configurarLembretesLocal } from '../../scripts/configurar-lembretes-local.mjs';
import {
  hasLocalFunctionsEnv,
  readLocalStatus,
  readLocalVapidPublicKey,
} from './support/localStatus.ts';

/**
 * Lê o Supabase local (`npx supabase status -o json`), grava `.env.test.local` só com as
 * variáveis públicas do frontend (inclusive a chave pública VAPID, quando
 * `supabase/functions/.env` existe) e deixa a chave secreta apenas na memória do processo de teste
 * (os workers herdam `process.env`). Chave secreta e chave privada VAPID nunca vão para o
 * `.env.test.local` nem para o navegador.
 *
 * Com `supabase/functions/.env`, também grava no Vault local a URL da send-reminders e o
 * CRON_SECRET (mesma lógica de `npm run lembretes:local`): o `db:test` apaga o Vault, e o teste do
 * cron de lembretes precisa dele.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  await assertServesProductionBuild(config.projects[0]?.use.baseURL);
  const status = readLocalStatus();
  const vapidPublicKey = readLocalVapidPublicKey();
  const envFile = fileURLToPath(new URL('../../.env.test.local', import.meta.url));
  const lines = [
    `VITE_SUPABASE_URL=${status.url}`,
    `VITE_SUPABASE_PUBLISHABLE_KEY=${status.publishableKey}`,
    ...(vapidPublicKey ? [`VITE_VAPID_PUBLIC_KEY=${vapidPublicKey}`] : []),
  ];
  writeFileSync(envFile, `${lines.join('\n')}\n`, 'utf8');
  if (hasLocalFunctionsEnv()) {
    await configurarLembretesLocal({ apiUrl: status.url, secretKey: status.secretKey });
  }
  process.env.E2E_SUPABASE_URL = status.url;
  process.env.E2E_SUPABASE_PUBLISHABLE_KEY = status.publishableKey;
  process.env.E2E_MAILPIT_URL = status.mailpitUrl;
  process.env.E2E_SUPABASE_SECRET_KEY = status.secretKey;
}

/**
 * Fora do CI, um servidor já aberto na porta é reaproveitado: se for o de desenvolvimento
 * (`vite`), os testes rodariam sem o build e sem a CSP. Melhor parar logo, dizendo o motivo.
 */
async function assertServesProductionBuild(baseURL: string | undefined): Promise<void> {
  if (!baseURL) throw new Error('playwright.config.ts sem baseURL.');
  const res = await fetch(baseURL);
  if (!res.headers.get('content-security-policy')) {
    throw new Error(
      `${baseURL} respondeu sem Content-Security-Policy: não é o build servido pelo \`vite preview\`. ` +
        'Pare o processo nessa porta (provavelmente um `vite` de desenvolvimento) e rode de novo.',
    );
  }
}
