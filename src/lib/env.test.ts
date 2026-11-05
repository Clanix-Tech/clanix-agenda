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
    });
  });
  it('a chave VAPID pública é opcional: presente vira o valor, vazia vira null', () => {
    const base = { VITE_SUPABASE_URL: 'http://x.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' };
    expect(parseEnv({ ...base, VITE_VAPID_PUBLIC_KEY: 'BAbc_-1' }).vapidPublicKey).toBe('BAbc_-1');
    expect(parseEnv({ ...base, VITE_VAPID_PUBLIC_KEY: '' }).vapidPublicKey).toBeNull();
    expect(parseEnv({ ...base, VITE_VAPID_PUBLIC_KEY: '  ' }).vapidPublicKey).toBeNull();
  });
});
