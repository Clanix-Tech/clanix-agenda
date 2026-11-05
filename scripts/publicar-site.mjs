// Publica o site no Cloudflare Pages (upload direto, plano gratuito).
// Uso: npm run publicar:site
// 1. Confere CF_PAGES_PROJECT e CF_PAGES_BRANCH.
// 2. Roda `npm run verificar:producao` (variáveis, build e bundle); para se algo estiver errado.
// 3. Envia dist/ com `wrangler pages deploy dist --project-name=$CF_PAGES_PROJECT --branch=$CF_PAGES_BRANCH`.
// As duas variáveis vêm do .env.production.local (ou do ambiente). Não são VITE_: nunca vão para o
// bundle. Antes da primeira vez: `npx wrangler login` (abre o navegador para entrar na conta).
//
// O `--branch` vai sempre: sem ele, o wrangler usa o branch atual do git, e publicar de um branch
// de trabalho vira uma prévia (<branch>.<projeto>.pages.dev) em vez do site de produção.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Branch de produção com que o projeto do Cloudflare Pages foi criado (o principal deste repositório). */
export const DEFAULT_BRANCH = 'master';

// Nome de projeto do Cloudflare Pages: minúsculas, números e hífens (também evita injeção no shell).
const PROJECT_RE = /^[a-z0-9][a-z0-9-]{0,57}$/;
// Nome de branch seguro para o shell: letras, números, `.`, `_`, `/` e `-`, sem começar com `-`.
const BRANCH_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/;

/** Argumentos do `npx` para publicar; lança se o projeto ou o branch forem inválidos. */
export function deployArgs(env) {
  const project = env.CF_PAGES_PROJECT?.trim() ?? '';
  if (!PROJECT_RE.test(project)) {
    throw new Error(
      'CF_PAGES_PROJECT ausente ou inválido no .env.production.local: informe o nome do projeto do Cloudflare Pages (minúsculas, números e hífens).',
    );
  }
  const branch = env.CF_PAGES_BRANCH?.trim() || DEFAULT_BRANCH;
  if (!BRANCH_RE.test(branch) || branch.includes('..')) {
    throw new Error(
      `CF_PAGES_BRANCH inválido no .env.production.local: "${branch}". Use o branch de produção do projeto (ex.: ${DEFAULT_BRANCH}), só com letras, números, ".", "_", "/" e "-".`,
    );
  }
  return ['wrangler', 'pages', 'deploy', 'dist', `--project-name=${project}`, `--branch=${branch}`];
}

/** No Windows, `npm`/`npx` são .cmd e precisam do shell; os argumentos são todos fixos ou validados. */
function run(root, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

async function publicar() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const { loadEnv } = await import('vite');
  let args;
  try {
    args = deployArgs(loadEnv('production', root, 'CF_'));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return 1;
  }

  const verification = run(root, 'npm', ['run', 'verificar:producao']);
  if (verification !== 0) {
    console.error('\nPublicação cancelada: a verificação de produção falhou.');
    return verification;
  }
  return run(root, 'npx', args);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  publicar().then(
    (code) => process.exit(code),
    (e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    },
  );
}
