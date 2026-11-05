// Confere o ambiente de produção antes de publicar: variáveis do frontend, build e bundle.
// Uso: npm run verificar:producao (lê .env.production.local, como o `vite build` faz).
// Sai com código 1 e lista os problemas; com código 0, dist/ está pronto para publicar.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/** As únicas variáveis que podem ir para o bundle (todas públicas por natureza). */
export const ALLOWED_VITE_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_VAPID_PUBLIC_KEY',
  'VITE_APK_DOWNLOAD_URL',
  'VITE_TURNSTILE_SITE_KEY',
  'VITE_PRIVACY_CONTROLLER_NAME',
  'VITE_PRIVACY_CONTACT_EMAIL',
];

const REQUIRED = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_VAPID_PUBLIC_KEY',
  'VITE_PRIVACY_CONTROLLER_NAME',
  'VITE_PRIVACY_CONTACT_EMAIL',
];

/**
 * Trechos que nunca podem aparecer no site publicado. `sb_secret_` só conta seguido de um caractere
 * de chave (letra, número, `_` ou `-`): o supabase-js traz o prefixo sozinho (entre aspas) para
 * reconhecer o tipo da chave.
 */
const FORBIDDEN_IN_BUNDLE = [
  /sb_secret_[A-Za-z0-9_-]/,
  /service_role/,
  /-----BEGIN/,
  /PRIVATE KEY/,
];

const LOCAL_HOSTS = new Set(['localhost', '0.0.0.0', '[::1]']);

/** Endereço deste computador (o Supabase local), que nunca serve para o site publicado. */
function isLocalHost(hostname) {
  return (
    LOCAL_HOSTS.has(hostname) || hostname.endsWith('.localhost') || hostname.startsWith('127.')
  );
}

/** `role` de um JWT (chaves legadas anon/service_role); `undefined` se não for JWT. */
function jwtRole(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload?.role === 'string' ? payload.role : undefined;
  } catch {
    return undefined;
  }
}

/**
 * `VAPID_PUBLIC_KEY` de `supabase/functions/.env` (as chaves LOCAIS de desenvolvimento), ou `null`
 * se o arquivo não existir. Serve para pegar a chave local herdada por engano no build de produção.
 */
export function readLocalVapidPublicKey(root = process.cwd()) {
  const path = join(root, 'supabase', 'functions', '.env');
  if (!existsSync(path)) return null;
  const match = /^[ \t]*VAPID_PUBLIC_KEY[ \t]*=(.*)$/m.exec(readFileSync(path, 'utf8'));
  const value = match?.[1]
    ?.trim()
    .replace(/^(['"])(.*)\1$/, '$2')
    .trim();
  return value || null;
}

/**
 * Problemas das variáveis do frontend para produção.
 * `localVapidPublicKey`: chave pública VAPID LOCAL (de `supabase/functions/.env`), se houver.
 */
export function checkProductionEnv(env, { localVapidPublicKey = null } = {}) {
  const problems = [];
  const value = (name) => env[name]?.trim() ?? '';

  for (const name of REQUIRED) {
    if (!value(name)) problems.push(`${name} ausente.`);
  }

  const url = value('VITE_SUPABASE_URL');
  if (url) {
    let protocol;
    try {
      protocol = new URL(url).protocol;
    } catch {
      problems.push(`VITE_SUPABASE_URL não é uma URL válida: "${url}".`);
    }
    if (protocol && protocol !== 'https:') {
      problems.push(`VITE_SUPABASE_URL precisa usar https:// (recebido ${protocol}//).`);
    }
    const hostname = protocol ? new URL(url).hostname : '';
    if (hostname && isLocalHost(hostname)) {
      problems.push(
        `VITE_SUPABASE_URL aponta para este computador (${hostname}): use a URL do projeto hospedado. ` +
          'Ela falta no .env.production.local e veio do .env.local?',
      );
    }
  }

  const vapid = value('VITE_VAPID_PUBLIC_KEY');
  if (vapid && localVapidPublicKey && vapid === localVapidPublicKey.trim()) {
    problems.push(
      'VITE_VAPID_PUBLIC_KEY é a chave LOCAL de desenvolvimento (a mesma de supabase/functions/.env): ' +
        'use a chave pública de produção (veja docs/publicacao.md). Ela falta no .env.production.local e veio do .env.local?',
    );
  }

  const key = value('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (key.startsWith('sb_secret_')) {
    problems.push(
      'VITE_SUPABASE_PUBLISHABLE_KEY é uma chave secreta (sb_secret_…): use a chave publicável (sb_publishable_…).',
    );
  } else if (jwtRole(key) === 'service_role') {
    problems.push(
      'VITE_SUPABASE_PUBLISHABLE_KEY é um JWT com role service_role: use a chave publicável (ou a anon).',
    );
  }

  const email = value('VITE_PRIVACY_CONTACT_EMAIL');
  if (email && !z.email().safeParse(email).success) {
    problems.push(`VITE_PRIVACY_CONTACT_EMAIL não é um e-mail válido: "${email}".`);
  }

  for (const name of Object.keys(env)) {
    if (name.startsWith('VITE_') && !ALLOWED_VITE_VARS.includes(name)) {
      problems.push(`${name} não está na lista de variáveis permitidas do frontend.`);
    }
  }
  return problems;
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

/** Arquivos de `dir` (caminhos relativos, com `/`) que contêm algum trecho proibido. */
export function scanBundle(dir) {
  return listFiles(dir)
    .filter((file) => {
      const content = readFileSync(file, 'latin1');
      return FORBIDDEN_IN_BUNDLE.some((re) => re.test(content));
    })
    .map((file) => relative(dir, file).split(sep).join('/'));
}

function fail(title, problems) {
  console.error(`\n${title}`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

/** Variáveis, build e bundle; encerra o processo com código 1 se algo estiver errado. */
export async function verificarProducao(root = process.cwd()) {
  const { build, loadEnv } = await import('vite');
  // Exatamente o que o `vite build` vai ver: arquivos .env* do modo production e o ambiente.
  // Atenção: o loadEnv também lê o .env.local, então uma variável que falte no
  // .env.production.local herda o valor de desenvolvimento. Por isso a URL local e a chave VAPID
  // local são recusadas.
  const env = loadEnv('production', root, 'VITE_');
  const envProblems = checkProductionEnv(env, {
    localVapidPublicKey: readLocalVapidPublicKey(root),
  });
  if (envProblems.length) {
    fail('Ambiente de produção com problemas (.env.production.local):', envProblems);
  }
  console.log('Variáveis do frontend conferidas. Gerando o build de produção…');

  await build({ root, mode: 'production' });

  const leaked = scanBundle(join(root, 'dist'));
  if (leaked.length) {
    fail(
      'O build contém trechos de segredos (sb_secret_, service_role, -----BEGIN ou PRIVATE KEY):',
      leaked.map((f) => `dist/${f}`),
    );
  }
  console.log('\nBuild de produção verificado: dist/ pronto para publicar.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  verificarProducao().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
