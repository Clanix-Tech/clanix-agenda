import { describe, expect, it } from 'vitest';
import { parseEnv } from '@/lib/env';

describe('parseEnv', () => {
  it('lança quando a configuração está ausente', () => {
    expect(() => parseEnv({})).toThrow('VITE_SUPABASE_URL');
  });
  it('lança quando falta a chave', () => {
    expect(() => parseEnv({ VITE_SUPABASE_URL: 'http://x.test' })).toThrow(
      'Configuração ausente: VITE_SUPABASE_PUBLISHABLE_KEY',
    );
  });
  it('lança para URL inválida', () => {
    expect(() =>
      parseEnv({ VITE_SUPABASE_URL: 'abc', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' }),
    ).toThrow('VITE_SUPABASE_URL');
  });
  it('devolve os valores válidos', () => {
    expect(
      parseEnv({ VITE_SUPABASE_URL: 'http://x.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' }),
    ).toEqual({
      supabaseUrl: 'http://x.test',
      supabasePublishableKey: 'k',
      vapidPublicKey: null,
      apkDownloadUrl: null,
      turnstileSiteKey: null,
    });
  });
  it('a site key do Turnstile é opcional e aparada', () => {
    const base = { VITE_SUPABASE_URL: 'http://x.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' };
    expect(parseEnv({ ...base, VITE_TURNSTILE_SITE_KEY: ' 0x4AAA ' }).turnstileSiteKey).toBe(
      '0x4AAA',
    );
    expect(parseEnv({ ...base, VITE_TURNSTILE_SITE_KEY: '  ' }).turnstileSiteKey).toBeNull();
    expect(parseEnv(base).turnstileSiteKey).toBeNull();
  });
  it('a chave VAPID pública é opcional: presente vira o valor, vazia vira null', () => {
    const base = { VITE_SUPABASE_URL: 'http://x.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' };
    expect(parseEnv({ ...base, VITE_VAPID_PUBLIC_KEY: 'BAbc_-1' }).vapidPublicKey).toBe('BAbc_-1');
    expect(parseEnv({ ...base, VITE_VAPID_PUBLIC_KEY: '' }).vapidPublicKey).toBeNull();
    expect(parseEnv({ ...base, VITE_VAPID_PUBLIC_KEY: '  ' }).vapidPublicKey).toBeNull();
  });
  it('o link do APK é opcional e só aceita http/https', () => {
    const base = { VITE_SUPABASE_URL: 'http://x.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' };
    expect(
      parseEnv({ ...base, VITE_APK_DOWNLOAD_URL: ' https://x.test/app.apk ' }).apkDownloadUrl,
    ).toBe('https://x.test/app.apk');
    expect(parseEnv({ ...base, VITE_APK_DOWNLOAD_URL: '' }).apkDownloadUrl).toBeNull();
    expect(
      parseEnv({ ...base, VITE_APK_DOWNLOAD_URL: 'javascript:alert(1)' }).apkDownloadUrl,
    ).toBeNull();
    expect(parseEnv({ ...base, VITE_APK_DOWNLOAD_URL: 'lixo' }).apkDownloadUrl).toBeNull();
  });
});
