// Grava no Vault local a URL da Edge Function send-reminders e o CRON_SECRET, para o
// pg_cron chamá-la a cada minuto. Uso: npm run lembretes:local
// Rode de novo depois de `npm run db:reset`/`db:test` (o reset apaga o Vault).
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const envPath = fileURLToPath(new URL('../supabase/functions/.env', import.meta.url));

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(envPath)) fail('supabase/functions/.env não existe: rode `npm run vapid:gerar`.');
const cronSecret = /^CRON_SECRET=(.+)$/m.exec(readFileSync(envPath, 'utf8'))?.[1]?.trim();
if (!cronSecret)
  fail('CRON_SECRET ausente em supabase/functions/.env: rode `npm run vapid:gerar -- --forcar`.');

let status;
try {
  const raw = execSync('npx supabase status -o json', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  status = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
} catch {
  fail('Supabase local indisponível: rode `npm run db:start`.');
}

const apiUrl = status.API_URL;
const secretKey = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
if (!apiUrl || !secretKey) fail('`npx supabase status` não trouxe API_URL e a chave secreta.');

// O pg_net roda dentro do container do banco: 127.0.0.1 seria o próprio container. Pelo
// Docker Desktop, host.docker.internal alcança a porta da API publicada no host (conferido
// em docs/supabase-local.md; http://supabase_kong_agenda-em-ordem:8000 também funciona).
const functionUrl = `http://host.docker.internal:${new URL(apiUrl).port}/functions/v1/send-reminders`;

const admin = createClient(apiUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error } = await admin.rpc('set_reminder_config', {
  p_function_url: functionUrl,
  p_cron_secret: cronSecret,
});
if (error) fail(`Falha ao gravar a configuração no Vault: ${error.code} ${error.message}`);

console.log(`Vault local configurado: o cron chama ${functionUrl} a cada minuto.`);
