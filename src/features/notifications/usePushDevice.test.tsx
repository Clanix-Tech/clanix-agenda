import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { renderWithProviders } from '@/test/render';
import { createFakeSupabase, makeSession, type FakeSupabaseOptions } from '@/test/fakeSupabase';
import {
  TEST_VAPID_KEY,
  installFakePush,
  type FakePush,
  type FakePushOptions,
} from '@/test/fakePush';
import { usePushDevice } from './usePushDevice';

const env = vi.hoisted(() => ({ vapid: null as string | null }));
vi.mock('@/lib/env', () => ({
  getEnv: () => ({
    supabaseUrl: 'http://supabase.test',
    supabasePublishableKey: 'chave',
    vapidPublicKey: env.vapid,
  }),
}));
vi.mock('sonner', async (importOriginal) => {
  const mod = await importOriginal<typeof import('sonner')>();
  return { ...mod, toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) };
});

let push: FakePush | undefined;
/** `true` só enquanto o manipulador de clique roda (pedido de permissão precisa acontecer aqui). */
let inClick = false;

function Harness() {
  const device = usePushDevice();
  const click = (action: () => void) => () => {
    inClick = true;
    action();
    inClick = false;
  };
  return (
    <div>
      <output data-testid="state">{device.state ?? 'verificando'}</output>
      <output data-testid="busy">{String(device.busy)}</output>
      <output data-testid="configured">{String(device.configured)}</output>
      {device.error && <p role="alert">{device.error}</p>}
      <button onClick={click(device.activate)}>Ativar</button>
      <button onClick={click(device.deactivate)}>Desativar</button>
      <button onClick={click(device.sendTest)}>Teste</button>
    </div>
  );
}

function setup(
  pushOptions: FakePushOptions = {},
  supabase: FakeSupabaseOptions = {},
  vapid: string | null = TEST_VAPID_KEY,
) {
  env.vapid = vapid;
  push = installFakePush(pushOptions);
  push.requestPermission.mockImplementation(async () => {
    calledInClick.push(inClick);
    push!.state.permission = pushOptions.answer ?? 'granted';
    return push!.state.permission;
  });
  const fake = createFakeSupabase({ session: makeSession(), ...supabase });
  const view = renderWithProviders(<Harness />, { supabase: fake });
  return { ...view, push, fake };
}

let calledInClick: boolean[] = [];

afterEach(() => {
  push?.restore();
  push = undefined;
  calledInClick = [];
  vi.mocked(toast.success).mockClear();
});

const state = () => screen.getByTestId('state');

describe('usePushDevice', () => {
  it('aparelho ativado com chave VAPID antiga é reinscrito ao montar', async () => {
    const { push, fake } = setup(
      {
        permission: 'granted',
        subscribed: 'https://push.example/velho',
        applicationServerKey:
          'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
      },
      {
        tables: {
          push_subscriptions: [
            { id: 'x', owner_id: 'user-1', endpoint: 'https://push.example/velho' },
          ],
        },
      },
    );
    const old = push.subscription()!;
    await waitFor(() => expect(old.unsubscribe).toHaveBeenCalled());
    await waitFor(() =>
      expect(fake.calls.rpc.map((c) => c.name)).toEqual(['register_push_subscription']),
    );
    expect(push.subscription()!.endpoint).not.toBe('https://push.example/velho');
  });

  it('mostra o estado real do aparelho (desativado) sem pedir permissão', async () => {
    const { push } = setup();
    await waitFor(() => expect(state()).toHaveTextContent('desativado'));
    expect(push.requestPermission).not.toHaveBeenCalled();
  });

  it('1ª visita: service worker registrado depois da 1ª leitura → relê e sai de "sem suporte"', async () => {
    const { push } = setup({ sw: 'later' });
    await waitFor(() => expect(state()).toHaveTextContent('sem-suporte'));
    act(() => push.registerServiceWorker());
    await waitFor(() => expect(state()).toHaveTextContent(/^desativado$/));
  });

  it('activate pede a permissão só dentro do clique e chega a ativado depois da RPC', async () => {
    const user = userEvent.setup();
    const { fake } = setup();
    await waitFor(() => expect(state()).toHaveTextContent('desativado'));
    await user.click(screen.getByRole('button', { name: 'Ativar' }));
    await waitFor(() => expect(state()).toHaveTextContent('ativado'));
    expect(calledInClick).toEqual([true]);
    expect(fake.calls.rpc.map((c) => c.name)).toEqual(['register_push_subscription']);
    expect(screen.getByTestId('busy')).toHaveTextContent('false');
  });

  it('permissão negada → bloqueado e nenhuma RPC', async () => {
    const user = userEvent.setup();
    const { fake, push } = setup({ answer: 'denied' });
    await waitFor(() => expect(state()).toHaveTextContent('desativado'));
    await user.click(screen.getByRole('button', { name: 'Ativar' }));
    await waitFor(() => expect(state()).toHaveTextContent('bloqueado'));
    expect(push.subscribe).not.toHaveBeenCalled();
    expect(fake.calls.rpc).toHaveLength(0);
  });

  it('RPC falha por rede → continua desativado e mostra "Sem conexão. Nada foi salvo…" (RN17)', async () => {
    const user = userEvent.setup();
    setup(
      {},
      {
        rpc: {
          register_push_subscription: () => ({ error: { message: 'TypeError: Failed to fetch' } }),
        },
      },
    );
    await waitFor(() => expect(state()).toHaveTextContent('desativado'));
    await user.click(screen.getByRole('button', { name: 'Ativar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sem conexão. Nada foi salvo — tente novamente.',
    );
    await waitFor(() => expect(screen.getByTestId('busy')).toHaveTextContent('false'));
    expect(state()).toHaveTextContent(/^desativado$/);
  });

  it('dois cliques rápidos → uma assinatura e uma RPC', async () => {
    const { fake, push } = setup();
    await waitFor(() => expect(state()).toHaveTextContent('desativado'));
    const button = screen.getByRole('button', { name: 'Ativar' });
    act(() => {
      button.click();
      button.click();
    });
    await waitFor(() => expect(state()).toHaveTextContent('ativado'));
    expect(push.requestPermission).toHaveBeenCalledTimes(1);
    expect(push.subscribe).toHaveBeenCalledTimes(1);
    expect(fake.calls.rpc).toHaveLength(1);
  });

  it('deactivate apaga a linha deste aparelho e volta a desativado', async () => {
    const user = userEvent.setup();
    const endpoint = 'https://push.example/meu';
    const { fake } = setup(
      { permission: 'granted', subscribed: endpoint },
      { tables: { push_subscriptions: [{ id: 's1', owner_id: 'user-1', endpoint }] } },
    );
    await waitFor(() => expect(state()).toHaveTextContent('ativado'));
    await user.click(screen.getByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(state()).toHaveTextContent('desativado'));
    expect(fake.tables.push_subscriptions).toHaveLength(0);
  });

  it('sendTest chama a função e avisa que enviou', async () => {
    const user = userEvent.setup();
    const endpoint = 'https://push.example/meu';
    const { fake } = setup(
      { permission: 'granted', subscribed: endpoint },
      {
        tables: { push_subscriptions: [{ id: 's1', owner_id: 'user-1', endpoint }] },
        functions: { 'send-test-notification': () => ({ data: { sent: 1, removed: 0 } }) },
      },
    );
    await waitFor(() => expect(state()).toHaveTextContent('ativado'));
    await user.click(screen.getByRole('button', { name: 'Teste' }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Notificação de teste enviada.'),
    );
    expect(fake.calls.functions).toHaveLength(1);
  });

  it('sendTest sem nenhum aparelho alcançado mostra o erro', async () => {
    const user = userEvent.setup();
    const endpoint = 'https://push.example/meu';
    setup(
      { permission: 'granted', subscribed: endpoint },
      {
        tables: { push_subscriptions: [{ id: 's1', owner_id: 'user-1', endpoint }] },
        functions: { 'send-test-notification': () => ({ data: { sent: 0, removed: 0 } }) },
      },
    );
    await waitFor(() => expect(state()).toHaveTextContent('ativado'));
    await user.click(screen.getByRole('button', { name: 'Teste' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A notificação de teste não chegou a nenhum aparelho.',
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('sendTest com sessão expirada encerra a sessão neste aparelho', async () => {
    const user = userEvent.setup();
    const endpoint = 'https://push.example/meu';
    const { fake } = setup(
      { permission: 'granted', subscribed: endpoint },
      {
        tables: { push_subscriptions: [{ id: 's1', owner_id: 'user-1', endpoint }] },
        functions: {
          'send-test-notification': () => ({
            error: { name: 'FunctionsHttpError', context: new Response('{}', { status: 401 }) },
          }),
        },
      },
    );
    await waitFor(() => expect(state()).toHaveTextContent('ativado'));
    await user.click(screen.getByRole('button', { name: 'Teste' }));
    await waitFor(() => expect(fake.calls.signOut).toEqual([{ scope: 'local' }]));
  });

  it('com a chave VAPID: configured = true', async () => {
    setup();
    expect(screen.getByTestId('configured')).toHaveTextContent('true');
  });

  it('sem a chave VAPID: configured = false e activate não pede permissão', async () => {
    const user = userEvent.setup();
    const { push, fake } = setup({}, {}, null);
    expect(screen.getByTestId('configured')).toHaveTextContent('false');
    await waitFor(() => expect(state()).toHaveTextContent('desativado'));
    await user.click(screen.getByRole('button', { name: 'Ativar' }));
    expect(push.requestPermission).not.toHaveBeenCalled();
    expect(fake.calls.rpc).toHaveLength(0);
  });
});
