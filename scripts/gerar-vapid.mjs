// Gera o par de chaves VAPID e o CRON_SECRET locais em supabase/functions/.env (ignorado
// pelo git; carregado pelo `supabase start`). Uso: npm run vapid:gerar [-- --forcar]
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

const envPath = fileURLToPath(new URL('../supabase/functions/.env', import.meta.url));
const force = process.argv.includes('--forcar');

if (existsSync(envPath) && !force) {
  const current = /^VAPID_PUBLIC_KEY=(.+)$/m.exec(readFileSync(envPath, 'utf8'))?.[1];
  console.error('supabase/functions/.env já existe; nada foi alterado.');
  console.error('Para gerar chaves novas (os aparelhos já assinados param de receber): --forcar');
  if (current)
    console.error(`Chave pública atual para o .env.local:\nVITE_VAPID_PUBLIC_KEY=${current}`);
  process.exit(1);
}

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
const cronSecret = randomBytes(32).toString('base64url');

const content = [
  '# Gerado por `npm run vapid:gerar`. NUNCA versione este arquivo.',
  `VAPID_PUBLIC_KEY=${publicKey}`,
  `VAPID_PRIVATE_KEY=${privateKey}`,
  '# Placeholder: em produção use um e-mail (mailto:) ou URL de contato real do responsável.',
  'VAPID_SUBJECT=mailto:contato@exemplo.com',
  `CRON_SECRET=${cronSecret}`,
  '',
].join('\n');

writeFileSync(envPath, content, { encoding: 'utf8', mode: 0o600 });

console.log(
  'Gravado supabase/functions/.env (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET).',
);
console.log(
  'Reinicie a pilha local para a Edge Function ler os valores: npx supabase stop && npx supabase start',
);
console.log('Depois rode: npm run lembretes:local');
console.log('\nAdicione ao .env.local do frontend:');
console.log(`VITE_VAPID_PUBLIC_KEY=${publicKey}`);
