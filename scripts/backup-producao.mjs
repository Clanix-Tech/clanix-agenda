// Backup próprio do banco de produção (o plano gratuito do Supabase não tem backups para baixar).
// Uso: npm run backup:producao
// 1. Lê SUPABASE_DB_URL do ambiente ou do .env.backup.local (ignorado pelo git). A URL tem a senha do
//    banco: nunca é impressa nem gravada em arquivo.
// 2. Roda `supabase db dump` três vezes (precisa do Docker ligado): papéis, estrutura e dados.
//    O dump de dados vem com todos os schemas de usuário, inclusive `auth` (profiles referencia
//    auth.users) e `public`; a CLI já exclui só os schemas internos da plataforma.
// 3. Grava em AGENDA_BACKUP_DIR (ou ~/Backups/clanix-agenda, sempre FORA do repositório) e apaga
//    os arquivos .sql com mais de 30 dias.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Pasta dos backups; lança se ficar dentro do repositório (os dumps têm dados de clientes). */
export function backupDir(env, home, repoRoot) {
  const custom = env.AGENDA_BACKUP_DIR?.trim();
  const dir = path.resolve(custom || path.join(home, 'Backups', 'clanix-agenda'));
  const rel = path.relative(path.resolve(repoRoot), dir);
  const outside = rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel);
  if (!outside) {
    throw new Error(
      'A pasta de backup não pode ficar dentro do repositório. Use outra pasta em AGENDA_BACKUP_DIR.',
    );
  }
  return dir;
}

const pad = (n) => String(n).padStart(2, '0');

/** Nomes dos três arquivos, no horário local da máquina: AAAA-MM-DD_HHmm-tipo.sql. */
export function backupFileNames(now) {
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return {
    roles: `${stamp}-roles.sql`,
    schema: `${stamp}-schema.sql`,
    data: `${stamp}-data.sql`,
  };
}

const OWN_FILE_RE = /^\d{4}-\d{2}-\d{2}_\d{4}-(roles|schema|data)\.sql$/;

/** Nomes dos arquivos DESTE script (padrão de nome) com mais de `days` dias; outros arquivos nunca. */
export function expiredBackups(files, now, days = RETENTION_DAYS) {
  const limit = now.getTime() - days * DAY_MS;
  return files.filter((f) => OWN_FILE_RE.test(f.name) && f.mtimeMs < limit).map((f) => f.name);
}

/** Tira a URL do banco (e a senha dela) de qualquer texto. */
export function maskSecret(text, url) {
  let out = String(text);
  const secrets = new Set();
  if (url) {
    secrets.add(url);
    try {
      const u = new URL(url);
      if (u.password) {
        secrets.add(u.password);
        secrets.add(decodeURIComponent(u.password));
      }
    } catch {
      // URL inválida: só a string inteira é mascarada.
    }
  }
  for (const s of secrets) out = out.split(s).join('***');
  return out;
}

function readDbUrl(root, env) {
  if (env.SUPABASE_DB_URL?.trim()) return env.SUPABASE_DB_URL.trim();
  const file = path.join(root, '.env.backup.local');
  if (!fs.existsSync(file)) return '';
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*SUPABASE_DB_URL\s*=\s*(.*?)\s*$/.exec(line);
    if (m) return m[1].replace(/^(["'])(.*)\1$/, '$2');
  }
  return '';
}

function dump(root, url, extraArgs, outFile) {
  const cli = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
  // Sem shell: a URL vai como argumento puro. Saída do dump vai direto para o arquivo (-f).
  const result = spawnSync(
    process.execPath,
    [cli, 'db', 'dump', '--db-url', url, ...extraArgs, '-f', outFile],
    { cwd: root, encoding: 'utf8' },
  );
  if (result.error || result.status !== 0) {
    const detail = maskSecret(`${result.stderr ?? ''}${result.error?.message ?? ''}`, url).trim();
    throw new Error(`Falha ao gerar ${path.basename(outFile)}.${detail ? `\n${detail}` : ''}`);
  }
}

async function backup() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const url = readDbUrl(root, process.env);
  if (!url) {
    console.error(
      'SUPABASE_DB_URL ausente. Defina no ambiente ou no arquivo .env.backup.local (veja docs/backup-e-restauracao.md).',
    );
    return 1;
  }
  const dir = backupDir(process.env, os.homedir(), root);
  fs.mkdirSync(dir, { recursive: true });
  const now = new Date();
  const names = backupFileNames(now);
  const written = [];
  try {
    dump(root, url, ['--role-only'], path.join(dir, names.roles));
    written.push(names.roles);
    dump(root, url, [], path.join(dir, names.schema));
    written.push(names.schema);
    dump(root, url, ['--data-only', '--use-copy'], path.join(dir, names.data));
    written.push(names.data);
  } catch (e) {
    // Backup incompleto é pior que nenhum: remove o que foi gerado nesta rodada.
    for (const n of Object.values(names)) fs.rmSync(path.join(dir, n), { force: true });
    console.error(e instanceof Error ? e.message : e);
    return 1;
  }
  for (const n of written) {
    if (fs.statSync(path.join(dir, n)).size === 0) {
      console.error(`O arquivo ${n} ficou vazio; o backup não é confiável.`);
      return 1;
    }
  }
  const files = fs
    .readdirSync(dir)
    .filter((n) => n.endsWith('.sql'))
    .map((name) => ({ name, mtimeMs: fs.statSync(path.join(dir, name)).mtimeMs }));
  const old = expiredBackups(files, now);
  for (const n of old) fs.rmSync(path.join(dir, n), { force: true });

  console.log(`Backup gravado em ${dir}:`);
  for (const n of written) console.log(`  ${n}`);
  if (old.length) console.log(`Removidos (mais de ${RETENTION_DAYS} dias): ${old.length}`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  backup().then(
    (code) => process.exit(code),
    (e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    },
  );
}
