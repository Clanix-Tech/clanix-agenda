import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PushTarget, SendResult } from '../_shared/webpush.ts';
import {
  TEST_PAYLOAD,
  handleSendTestNotification,
  type SendTestDeps,
  type UserDevices,
} from './handler.ts';

function target(id: string): PushTarget {
  return { id, endpoint: `https://push.example/${id}`, p256dh: `p-${id}`, auth: `a-${id}` };
}

/** Aparelhos de cada usuário, como o cliente do usuário (sob RLS) os veria. */
const byToken: Record<string, PushTarget[]> = {
  'token-camila': [target('cel-camila'), target('note-camila')],
  'token-bruno': [target('cel-bruno')],
};

function makeDeps(overrides: Partial<SendTestDeps> = {}) {
  const removed: string[][] = [];
  const userDevices: SendTestDeps['userDevices'] = async (authorization) => {
    const token = authorization.replace(/^Bearer /, '');
    const targets = byToken[token];
    if (!targets) return null;
    const devices: UserDevices = {
      list: async () => targets,
      remove: async (ids) => {
        removed.push(ids);
      },
    };
    return devices;
  };
  const deps = {
    userDevices: vi.fn<SendTestDeps['userDevices']>(overrides.userDevices ?? userDevices),
    send: vi.fn<SendTestDeps['send']>(overrides.send ?? (async () => ({ ok: true }))),
  };
  return { deps, removed };
}

function request(token?: string, method = 'POST'): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token !== undefined) headers.set('Authorization', `Bearer ${token}`);
  return new Request('http://localhost/functions/v1/send-test-notification', {
    method,
    headers,
    body: method === 'POST' ? '{}' : undefined,
  });
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('send-test-notification', () => {
  it('sem Authorization → 401 sem enviar nada', async () => {
    const { deps } = makeDeps();
    const res = await handleSendTestNotification(request(), deps);
    expect(res.status).toBe(401);
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('token que não é de um usuário (ex.: chave anônima) → 401', async () => {
    const { deps } = makeDeps();
    const res = await handleSendTestNotification(request('chave-anonima'), deps);
    expect(res.status).toBe(401);
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('envia o texto de teste só para os aparelhos do próprio usuário', async () => {
    const { deps } = makeDeps();
    const res = await handleSendTestNotification(request('token-camila'), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 2, removed: 0 });
    expect(deps.userDevices).toHaveBeenCalledWith('Bearer token-camila');
    expect(deps.send.mock.calls.map(([t]) => t.id)).toEqual(['cel-camila', 'note-camila']);
    for (const [, payload] of deps.send.mock.calls) {
      expect(payload).toEqual({
        title: 'Agenda em Ordem',
        body: 'Notificações ativadas neste aparelho.',
        url: '/ajustes/notificacoes',
        tag: 'teste',
      });
    }
    expect(TEST_PAYLOAD.tag).toBe('teste');
  });

  it('aparelho que respondeu 410 é removido; falha temporária não remove', async () => {
    const results: Record<string, SendResult> = {
      'cel-camila': { ok: false, gone: true },
      'note-camila': { ok: false, gone: false },
    };
    const { deps, removed } = makeDeps({ send: vi.fn(async (t) => results[t.id]!) });
    const res = await handleSendTestNotification(request('token-camila'), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0, removed: 1 });
    expect(removed).toEqual([['cel-camila']]);
  });

  it('exceção no envio conta como falha temporária', async () => {
    const { deps } = makeDeps({
      send: vi.fn(async () => {
        throw new Error('rede');
      }),
    });
    const res = await handleSendTestNotification(request('token-bruno'), deps);
    expect(await res.json()).toEqual({ sent: 0, removed: 0 });
  });

  it('falha ao remover não muda a resposta (o envio já aconteceu)', async () => {
    const { deps } = makeDeps({
      send: vi.fn(async () => ({ ok: false, gone: true }) as const),
      userDevices: vi.fn(async () => ({
        list: async () => [target('x')],
        remove: async () => {
          throw new Error('push_subscriptions: 42501');
        },
      })),
    });
    const res = await handleSendTestNotification(request('token-bruno'), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0, removed: 0 });
  });

  it('falha ao listar os aparelhos → 500 sem detalhes', async () => {
    const { deps } = makeDeps({
      userDevices: vi.fn(async () => ({
        list: async () => {
          throw new Error('push_subscriptions: XX000');
        },
        remove: async () => {},
      })),
    });
    const res = await handleSendTestNotification(request('token-bruno'), deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'falha_interna' });
  });

  it('OPTIONS (preflight do navegador) responde com CORS', async () => {
    const { deps } = makeDeps();
    const res = await handleSendTestNotification(request(undefined, 'OPTIONS'), deps);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('authorization');
    expect(deps.userDevices).not.toHaveBeenCalled();
  });

  it('respostas levam o cabeçalho CORS (o app chama de outra origem)', async () => {
    const { deps } = makeDeps();
    const ok = await handleSendTestNotification(request('token-bruno'), deps);
    const denied = await handleSendTestNotification(request(), deps);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('método diferente de POST → 405', async () => {
    const { deps } = makeDeps();
    const res = await handleSendTestNotification(request('token-bruno', 'GET'), deps);
    expect(res.status).toBe(405);
  });
});
