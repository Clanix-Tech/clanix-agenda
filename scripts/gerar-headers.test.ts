import { describe, expect, it } from 'vitest';
import { buildHeaders, headersFor, parseHeaders } from './gerar-headers.mjs';

function csp(text: string): string {
  const rules = parseHeaders(text);
  const all = rules.find((r) => r.pattern === '/*');
  return all?.headers['Content-Security-Policy'] ?? '';
}

describe('buildHeaders', () => {
  it('sem Turnstile: Supabase (https e wss) no connect-src e nenhum frame', () => {
    const text = buildHeaders({ supabaseUrl: 'https://abc.supabase.co', turnstile: false });
    const policy = csp(text);
    expect(policy).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co");
    expect(policy).toContain("frame-src 'none'");
    expect(policy).toContain("script-src 'self';");
    expect(text).not.toContain('challenges.cloudflare.com');
  });

  it('com Turnstile: libera challenges.cloudflare.com em script-src e frame-src', () => {
    const policy = csp(buildHeaders({ supabaseUrl: 'https://abc.supabase.co', turnstile: true }));
    expect(policy).toContain("script-src 'self' https://challenges.cloudflare.com;");
    expect(policy).toContain('frame-src https://challenges.cloudflare.com;');
  });

  it('gera a política completa, na ordem combinada', () => {
    expect(csp(buildHeaders({ supabaseUrl: 'https://abc.supabase.co', turnstile: false }))).toBe(
      [
        "default-src 'self'",
        "script-src 'self'",
        "frame-src 'none'",
        "connect-src 'self' https://abc.supabase.co wss://abc.supabase.co",
        "img-src 'self' data: blob:",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
    );
  });

  it('usa só a origem do Supabase (sem caminho) e, em http local, ws://', () => {
    const policy = csp(buildHeaders({ supabaseUrl: 'http://127.0.0.1:44321/', turnstile: false }));
    expect(policy).toContain("connect-src 'self' http://127.0.0.1:44321 ws://127.0.0.1:44321;");
  });

  it('recusa URL do Supabase inválida', () => {
    expect(() => buildHeaders({ supabaseUrl: '', turnstile: false })).toThrow(/VITE_SUPABASE_URL/);
    expect(() => buildHeaders({ supabaseUrl: 'ftp://abc', turnstile: false })).toThrow(
      /VITE_SUPABASE_URL/,
    );
  });
});

describe('parseHeaders', () => {
  it('lê de volta os blocos gerados (formato do Cloudflare Pages)', () => {
    const rules = parseHeaders(
      buildHeaders({ supabaseUrl: 'https://abc.supabase.co', turnstile: false }),
    );
    expect(rules.map((r) => r.pattern)).toEqual(['/*', '/sw.js', '/index.html', '/assets/*']);
    expect(rules[0]?.headers).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'X-Frame-Options': 'DENY',
    });
    expect(rules[1]?.headers).toEqual({ 'Cache-Control': 'no-cache' });
    expect(rules[2]?.headers).toEqual({ 'Cache-Control': 'no-cache' });
    expect(rules[3]?.headers).toEqual({
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
  });

  it('ignora comentários e linhas em branco', () => {
    expect(parseHeaders('# comentário\n\n/a\n  X-Teste: 1\n\n')).toEqual([
      { pattern: '/a', headers: { 'X-Teste': '1' } },
    ]);
  });
});

describe('headersFor', () => {
  const rules = parseHeaders(
    buildHeaders({ supabaseUrl: 'https://abc.supabase.co', turnstile: false }),
  );

  it('casa /* em qualquer caminho', () => {
    expect(headersFor(rules, '/agenda')).toHaveProperty('X-Frame-Options', 'DENY');
    expect(headersFor(rules, '/agenda')).not.toHaveProperty('Cache-Control');
  });

  it('casa caminhos exatos', () => {
    expect(headersFor(rules, '/sw.js')).toHaveProperty('Cache-Control', 'no-cache');
    expect(headersFor(rules, '/sw.jsx')).not.toHaveProperty('Cache-Control');
  });

  it('casa prefixos terminados em *', () => {
    expect(headersFor(rules, '/assets/index-abc.js')).toMatchObject({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    expect(headersFor(rules, '/assetsx/a.js')).not.toHaveProperty('Cache-Control');
  });
});
