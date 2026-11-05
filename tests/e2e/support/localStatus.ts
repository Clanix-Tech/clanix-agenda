import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface LocalStatus {
  url: string;
  publishableKey: string;
  /** Só existe no processo Node dos testes; nunca vai para arquivo nem para o navegador. */
  secretKey: string;
  mailpitUrl: string;
}

interface SupabaseStatus {
  API_URL?: string;
  PUBLISHABLE_KEY?: string;
  ANON_KEY?: string;
  SECRET_KEY?: string;
  SERVICE_ROLE_KEY?: string;
  MAILPIT_URL?: string;
  INBUCKET_URL?: string;
}

/** Lê URL e chaves do Supabase local deste repositório em tempo de execução. */
export function readLocalStatus(): LocalStatus {
  let raw: string;
  try {
    raw = execSync('npx supabase status -o json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new Error('Supabase local indisponível: rode `npm run db:start`.');
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const status = JSON.parse(raw.slice(start, end + 1)) as SupabaseStatus;
  const url = status.API_URL;
  const publishableKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
  const secretKey = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
  const mailpitUrl = status.MAILPIT_URL ?? status.INBUCKET_URL;
  if (!url || !publishableKey || !secretKey || !mailpitUrl) {
    throw new Error('Supabase local indisponível: rode `npm run db:start`.');
  }
  return { url, publishableKey, secretKey, mailpitUrl };
}

/** Segredos locais das Edge Functions (VAPID e CRON_SECRET), gerados por `npm run vapid:gerar`. */
const FUNCTIONS_ENV_PATH = fileURLToPath(
  new URL('../../../supabase/functions/.env', import.meta.url),
);

/** `supabase/functions/.env` existe: lembretes (push e cron) podem ser testados localmente. */
export function hasLocalFunctionsEnv(): boolean {
  return existsSync(FUNCTIONS_ENV_PATH);
}

/**
 * Chave pública VAPID de `supabase/functions/.env` (gerado por `npm run vapid:gerar`), ou `null`
 * se o arquivo não existir. Lê só a chave pública: a privada nunca sai daquele arquivo.
 */
export function readLocalVapidPublicKey(): string | null {
  if (!hasLocalFunctionsEnv()) return null;
  const match = /^VAPID_PUBLIC_KEY=(.+)$/m.exec(readFileSync(FUNCTIONS_ENV_PATH, 'utf8'));
  return match?.[1]?.trim() || null;
}
