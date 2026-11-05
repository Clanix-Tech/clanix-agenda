// Cabeçalhos HTTP do site publicado, no formato `_headers` do Cloudflare Pages.
// O build (vite.config.ts) grava dist/_headers com este conteúdo e o `vite preview` aplica o mesmo
// arquivo, para os testes ponta a ponta rodarem com a CSP de verdade.
// Uso avulso: VITE_SUPABASE_URL=https://... [VITE_TURNSTILE_SITE_KEY=...] node scripts/gerar-headers.mjs
import { fileURLToPath } from 'node:url';

const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/** Origem do Supabase (sem caminho) e a mesma origem para WebSocket (realtime). */
function supabaseOrigins(supabaseUrl) {
  let url;
  try {
    url = new URL(supabaseUrl);
  } catch {
    throw new Error(`VITE_SUPABASE_URL inválida: "${supabaseUrl}".`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`VITE_SUPABASE_URL precisa ser http(s): "${supabaseUrl}".`);
  }
  return { http: url.origin, ws: url.origin.replace(/^http/, 'ws') };
}

export function buildHeaders({ supabaseUrl, turnstile }) {
  const supabase = supabaseOrigins(supabaseUrl);
  const csp = [
    "default-src 'self'",
    `script-src 'self'${turnstile ? ` ${TURNSTILE_ORIGIN}` : ''}`,
    `frame-src ${turnstile ? TURNSTILE_ORIGIN : "'none'"}`,
    `connect-src 'self' ${supabase.http} ${supabase.ws}`,
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  const blocks = [
    [
      '/*',
      {
        'Content-Security-Policy': csp,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'X-Frame-Options': 'DENY',
      },
    ],
    // O navegador precisa sempre conferir se há versão nova do app (service worker e página).
    ['/sw.js', { 'Cache-Control': 'no-cache' }],
    ['/index.html', { 'Cache-Control': 'no-cache' }],
    // Arquivos do build têm hash no nome: podem ficar no cache para sempre.
    ['/assets/*', { 'Cache-Control': 'public, max-age=31536000, immutable' }],
  ];
  return `${blocks
    .map(
      ([pattern, headers]) =>
        `${pattern}\n${Object.entries(headers)
          .map(([name, value]) => `  ${name}: ${value}`)
          .join('\n')}`,
    )
    .join('\n\n')}\n`;
}

/** Lê um `_headers` (linha sem recuo = caminho; linhas recuadas = `Nome: valor`; `#` = comentário). */
export function parseHeaders(text) {
  const rules = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      rules.push({ pattern: trimmed, headers: {} });
      continue;
    }
    const current = rules.at(-1);
    const colon = trimmed.indexOf(':');
    if (!current || colon <= 0) {
      throw new Error(`Linha inválida no _headers: "${line}".`);
    }
    current.headers[trimmed.slice(0, colon).trim()] = trimmed.slice(colon + 1).trim();
  }
  return rules;
}

/** Cabeçalhos para um caminho: junta os blocos que casam (`/*`, caminho exato ou prefixo com `*`). */
export function headersFor(rules, pathname) {
  const headers = {};
  for (const { pattern, headers: h } of rules) {
    const matches = pattern.endsWith('*')
      ? pathname.startsWith(pattern.slice(0, -1))
      : pathname === pattern;
    if (matches) Object.assign(headers, h);
  }
  return headers;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.stdout.write(
      buildHeaders({
        supabaseUrl: process.env.VITE_SUPABASE_URL ?? '',
        turnstile: Boolean(process.env.VITE_TURNSTILE_SITE_KEY?.trim()),
      }),
    );
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
