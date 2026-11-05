import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { PushTarget, SendResult } from '../_shared/webpush.ts';
import { withDeadline } from '../_shared/deadline.ts';
import { handleSendReminders, type Due, type SendRemindersDeps } from './handler.ts';

const SECRET = 'segredo-do-cron-com-mais-de-32-caracteres';
const NOW = new Date('2026-11-10T16:30:00Z');

const dueA: Due = {
  appointment_id: 'ap-a',
  owner_id: 'dono-1',
  starts_at: '2026-11-10T17:00:00+00:00',
  title: 'Lembrete de atendimento',
  body: '14:00 · Juliana Rocha — Escova e hidratação · em 30 min',
  url: '/?atendimento=ap-a',
};
const dueB: Due = {
  appointment_id: 'ap-b',
  owner_id: 'dono-2',
  starts_at: '2026-11-10T17:15:00+00:00',
  title: 'Lembrete de atendimento',
  body: 'Atendimento às 14:15 · em 45 min',
  url: '/?atendimento=ap-b',
};

function target(id: string): PushTarget {
  return { id, endpoint: `https://push.example/${id}`, p256dh: `p-${id}`, auth: `a-${id}` };
}

const devices: Record<string, PushTarget[]> = {
  'dono-1': [target('cel-1'), target('note-1')],
  'dono-2': [target('cel-2'), target('note-2')],
};

function makeDeps(overrides: Partial<SendRemindersDeps> = {}) {
  const deps = {
    cronSecret: SECRET,
    now: () => NOW,
    due: vi.fn<SendRemindersDeps['due']>(async () => [dueA]),
    claim: vi.fn<SendRemindersDeps['claim']>(async () => true),
    release: vi.fn<SendRemindersDeps['release']>(async () => {}),
    targets: vi.fn<SendRemindersDeps['targets']>(async (ownerId) => devices[ownerId] ?? []),
    send: vi.fn<SendRemindersDeps['send']>(async () => ({ ok: true })),
    removeTargets: vi.fn<SendRemindersDeps['removeTargets']>(async () => {}),
    touchTargets: vi.fn<SendRemindersDeps['touchTargets']>(async () => {}),
    ...overrides,
  };
  return deps;
}

function request(secret?: string): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (secret !== undefined) headers.set('x-cron-secret', secret);
  return new Request('http://localhost/functions/v1/send-reminders', {
    method: 'POST',
    headers,
    body: '{}',
  });
}

const ok = (): SendResult => ({ ok: true });
const gone = (): SendResult => ({ ok: false, gone: true });
const temporary = (): SendResult => ({ ok: false, gone: false });

let logs: MockInstance[];

beforeEach(() => {
  logs = [
    vi.spyOn(console, 'log').mockImplementation(() => {}),
    vi.spyOn(console, 'info').mockImplementation(() => {}),
    vi.spyOn(console, 'warn').mockImplementation(() => {}),
    vi.spyOn(console, 'error').mockImplementation(() => {}),
  ];
});

afterEach(() => {
  vi.restoreAllMocks();
});

function loggedText(): string {
  return logs
    .flatMap((spy) => spy.mock.calls.flat())
    .map(String)
    .join('\n');
}

describe('handleSendReminders', () => {
  it('secret errado → 401 e nenhuma chamada a due', async () => {
    const deps = makeDeps();

    const wrong = await handleSendReminders(
      request('outro-segredo-qualquer-com-32-caracteres'),
      deps,
    );
    const missing = await handleSendReminders(request(), deps);
    const prefix = await handleSendReminders(request(SECRET.slice(0, -1)), deps);

    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(prefix.status).toBe(401);
    expect(deps.due).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('segredo configurado vazio nunca autoriza', async () => {
    const deps = makeDeps({ cronSecret: '' });

    const res = await handleSendReminders(request(''), deps);

    expect(res.status).toBe(401);
    expect(deps.due).not.toHaveBeenCalled();
  });

  it('dois devidos, dois aparelhos → 4 envios, payload { title, body, url, tag }', async () => {
    const send = vi.fn<SendRemindersDeps['send']>(async () => ok());
    const deps = makeDeps({ due: vi.fn(async () => [dueA, dueB]), send });

    const res = await handleSendReminders(request(SECRET), deps);

    expect(res.status).toBe(200);
    expect(deps.due).toHaveBeenCalledWith(NOW);
    expect(deps.claim).toHaveBeenCalledWith('ap-a', dueA.starts_at);
    expect(deps.claim).toHaveBeenCalledWith('ap-b', dueB.starts_at);
    expect(deps.send).toHaveBeenCalledTimes(4);
    const payloadA = { title: dueA.title, body: dueA.body, url: dueA.url, tag: 'lembrete-ap-a' };
    const payloadB = { title: dueB.title, body: dueB.body, url: dueB.url, tag: 'lembrete-ap-b' };
    expect(deps.send).toHaveBeenCalledWith(target('cel-1'), payloadA);
    expect(deps.send).toHaveBeenCalledWith(target('note-1'), payloadA);
    expect(deps.send).toHaveBeenCalledWith(target('cel-2'), payloadB);
    expect(deps.send).toHaveBeenCalledWith(target('note-2'), payloadB);
    for (const [, payload] of send.mock.calls) {
      expect(Object.keys(payload).sort()).toEqual(['body', 'tag', 'title', 'url']);
    }
    expect(deps.touchTargets).toHaveBeenCalledWith(['cel-1', 'note-1']);
    expect(deps.touchTargets).toHaveBeenCalledWith(['cel-2', 'note-2']);
    expect(deps.removeTargets).not.toHaveBeenCalled();
    expect(deps.release).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ due: 2, sent: 4, removed: 0, failed: 0 });
  });

  it('claim false → não envia', async () => {
    const deps = makeDeps({ claim: vi.fn(async () => false) });

    const res = await handleSendReminders(request(SECRET), deps);

    expect(res.status).toBe(200);
    expect(deps.targets).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.release).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ due: 1, sent: 0, removed: 0, failed: 0 });
  });

  it('duas execuções sobrepostas: só quem reserva envia (no máximo um push por aparelho)', async () => {
    const reserved = new Set<string>();
    const claim = vi.fn(async (id: string, startsAt: string) => {
      const key = `${id}|${startsAt}`;
      if (reserved.has(key)) return false;
      reserved.add(key);
      return true;
    });
    const send = vi.fn(async (): Promise<SendResult> => ok());
    const first = makeDeps({ claim, send });
    const second = makeDeps({ claim, send });

    await Promise.all([
      handleSendReminders(request(SECRET), first),
      handleSendReminders(request(SECRET), second),
    ]);

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('aparelho 410 → removeTargets([id]) e o outro aparelho recebe', async () => {
    const send = vi.fn(async (t: PushTarget) => (t.id === 'cel-1' ? gone() : ok()));
    const deps = makeDeps({ send });

    const res = await handleSendReminders(request(SECRET), deps);

    expect(send).toHaveBeenCalledTimes(2);
    expect(deps.removeTargets).toHaveBeenCalledWith(['cel-1']);
    expect(deps.touchTargets).toHaveBeenCalledWith(['note-1']);
    expect(deps.release).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ due: 1, sent: 1, removed: 1, failed: 0 });
  });

  it('todos os aparelhos expirados → remove, sem release (não há para quem tentar de novo)', async () => {
    const deps = makeDeps({ send: vi.fn(async () => gone()) });

    const res = await handleSendReminders(request(SECRET), deps);

    expect(deps.removeTargets).toHaveBeenCalledWith(['cel-1', 'note-1']);
    expect(deps.touchTargets).not.toHaveBeenCalled();
    expect(deps.release).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ due: 1, sent: 0, removed: 2, failed: 0 });
  });

  it('todos falham com erro temporário → release chamado', async () => {
    const deps = makeDeps({ send: vi.fn(async () => temporary()) });

    const res = await handleSendReminders(request(SECRET), deps);

    expect(deps.release).toHaveBeenCalledWith('ap-a', dueA.starts_at);
    expect(deps.removeTargets).not.toHaveBeenCalled();
    expect(deps.touchTargets).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ due: 1, sent: 0, removed: 0, failed: 2 });
  });

  it('um recebe e outro falha temporário → release não chamado', async () => {
    const send = vi.fn(async (t: PushTarget) => (t.id === 'cel-1' ? temporary() : ok()));
    const deps = makeDeps({ send });

    const res = await handleSendReminders(request(SECRET), deps);

    expect(deps.release).not.toHaveBeenCalled();
    expect(deps.touchTargets).toHaveBeenCalledWith(['note-1']);
    expect(await res.json()).toEqual({ due: 1, sent: 1, removed: 0, failed: 1 });
  });

  it('um expirado e outro com falha temporária → remove o expirado e libera a reserva', async () => {
    const send = vi.fn(async (t: PushTarget) => (t.id === 'cel-1' ? gone() : temporary()));
    const deps = makeDeps({ send });

    const res = await handleSendReminders(request(SECRET), deps);

    expect(deps.removeTargets).toHaveBeenCalledWith(['cel-1']);
    expect(deps.release).toHaveBeenCalledWith('ap-a', dueA.starts_at);
    expect(await res.json()).toEqual({ due: 1, sent: 0, removed: 1, failed: 1 });
  });

  it('envio que lança exceção conta como falha temporária', async () => {
    const send = vi.fn(async (): Promise<SendResult> => {
      throw new Error('rede caiu');
    });
    const deps = makeDeps({ send });

    const res = await handleSendReminders(request(SECRET), deps);

    expect(deps.release).toHaveBeenCalledWith('ap-a', dueA.starts_at);
    expect(await res.json()).toEqual({ due: 1, sent: 0, removed: 0, failed: 2 });
  });

  it('envio que nunca responde estoura o prazo, vira falha temporária e libera a reserva', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const neverEnds = () => withDeadline<SendResult>(new Promise(() => {}), 9_000, temporary());
      const deps = makeDeps({ send: vi.fn(neverEnds) });

      const pending = handleSendReminders(request(SECRET), deps);
      // O prazo só começa quando o handler chega ao envio: avança até ele existir.
      await vi.waitFor(() => expect(deps.send).toHaveBeenCalled());
      await vi.advanceTimersByTimeAsync(9_000);
      const res = await pending;

      expect(deps.release).toHaveBeenCalledWith('ap-a', dueA.starts_at);
      expect(await res.json()).toEqual({ due: 1, sent: 0, removed: 0, failed: 2 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('withDeadline: resposta antes do prazo vale', async () => {
    await expect(withDeadline(Promise.resolve(ok()), 50, temporary())).resolves.toEqual(ok());
  });

  it('erro ao processar um lembrete → libera a reserva dele e segue para o próximo', async () => {
    const targets = vi.fn(async (ownerId: string) => {
      if (ownerId === 'dono-1') throw new Error('banco indisponível');
      return devices[ownerId] ?? [];
    });
    const deps = makeDeps({ due: vi.fn(async () => [dueA, dueB]), targets });

    const res = await handleSendReminders(request(SECRET), deps);

    expect(res.status).toBe(200);
    expect(deps.release).toHaveBeenCalledWith('ap-a', dueA.starts_at);
    expect(deps.send).toHaveBeenCalledTimes(2);
    expect(await res.json()).toEqual({ due: 2, sent: 2, removed: 0, failed: 1 });
  });

  it('erro ao reservar um lembrete → não envia nem libera e segue para o próximo', async () => {
    const claim = vi.fn(async (id: string) => {
      if (id === 'ap-a') throw new Error('banco indisponível');
      return true;
    });
    const deps = makeDeps({ due: vi.fn(async () => [dueA, dueB]), claim });

    const res = await handleSendReminders(request(SECRET), deps);

    expect(res.status).toBe(200);
    expect(deps.targets).not.toHaveBeenCalledWith('dono-1');
    expect(deps.release).not.toHaveBeenCalled();
    expect(deps.send).toHaveBeenCalledTimes(2);
    expect(await res.json()).toEqual({ due: 2, sent: 2, removed: 0, failed: 1 });
  });

  it('falha ao atualizar/remover aparelhos depois de entregar → não libera (não duplica)', async () => {
    const send = vi.fn(async (t: PushTarget) => (t.id === 'cel-1' ? gone() : ok()));
    const deps = makeDeps({
      send,
      removeTargets: vi.fn(async () => {
        throw new Error('banco indisponível');
      }),
      touchTargets: vi.fn(async () => {
        throw new Error('banco indisponível');
      }),
    });

    const res = await handleSendReminders(request(SECRET), deps);

    expect(res.status).toBe(200);
    expect(deps.release).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ due: 1, sent: 1, removed: 1, failed: 0 });
  });

  it('falha ao buscar devidos → 500 sem detalhes', async () => {
    const deps = makeDeps({
      due: vi.fn(async (): Promise<Due[]> => {
        throw new Error('relation "x" does not exist');
      }),
    });

    const res = await handleSendReminders(request(SECRET), deps);

    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('relation');
  });

  it('resposta 200 só com contagens e sem nomes de clientes no corpo nem nos logs', async () => {
    const send = vi.fn(async (t: PushTarget) => (t.id === 'cel-1' ? temporary() : ok()));
    const deps = makeDeps({ due: vi.fn(async () => [dueA, dueB]), send });

    const res = await handleSendReminders(request(SECRET), deps);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    const text = await res.text();
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['due', 'failed', 'removed', 'sent']);
    for (const value of Object.values(body)) expect(typeof value).toBe('number');
    for (const secretText of ['Juliana', 'Escova', '14:00', 'push.example', 'p-cel']) {
      expect(text).not.toContain(secretText);
      expect(loggedText()).not.toContain(secretText);
    }
  });
});
