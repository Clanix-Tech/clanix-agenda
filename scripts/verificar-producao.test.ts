import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkProductionEnv, readLocalVapidPublicKey, scanBundle } from './verificar-producao.mjs';

const VALID = {
  VITE_SUPABASE_URL: 'https://exemplo.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_exemplo',
  VITE_VAPID_PUBLIC_KEY: 'BExemploDeChavePublica',
  VITE_PRIVACY_CONTROLLER_NAME: 'Ana Exemplo',
  VITE_PRIVACY_CONTACT_EMAIL: 'contato@exemplo.com.br',
};

/** JWT sem assinatura válida: só o conteúdo importa para a verificação. */
function jwt(payload: object): string {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(payload)}.assinatura`;
}

describe('checkProductionEnv', () => {
  it('ambiente completo não tem problemas', () => {
    expect(checkProductionEnv(VALID)).toEqual([]);
  });

  it('aceita as variáveis opcionais permitidas e ignora as que não são VITE_', () => {
    expect(
      checkProductionEnv({
        ...VALID,
        VITE_APK_DOWNLOAD_URL: 'https://exemplo.com/agenda.apk',
        VITE_TURNSTILE_SITE_KEY: '0x4AAAAAAA',
        CF_PAGES_PROJECT: 'agenda-em-ordem',
        PATH: '/usr/bin',
      }),
    ).toEqual([]);
  });

  it('chave secreta (sb_secret_) no lugar da publicável é problema', () => {
    const problems = checkProductionEnv({ ...VALID, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_x' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/VITE_SUPABASE_PUBLISHABLE_KEY.*secreta/);
  });

  it('JWT legado com role service_role é problema; o anon passa', () => {
    expect(
      checkProductionEnv({
        ...VALID,
        VITE_SUPABASE_PUBLISHABLE_KEY: jwt({ iss: 'supabase', role: 'service_role' }),
      }),
    ).toEqual([expect.stringMatching(/VITE_SUPABASE_PUBLISHABLE_KEY.*service_role/)]);
    expect(
      checkProductionEnv({
        ...VALID,
        VITE_SUPABASE_PUBLISHABLE_KEY: jwt({ iss: 'supabase', role: 'anon' }),
      }),
    ).toEqual([]);
  });

  it('URL do Supabase em http:// é problema', () => {
    expect(
      checkProductionEnv({ ...VALID, VITE_SUPABASE_URL: 'http://exemplo.supabase.co' }),
    ).toEqual([expect.stringMatching(/VITE_SUPABASE_URL.*https/)]);
    expect(checkProductionEnv({ ...VALID, VITE_SUPABASE_URL: 'não é url' })).toEqual([
      expect.stringMatching(/VITE_SUPABASE_URL/),
    ]);
  });

  it.each([
    'https://localhost:44321',
    'https://127.0.0.1:44321',
    'http://127.0.0.1:44321',
    'https://api.localhost',
  ])('URL do Supabase local (%s) é problema, mesmo com https', (url) => {
    expect(
      checkProductionEnv({ ...VALID, VITE_SUPABASE_URL: url }).some((p) =>
        /VITE_SUPABASE_URL aponta para este computador/.test(p),
      ),
    ).toBe(true);
  });

  it('chave VAPID igual à local (supabase/functions/.env) é problema; diferente passa', () => {
    expect(checkProductionEnv(VALID, { localVapidPublicKey: VALID.VITE_VAPID_PUBLIC_KEY })).toEqual(
      [expect.stringMatching(/VITE_VAPID_PUBLIC_KEY.*LOCAL/)],
    );
    expect(checkProductionEnv(VALID, { localVapidPublicKey: 'BOutraChaveLocal' })).toEqual([]);
    expect(checkProductionEnv(VALID, { localVapidPublicKey: null })).toEqual([]);
  });

  it('variável VITE_ fora da lista permitida é problema', () => {
    expect(checkProductionEnv({ ...VALID, VITE_FOO: 'x' })).toEqual([
      expect.stringMatching(/VITE_FOO/),
    ]);
  });

  it('exige chave publicável, VAPID e os dados de privacidade', () => {
    const problems = checkProductionEnv({
      VITE_SUPABASE_URL: VALID.VITE_SUPABASE_URL,
      VITE_PRIVACY_CONTROLLER_NAME: '   ',
    });
    for (const name of [
      'VITE_SUPABASE_PUBLISHABLE_KEY',
      'VITE_VAPID_PUBLIC_KEY',
      'VITE_PRIVACY_CONTROLLER_NAME',
      'VITE_PRIVACY_CONTACT_EMAIL',
    ]) {
      expect(problems.some((p) => p.includes(name))).toBe(true);
    }
    expect(problems).toHaveLength(4);
  });

  it('e-mail de privacidade inválido é problema (o app o descartaria em silêncio)', () => {
    expect(checkProductionEnv({ ...VALID, VITE_PRIVACY_CONTACT_EMAIL: 'contato' })).toEqual([
      expect.stringMatching(/VITE_PRIVACY_CONTACT_EMAIL/),
    ]);
  });
});

describe('readLocalVapidPublicKey', () => {
  let root: string | undefined;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it('lê VAPID_PUBLIC_KEY de supabase/functions/.env (com ou sem aspas)', () => {
    root = mkdtempSync(join(tmpdir(), 'agenda-vapid-'));
    mkdirSync(join(root, 'supabase', 'functions'), { recursive: true });
    const file = join(root, 'supabase', 'functions', '.env');
    writeFileSync(file, '# comentário\nVAPID_PUBLIC_KEY=BChaveLocal\nVAPID_PRIVATE_KEY=x\n');
    expect(readLocalVapidPublicKey(root)).toBe('BChaveLocal');
    writeFileSync(file, 'VAPID_PUBLIC_KEY="BChaveLocal"\r\n');
    expect(readLocalVapidPublicKey(root)).toBe('BChaveLocal');
  });

  it('sem o arquivo (ou sem a chave) → null', () => {
    root = mkdtempSync(join(tmpdir(), 'agenda-vapid-'));
    expect(readLocalVapidPublicKey(root)).toBeNull();
    mkdirSync(join(root, 'supabase', 'functions'), { recursive: true });
    writeFileSync(join(root, 'supabase', 'functions', '.env'), 'CRON_SECRET=x\n');
    expect(readLocalVapidPublicKey(root)).toBeNull();
  });
});

describe('scanBundle', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('lista os arquivos (também em subpastas) com segredos', () => {
    dir = mkdtempSync(join(tmpdir(), 'agenda-scan-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>ok</title>');
    writeFileSync(join(dir, 'assets', 'a.js'), 'const k = "sb_secret_abc";');
    writeFileSync(join(dir, 'assets', 'b.js'), 'const r = "service_role";');
    writeFileSync(join(dir, 'assets', 'c.js'), '-----BEGIN CERTIFICATE-----');
    writeFileSync(join(dir, 'assets', 'd.js'), 'PRIVATE KEY');
    writeFileSync(join(dir, 'assets', 'e.js'), 'const ok = "sb_publishable_abc";');
    writeFileSync(join(dir, 'assets', 'f.js'), 'const k = "sb_secret_-abc";');
    writeFileSync(join(dir, 'assets', 'g.js'), 'const k = "sb_secret__abc";');
    expect(scanBundle(dir).sort()).toEqual([
      'assets/a.js',
      'assets/b.js',
      'assets/c.js',
      'assets/d.js',
      'assets/f.js',
      'assets/g.js',
    ]);
  });

  it('pasta limpa → lista vazia', () => {
    dir = mkdtempSync(join(tmpdir(), 'agenda-scan-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html>');
    expect(scanBundle(dir)).toEqual([]);
  });

  it('o prefixo sozinho, como o supabase-js usa para reconhecer o tipo de chave, não é segredo', () => {
    dir = mkdtempSync(join(tmpdir(), 'agenda-scan-'));
    writeFileSync(
      join(dir, 'supabase.js'),
      'ua=e=>e.startsWith(`sb_publishable_`)||e.startsWith(`sb_secret_`),x="sb_secret_"',
    );
    expect(scanBundle(dir)).toEqual([]);
  });
});
