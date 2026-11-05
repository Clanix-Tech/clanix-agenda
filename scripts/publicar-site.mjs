// Publica o site no Cloudflare Pages (upload direto, plano gratuito).
// Uso: npm run publicar:site
// 1. Confere CF_PAGES_PROJECT.
// 2. Roda `npm run verificar:producao` (variáveis, build e bundle); para se algo estiver errado.
// 3. Envia dist/ com `wrangler pages deploy dist --project-name=$CF_PAGES_PROJECT`.
// CF_PAGES_PROJECT vem do .env.production.local (ou do ambiente). Não é VITE_: nunca vai para o
// bundle. Antes da primeira vez: `npx wrangler login` (abre o navegador para entrar na conta).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// Nome de projeto do Cloudflare Pages: minúsculas, números e hífens (também evita injeção no shell).
const PROJECT_RE = /^[a-z0-9][a-z0-9-]{0,57}$/;

/** No Windows, `npm`/`npx` são .cmd e precisam do shell; os argumentos são todos fixos ou validados. */
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

const project = loadEnv('production', ROOT, 'CF_').CF_PAGES_PROJECT?.trim() ?? '';
if (!PROJECT_RE.test(project)) {
  console.error(
    'CF_PAGES_PROJECT ausente ou inválido no .env.production.local: informe o nome do projeto do Cloudflare Pages (minúsculas, números e hífens).',
  );
  process.exit(1);
}

const verification = run('npm', ['run', 'verificar:producao']);
if (verification !== 0) {
  console.error('\nPublicação cancelada: a verificação de produção falhou.');
  process.exit(verification);
}

process.exit(run('npx', ['wrangler', 'pages', 'deploy', 'dist', `--project-name=${project}`]));
