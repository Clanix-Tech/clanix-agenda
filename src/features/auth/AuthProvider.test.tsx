import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { createFakeSupabase, makeSession, type FakeSupabaseOptions } from '@/test/fakeSupabase';
import { installFakePush, type FakePush } from '@/test/fakePush';
import { useAuth } from './AuthProvider';

const ENDPOINT = 'https://push.example/este-aparelho';

function SignOutButton() {
  const { signOut, user } = useAuth();
  return (
    <div>
      <output data-testid="user">{user?.email ?? 'ninguém'}</output>
      <button onClick={() => void signOut()}>Sair</button>
    </div>
  );
}

let push: FakePush | undefined;

afterEach(() => {
  push?.restore();
  push = undefined;
});

function setup(errors?: FakeSupabaseOptions['errors']) {
  push = installFakePush({ permission: 'granted', subscribed: ENDPOINT });
  const subscription = push.subscription()!;
  /** Linhas de push_subscriptions no instante em que `auth.signOut` foi chamado. */
  const rowsAtSignOut: string[][] = [];
  const fake = createFakeSupabase({
    session: makeSession(),
    errors,
    tables: {
      push_subscriptions: [
        { id: 's1', owner_id: 'user-1', endpoint: ENDPOINT },
        { id: 's2', owner_id: 'user-1', endpoint: 'https://push.example/outro-aparelho' },
      ],
    },
    auth: {
      signOut: () => {
        rowsAtSignOut.push(fake.tables.push_subscriptions!.map((r) => r.id as string));
        return {};
      },
    },
  });
  renderWithProviders(<SignOutButton />, { supabase: fake });
  return { fake, subscription, rowsAtSignOut };
}

describe('AuthProvider.signOut', () => {
  it('apaga a linha deste aparelho antes de encerrar a sessão e cancela a assinatura', async () => {
    const user = userEvent.setup();
    const { fake, subscription, rowsAtSignOut } = setup();
    await user.click(await screen.findByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(fake.calls.signOut).toHaveLength(1));
    expect(rowsAtSignOut).toEqual([['s2']]);
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it('falha de rede ao apagar não impede sair (e a assinatura é cancelada mesmo assim)', async () => {
    const user = userEvent.setup();
    const { fake, subscription } = setup({
      push_subscriptions: { delete: { message: 'TypeError: Failed to fetch' } },
    });
    await user.click(await screen.findByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(fake.calls.signOut).toHaveLength(1));
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it('unsubscribe que nunca responde não trava a saída (tempo limite de 3 s)', async () => {
    const user = userEvent.setup();
    const { fake, subscription } = setup();
    subscription.unsubscribe.mockImplementation(() => new Promise(() => {}));
    await user.click(await screen.findByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(fake.calls.signOut).toHaveLength(1), { timeout: 6000 });
  });

  it('erro ao cancelar a assinatura no navegador não impede sair', async () => {
    const user = userEvent.setup();
    const { fake, subscription } = setup();
    subscription.unsubscribe.mockRejectedValue(new Error('falhou'));
    await user.click(await screen.findByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(fake.calls.signOut).toHaveLength(1));
  });

  it('sem service worker (navegador sem suporte) sai normalmente', async () => {
    const user = userEvent.setup();
    const fake = createFakeSupabase({ session: makeSession() });
    renderWithProviders(<SignOutButton />, { supabase: fake });
    await user.click(await screen.findByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(fake.calls.signOut).toHaveLength(1));
    expect(screen.getByTestId('user')).toHaveTextContent('ninguém');
  });
});

describe('AuthProvider: troca de conta no mesmo navegador', () => {
  /** Nenhuma sessão no início; `signIn` simula outra conta entrando neste navegador. */
  function setupSwitch(rows: Array<Record<string, unknown>>) {
    push = installFakePush({ permission: 'granted', subscribed: ENDPOINT });
    const subscription = push.subscription()!;
    const fake = createFakeSupabase({ session: null, tables: { push_subscriptions: rows } });
    const from = vi.spyOn(fake, 'from');
    renderWithProviders(<SignOutButton />, { supabase: fake });
    const signIn = () =>
      act(async () => {
        await fake.auth.signInWithPassword({ email: 'bruno@example.com', password: 'x' });
      });
    return { subscription, from, signIn };
  }

  it('assinatura deste navegador sem linha visível para quem entrou → cancelada no navegador', async () => {
    const { subscription, signIn } = setupSwitch([]);
    await screen.findByText('ninguém');
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
    await signIn();
    await waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalled());
  });

  it('o endpoint é do usuário que entrou → a assinatura continua', async () => {
    const { subscription, from, signIn } = setupSwitch([
      { id: 's1', owner_id: 'user-1', endpoint: ENDPOINT },
    ]);
    await screen.findByText('ninguém');
    await signIn();
    await waitFor(() => expect(from).toHaveBeenCalledWith('push_subscriptions'));
    await new Promise((r) => setTimeout(r, 20));
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
  });
});
