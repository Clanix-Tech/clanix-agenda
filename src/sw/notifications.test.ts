import {
  notificationOptions,
  openNotificationTarget,
  parsePushData,
  resolveClickUrl,
  type WindowLike,
} from './notifications';

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

describe('openNotificationTarget', () => {
  const origin = 'https://app.test';
  const target = 'https://app.test/?atendimento=1';

  function win(over: Partial<WindowLike> = {}) {
    const w: WindowLike = {
      url: 'https://app.test/agenda',
      focus: vi.fn(async () => w),
      navigate: vi.fn(async () => null),
      ...over,
    };
    return w;
  }
  function clients(windows: WindowLike[]) {
    return { matchAll: vi.fn(async () => windows), openWindow: vi.fn(async () => null) };
  }

  it('janela controlada: foca e navega, sem abrir outra', async () => {
    const w = win();
    const c = clients([w]);
    await openNotificationTarget(c, origin, target);
    expect(c.matchAll).toHaveBeenCalledWith({ type: 'window' });
    expect(w.focus).toHaveBeenCalled();
    expect(w.navigate).toHaveBeenCalledWith(target);
    expect(c.openWindow).not.toHaveBeenCalled();
  });

  it('só janelas não controladas (matchAll vazio): abre uma janela nova', async () => {
    const c = clients([]);
    await openNotificationTarget(c, origin, target);
    expect(c.openWindow).toHaveBeenCalledWith(target);
  });

  it('navigate rejeita: abre uma janela nova', async () => {
    const w = win({ navigate: vi.fn(async () => Promise.reject(new Error('não controlada'))) });
    const c = clients([w]);
    await openNotificationTarget(c, origin, target);
    expect(c.openWindow).toHaveBeenCalledWith(target);
  });

  it('janela de outro domínio é ignorada', async () => {
    const c = clients([win({ url: 'https://outro.test/' })]);
    await openNotificationTarget(c, origin, target);
    expect(c.openWindow).toHaveBeenCalledWith(target);
  });
});
