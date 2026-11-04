import { notificationOptions, parsePushData, resolveClickUrl } from './notifications';

const valid = {
  title: 'Lembrete de atendimento',
  body: '14:00 · Juliana Rocha — Escova · em 30 min',
  url: '/?atendimento=abc',
  tag: 'lembrete-abc',
};

describe('parsePushData', () => {
  it('aceita o formato enviado pelo servidor', () => {
    expect(parsePushData(valid)).toEqual(valid);
  });

  it('url que não é caminho relativo vira "/"', () => {
    expect(parsePushData({ ...valid, url: 'https://evil.com' })?.url).toBe('/');
    expect(parsePushData({ ...valid, url: '//evil.com' })?.url).toBe('/');
    expect(parsePushData({ ...valid, url: 'javascript:alert(1)' })?.url).toBe('/');
  });

  it('dados inválidos ou com campos faltando viram null', () => {
    expect(parsePushData(null)).toBeNull();
    expect(parsePushData('texto')).toBeNull();
    expect(parsePushData([])).toBeNull();
    expect(parsePushData({ ...valid, title: undefined })).toBeNull();
    expect(parsePushData({ ...valid, body: 3 })).toBeNull();
    expect(parsePushData({ ...valid, tag: undefined })).toBeNull();
    expect(parsePushData({ title: 'x', body: 'y', tag: 'z' })).toBeNull();
  });
});

describe('notificationOptions', () => {
  it('leva corpo, tag e a url em data', () => {
    const o = notificationOptions(valid);
    expect(o.body).toBe(valid.body);
    expect(o.tag).toBe('lembrete-abc');
    expect(o.data).toEqual({ url: '/?atendimento=abc' });
    expect(o.icon).toBe('/pwa-192x192.png');
    expect(o.badge).toBeTruthy();
    expect(o.renotify).toBe(false);
  });
});

describe('resolveClickUrl', () => {
  it('resolve no mesmo domínio e recusa outro domínio', () => {
    expect(resolveClickUrl('https://app.test', '/?atendimento=1')).toBe(
      'https://app.test/?atendimento=1',
    );
    expect(resolveClickUrl('https://app.test', 'https://evil.com/x')).toBe('https://app.test/');
    expect(resolveClickUrl('https://app.test', '//evil.com')).toBe('https://app.test/');
  });
});
