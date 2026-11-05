import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, makeSession, type FakeSupabase } from '@/test/fakeSupabase';
import {
  ANDROID_CHROME_UA,
  IPHONE_SAFARI_UA,
  TEST_VAPID_KEY,
  installFakePush,
  type FakePush,
  type FakePushOptions,
} from '@/test/fakePush';
import {
  deviceLabel,
  detectDeviceState,
  ensureCurrentKey,
  dropOtherAccountSubscription,
  forgetThisDevice,
  devicePlatform,
  isIOSDevice,
  isIOSSafari,
  isStandalone,
  readDeviceState,
  sendTestNotification,
  subscribeThisDevice,
  unsubscribeThisDevice,
  type DeviceEnv,
} from './push';

const holder = vi.hoisted(() => ({ supabase: undefined as unknown, vapid: null as string | null }));
vi.mock('@/lib/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, prop) => Reflect.get(holder.supabase as object, prop) }),
}));
vi.mock('@/lib/env', () => ({
  getEnv: () => ({
    supabaseUrl: 'http://supabase.test',
    supabasePublishableKey: 'chave',
    vapidPublicKey: holder.vapid,
  }),
}));

let push: FakePush | undefined;

function setup(
  pushOptions: FakePushOptions = {},
  supabase: Parameters<typeof createFakeSupabase>[0] = {},
): { push: FakePush; fake: FakeSupabase } {
  holder.vapid = TEST_VAPID_KEY;
  push = installFakePush(pushOptions);
  const fake = createFakeSupabase({ session: makeSession(), ...supabase });
  holder.supabase = fake;
  return { push, fake };
}

afterEach(() => {
  push?.restore();
  push = undefined;
});

const BASE: DeviceEnv = {
  hasSW: true,
  hasPush: true,
  hasNotification: true,
  isIOS: false,
  isStandalone: false,
  permission: 'default',
  hasSubscription: false,
};

describe('detectDeviceState', () => {
  it.each<[string, Partial<DeviceEnv>, string]>([
    [
      'iPhone no Safari, sem instalar → instalar (mesmo sem PushManager)',
      { isIOS: true, hasPush: false, hasNotification: false },
      'iphone-instalar',
    ],
    ['iPhone no Safari, sem instalar e com tudo disponível', { isIOS: true }, 'iphone-instalar'],
    [
      'iPhone instalado, sem assinatura, permissão default',
      { isIOS: true, isStandalone: true },
      'desativado',
    ],
    ['permissão negada → bloqueado', { permission: 'denied' }, 'bloqueado'],
    [
      'iPhone instalado e permissão negada',
      { isIOS: true, isStandalone: true, permission: 'denied' },
      'bloqueado',
    ],
    ['sem service worker → sem suporte', { hasSW: false }, 'sem-suporte'],
    ['sem PushManager → sem suporte', { hasPush: false }, 'sem-suporte'],
    ['sem Notification → sem suporte', { hasNotification: false }, 'sem-suporte'],
    [
      'com assinatura e permissão concedida → ativado',
      { permission: 'granted', hasSubscription: true },
      'ativado',
    ],
    ['permissão concedida sem assinatura → desativado', { permission: 'granted' }, 'desativado'],
    [
      'assinatura com permissão revogada → bloqueado',
      { permission: 'denied', hasSubscription: true },
      'bloqueado',
    ],
  ])('%s', (_name, env, expected) => {
    expect(detectDeviceState({ ...BASE, ...env })).toBe(expected);
  });
});

describe('deviceLabel', () => {
  it.each([
    [IPHONE_SAFARI_UA, 'iPhone · Safari'],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      'iPhone · Safari',
    ],
    [ANDROID_CHROME_UA, 'Android · Chrome'],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
      'Windows · Edge',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:127.0) Gecko/20100101 Firefox/127.0',
      'Mac · Firefox',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
      'Android · Samsung Internet',
    ],
    ['', 'Aparelho · Navegador'],
  ])('%s → %s', (ua, label) => {
    expect(deviceLabel(ua)).toBe(label);
  });

  it('iPad que se apresenta como Mac', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
    expect(deviceLabel(ua, true)).toBe('iPad · Safari');
  });
});

describe('readDeviceState', () => {
  it('sem service worker registrado (ex.: vite dev) → sem suporte', async () => {
    setup({ sw: false });
    expect(await readDeviceState()).toBe('sem-suporte');
  });

  it('iPhone no Safari sem instalar → instalar', async () => {
    setup({ userAgent: IPHONE_SAFARI_UA, push: false, notification: false });
    expect(await readDeviceState()).toBe('iphone-instalar');
  });

  it('iPad com user agent de Mac (toque) no Safari, sem instalar → instalar', async () => {
    setup({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      maxTouchPoints: 5,
    });
    expect(await readDeviceState()).toBe('iphone-instalar');
  });

  it('Mac de verdade (sem toque) segue o caminho normal', async () => {
    setup({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      maxTouchPoints: 0,
    });
    expect(await readDeviceState()).toBe('desativado');
  });

  it('iPhone aberto pelo ícone → desativado', async () => {
    setup({ userAgent: IPHONE_SAFARI_UA, standalone: true });
    expect(await readDeviceState()).toBe('desativado');
  });

  it('assinatura do navegador registrada para este usuário → ativado', async () => {
    const endpoint = 'https://push.example/meu';
    setup(
      { permission: 'granted', subscribed: endpoint },
      { tables: { push_subscriptions: [{ id: 's1', owner_id: 'user-1', endpoint }] } },
    );
    expect(await readDeviceState()).toBe('ativado');
  });

  it('assinatura do navegador sem linha visível para este usuário (outra conta) → desativado', async () => {
    setup(
      { permission: 'granted', subscribed: 'https://push.example/de-outra-conta' },
      { tables: { push_subscriptions: [] } },
    );
    expect(await readDeviceState()).toBe('desativado');
  });

  it('falha ao consultar o banco é lançada (nunca vira "ativado")', async () => {
    setup(
      { permission: 'granted', subscribed: 'https://push.example/meu' },
      { errors: { push_subscriptions: { select: { message: 'TypeError: Failed to fetch' } } } },
    );
    await expect(readDeviceState()).rejects.toMatchObject({
      message: 'TypeError: Failed to fetch',
    });
  });
});

describe('subscribeThisDevice', () => {
  it('pede a permissão na mesma chamada (sem esperar nada antes)', () => {
    const { push } = setup();
    const pending = subscribeThisDevice();
    expect(push.requestPermission).toHaveBeenCalledTimes(1);
    return pending;
  });

  it('assina com userVisibleOnly e a chave VAPID e registra pela RPC com o rótulo do aparelho', async () => {
    const { push, fake } = setup({ userAgent: ANDROID_CHROME_UA });
    await subscribeThisDevice();
    expect(push.subscribe).toHaveBeenCalledTimes(1);
    const opts = push.subscribe.mock.calls[0]![0];
    expect(opts.userVisibleOnly).toBe(true);
    const key = new Uint8Array(opts.applicationServerKey as Uint8Array);
    expect(key).toHaveLength(65);
    expect(key[0]).toBe(4);
    expect(fake.calls.rpc).toEqual([
      {
        name: 'register_push_subscription',
        args: {
          p_endpoint: 'https://push.example/aparelho-1',
          p_p256dh: 'p256dh-do-aparelho',
          p_auth: 'auth-do-aparelho',
          p_device_label: 'Android · Chrome',
        },
      },
    ]);
  });

  it('permissão negada: não assina nem chama a RPC', async () => {
    const { push, fake } = setup({ answer: 'denied' });
    await subscribeThisDevice();
    expect(push.subscribe).not.toHaveBeenCalled();
    expect(fake.calls.rpc).toHaveLength(0);
  });

  it('RPC falha por rede: desfaz a assinatura do navegador e lança "Sem conexão" (RN17)', async () => {
    const { push } = setup(
      {},
      {
        rpc: {
          register_push_subscription: () => ({ error: { message: 'TypeError: Failed to fetch' } }),
        },
      },
    );
    await expect(subscribeThisDevice()).rejects.toMatchObject({
      kind: 'rede',
      message: 'Sem conexão. Nada foi salvo — tente novamente.',
    });
    expect(push.subscription()).toBeNull();
  });

  it('assinatura antiga com outra chave VAPID é trocada por uma nova', async () => {
    const { push, fake } = setup({
      permission: 'granted',
      subscribed: 'https://push.example/velho',
    });
    const old = push.subscription()!;
    old.options.applicationServerKey = new Uint8Array([4, 1, 2, 3]).buffer;
    await subscribeThisDevice();
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(push.subscription()!.endpoint).not.toBe('https://push.example/velho');
    expect((fake.calls.rpc[0]!.args as { p_endpoint: string }).p_endpoint).toBe(
      push.subscription()!.endpoint,
    );
  });
});

describe('ensureCurrentKey (troca de chave VAPID)', () => {
  const OTHER_KEY =
    'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

  it('inscrição com outra chave → cancela, inscreve com a chave atual e registra', async () => {
    const { push } = setup({
      permission: 'granted',
      subscribed: 'https://push.example/velho',
      applicationServerKey: OTHER_KEY,
    });
    const old = push.subscription()!;
    const register = vi.fn(async () => {});

    const result = await ensureCurrentKey(push.registration as never, TEST_VAPID_KEY, register);

    expect(result).toBe('renovada');
    expect(old.unsubscribe).toHaveBeenCalledTimes(1);
    expect(push.subscribe).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(push.subscription());
    expect(push.subscription()!.endpoint).not.toBe('https://push.example/velho');
  });

  it('mesma chave → ok, sem efeitos', async () => {
    const { push } = setup({ permission: 'granted', subscribed: 'https://push.example/atual' });
    const current = push.subscription()!;
    const register = vi.fn(async () => {});

    const result = await ensureCurrentKey(push.registration as never, TEST_VAPID_KEY, register);

    expect(result).toBe('ok');
    expect(current.unsubscribe).not.toHaveBeenCalled();
    expect(push.subscribe).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });
});

describe('unsubscribeThisDevice', () => {
  const endpoint = 'https://push.example/meu';

  it('apaga a linha do endpoint e cancela a assinatura do navegador', async () => {
    const { push, fake } = setup(
      { permission: 'granted', subscribed: endpoint },
      {
        tables: {
          push_subscriptions: [
            { id: 's1', owner_id: 'user-1', endpoint },
            { id: 's2', owner_id: 'user-1', endpoint: 'https://push.example/outro' },
          ],
        },
      },
    );
    const sub = push.subscription()!;
    await unsubscribeThisDevice();
    expect(fake.tables.push_subscriptions!.map((r) => r.id)).toEqual(['s2']);
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it('falha ao apagar: lança e mantém a assinatura (continua ativado)', async () => {
    const { push } = setup(
      { permission: 'granted', subscribed: endpoint },
      { errors: { push_subscriptions: { delete: { message: 'TypeError: Failed to fetch' } } } },
    );
    const sub = push.subscription()!;
    await expect(unsubscribeThisDevice()).rejects.toMatchObject({ kind: 'rede' });
    expect(sub.unsubscribe).not.toHaveBeenCalled();
  });
});

describe('forgetThisDevice (ao sair)', () => {
  const endpoint = 'https://push.example/meu';

  it('sem assinatura não faz nada', async () => {
    const { fake } = setup();
    const from = vi.spyOn(fake, 'from');
    await forgetThisDevice();
    expect(from).not.toHaveBeenCalled();
  });

  it('sem service worker (jsdom puro) não faz nada', async () => {
    holder.supabase = createFakeSupabase();
    await expect(forgetThisDevice()).resolves.toBeUndefined();
  });

  it('banco sem resposta: desiste no tempo limite e cancela a assinatura mesmo assim', async () => {
    const { push, fake } = setup({ permission: 'granted', subscribed: endpoint });
    const sub = push.subscription()!;
    fake.from = (() => ({
      delete: () => ({ eq: () => new Promise(() => {}) }),
    })) as unknown as typeof fake.from;
    await forgetThisDevice(20);
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it('unsubscribe sem resposta: desiste no tempo limite (sair nunca trava)', async () => {
    const { push } = setup({ permission: 'granted', subscribed: endpoint });
    push.subscription()!.unsubscribe.mockImplementation(() => new Promise(() => {}));
    await expect(forgetThisDevice(20)).resolves.toBeUndefined();
  });

  it('service worker sem resposta: desiste no tempo limite', async () => {
    const { push } = setup({ permission: 'granted', subscribed: endpoint });
    push.registration.pushManager.getSubscription.mockImplementation(() => new Promise(() => {}));
    await expect(forgetThisDevice(20)).resolves.toBeUndefined();
  });

  it('fecha as notificações exibidas ao sair (privacidade)', async () => {
    const { push } = setup({ permission: 'granted', subscribed: endpoint });
    const shown = [{ close: vi.fn() }, { close: vi.fn() }];
    push.state.shown.push(...shown);
    await forgetThisDevice();
    for (const notification of shown) expect(notification.close).toHaveBeenCalledOnce();
  });

  it('getNotifications sem resposta não trava a saída', async () => {
    const { push } = setup({ permission: 'granted', subscribed: endpoint });
    push.registration.getNotifications.mockImplementation(() => new Promise(() => {}));
    await expect(forgetThisDevice(20)).resolves.toBeUndefined();
    expect(push.subscription()).toBeNull();
  });

  it('falha de rede ao apagar não impede cancelar a assinatura', async () => {
    const { push } = setup(
      { permission: 'granted', subscribed: endpoint },
      { errors: { push_subscriptions: { delete: { message: 'TypeError: Failed to fetch' } } } },
    );
    const sub = push.subscription()!;
    await expect(forgetThisDevice()).resolves.toBeUndefined();
    expect(sub.unsubscribe).toHaveBeenCalled();
  });
});

describe('sendTestNotification', () => {
  it('chama a Edge Function e devolve { sent, removed }', async () => {
    const { fake } = setup(
      {},
      { functions: { 'send-test-notification': () => ({ data: { sent: 2, removed: 1 } }) } },
    );
    await expect(sendTestNotification()).resolves.toEqual({ sent: 2, removed: 1 });
    expect(fake.calls.functions.map((c) => c.name)).toEqual(['send-test-notification']);
  });

  it('falha de rede vira "Sem conexão"', async () => {
    setup(
      {},
      {
        functions: {
          'send-test-notification': () => ({
            error: {
              name: 'FunctionsFetchError',
              message: 'Failed to send a request to the Edge Function',
            },
          }),
        },
      },
    );
    await expect(sendTestNotification()).rejects.toMatchObject({ kind: 'rede' });
  });

  it('401 da função vira sessão expirada', async () => {
    setup(
      {},
      {
        functions: {
          'send-test-notification': () => ({
            error: {
              name: 'FunctionsHttpError',
              message: 'Edge Function returned a non-2xx status code',
              context: new Response('{}', { status: 401 }),
            },
          }),
        },
      },
    );
    await expect(sendTestNotification()).rejects.toMatchObject({ kind: 'sessao' });
  });
});

describe('dropOtherAccountSubscription (troca de conta)', () => {
  const endpoint = 'https://push.example/deste-navegador';

  it('assinatura do navegador sem linha visível para o usuário atual → cancela no navegador', async () => {
    const { push } = setup(
      { permission: 'granted', subscribed: endpoint },
      { tables: { push_subscriptions: [] } },
    );
    const sub = push.subscription()!;
    await dropOtherAccountSubscription();
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it('endpoint do próprio usuário → mantém a assinatura', async () => {
    const { push } = setup(
      { permission: 'granted', subscribed: endpoint },
      { tables: { push_subscriptions: [{ id: 's1', owner_id: 'user-1', endpoint }] } },
    );
    const sub = push.subscription()!;
    await dropOtherAccountSubscription();
    expect(sub.unsubscribe).not.toHaveBeenCalled();
  });

  it('sem saber (falha ao consultar) → não mexe em nada', async () => {
    const { push } = setup(
      { permission: 'granted', subscribed: endpoint },
      { errors: { push_subscriptions: { select: { message: 'TypeError: Failed to fetch' } } } },
    );
    const sub = push.subscription()!;
    await expect(dropOtherAccountSubscription()).resolves.toBeUndefined();
    expect(sub.unsubscribe).not.toHaveBeenCalled();
  });

  it('sem assinatura no navegador → nem consulta o banco', async () => {
    const { fake } = setup();
    const from = vi.spyOn(fake, 'from');
    await dropOtherAccountSubscription();
    expect(from).not.toHaveBeenCalled();
  });

  it('banco sem resposta → desiste no tempo limite', async () => {
    const { push, fake } = setup({ permission: 'granted', subscribed: endpoint });
    fake.from = (() => ({
      select: () => ({ eq: () => ({ maybeSingle: () => new Promise(() => {}) }) }),
    })) as unknown as typeof fake.from;
    await expect(dropOtherAccountSubscription(20)).resolves.toBeUndefined();
    expect(push.subscription()!.unsubscribe).not.toHaveBeenCalled();
  });
});

describe('detecção do aparelho para o guia de instalação', () => {
  const MAC_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

  it('iPhone, iPad que se apresenta como Mac e Mac de verdade', () => {
    setup({ userAgent: IPHONE_SAFARI_UA });
    expect(isIOSDevice()).toBe(true);
    expect(devicePlatform()).toBe('iphone');
    push?.restore();
    setup({ userAgent: MAC_UA, maxTouchPoints: 5 });
    expect(isIOSDevice()).toBe(true);
    expect(devicePlatform()).toBe('iphone');
    push?.restore();
    setup({ userAgent: MAC_UA, maxTouchPoints: 0 });
    expect(isIOSDevice()).toBe(false);
    expect(devicePlatform()).toBe('computador');
  });

  it('Android e computador', () => {
    setup({ userAgent: ANDROID_CHROME_UA });
    expect(devicePlatform()).toBe('android');
  });

  it('Safari do iOS: só o Safari, não o Chrome do iPhone', () => {
    setup({ userAgent: IPHONE_SAFARI_UA });
    expect(isIOSSafari()).toBe(true);
    push?.restore();
    setup({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1',
    });
    expect(isIOSSafari()).toBe(false);
    push?.restore();
    setup({ userAgent: ANDROID_CHROME_UA });
    expect(isIOSSafari()).toBe(false);
  });

  it('modo instalado', () => {
    setup({ userAgent: IPHONE_SAFARI_UA });
    expect(isStandalone()).toBe(false);
    push?.restore();
    setup({ userAgent: IPHONE_SAFARI_UA, standalone: true });
    expect(isStandalone()).toBe(true);
  });
});
