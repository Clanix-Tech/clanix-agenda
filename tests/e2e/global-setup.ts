import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readLocalStatus } from './support/localStatus.ts';

/**
 * Lê o Supabase local (`npx supabase status -o json`), grava `.env.test.local` só com as duas
 * variáveis públicas do frontend e deixa a chave secreta apenas na memória do processo de teste
 * (os workers herdam `process.env`). A chave secreta nunca vai para disco nem para o navegador.
 */
export default function globalSetup(): void {
  const status = readLocalStatus();
  const envFile = fileURLToPath(new URL('../../.env.test.local', import.meta.url));
  writeFileSync(
    envFile,
    `VITE_SUPABASE_URL=${status.url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${status.publishableKey}\n`,
    'utf8',
  );
  process.env.E2E_SUPABASE_URL = status.url;
  process.env.E2E_SUPABASE_PUBLISHABLE_KEY = status.publishableKey;
  process.env.E2E_MAILPIT_URL = status.mailpitUrl;
  process.env.E2E_SUPABASE_SECRET_KEY = status.secretKey;
}
