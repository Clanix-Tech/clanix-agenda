import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readLocalStatus, readLocalVapidPublicKey } from './support/localStatus.ts';

/**
 * Lê o Supabase local (`npx supabase status -o json`), grava `.env.test.local` só com as
 * variáveis públicas do frontend (inclusive a chave pública VAPID, quando
 * `supabase/functions/.env` existe) e deixa a chave secreta apenas na memória do processo de teste
 * (os workers herdam `process.env`). Chave secreta e chave privada VAPID nunca vão para o
 * `.env.test.local` nem para o navegador.
 */
export default function globalSetup(): void {
  const status = readLocalStatus();
  const vapidPublicKey = readLocalVapidPublicKey();
  const envFile = fileURLToPath(new URL('../../.env.test.local', import.meta.url));
  const lines = [
    `VITE_SUPABASE_URL=${status.url}`,
    `VITE_SUPABASE_PUBLISHABLE_KEY=${status.publishableKey}`,
    ...(vapidPublicKey ? [`VITE_VAPID_PUBLIC_KEY=${vapidPublicKey}`] : []),
  ];
  writeFileSync(envFile, `${lines.join('\n')}\n`, 'utf8');
  process.env.E2E_SUPABASE_URL = status.url;
  process.env.E2E_SUPABASE_PUBLISHABLE_KEY = status.publishableKey;
  process.env.E2E_MAILPIT_URL = status.mailpitUrl;
  process.env.E2E_SUPABASE_SECRET_KEY = status.secretKey;
}
