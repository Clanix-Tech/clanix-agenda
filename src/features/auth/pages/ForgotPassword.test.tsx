import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { createFakeSupabase } from '@/test/fakeSupabase';
import ForgotPassword from './ForgotPassword';

const routes = [{ path: '/recuperar-senha', element: <ForgotPassword /> }];
const MSG = 'Se houver uma conta com esse e-mail, você vai receber um link.';

async function send(email: string) {
  await userEvent.type(screen.getByLabelText('E-mail'), email);
  await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }));
}

describe('ForgotPassword', () => {
  it('mostra a mensagem neutra e envia o redirectTo', async () => {
    const supabase = createFakeSupabase();
    const spy = vi.spyOn(supabase.auth, 'resetPasswordForEmail');
    renderWithProviders(null, { routes, route: '/recuperar-senha', supabase });
    await send('qualquer@example.com');
    expect(await screen.findByText(MSG)).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith('qualquer@example.com', {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
  });

  it('mesma mensagem quando o servidor diz que o e-mail não existe', async () => {
    const supabase = createFakeSupabase({
      auth: {
        resetPasswordForEmail: () => ({
          error: { name: 'AuthApiError', status: 400, code: 'user_not_found', message: 'x' },
        }),
      },
    });
    renderWithProviders(null, { routes, route: '/recuperar-senha', supabase });
    await send('x@example.com');
    expect(await screen.findByText(MSG)).toBeInTheDocument();
  });

  it('falha de rede não finge sucesso', async () => {
    const supabase = createFakeSupabase({
      auth: {
        resetPasswordForEmail: () => ({
          error: { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' },
        }),
      },
    });
    renderWithProviders(null, { routes, route: '/recuperar-senha', supabase });
    await send('x@example.com');
    expect(await screen.findByText(/Sem conexão/)).toBeInTheDocument();
    expect(screen.queryByText(MSG)).not.toBeInTheDocument();
  });

  it.each([
    ['500 do servidor', { name: 'AuthApiError', status: 500, message: 'x' }],
    ['503 do servidor', { name: 'AuthApiError', status: 503, code: 'unexpected_failure' }],
    ['erro desconhecido sem status', { name: 'AuthUnknownError', message: 'x' }],
  ])('%s não finge sucesso (não revela se a conta existe)', async (_caso, error) => {
    const supabase = createFakeSupabase({
      auth: { resetPasswordForEmail: () => ({ error }) },
    });
    renderWithProviders(null, { routes, route: '/recuperar-senha', supabase });
    await send('x@example.com');
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo deu errado. Tente novamente.');
    expect(screen.queryByText(MSG)).not.toBeInTheDocument();
  });

  it('e-mail inválido não chama o servidor', async () => {
    const supabase = createFakeSupabase();
    const spy = vi.spyOn(supabase.auth, 'resetPasswordForEmail');
    renderWithProviders(null, { routes, route: '/recuperar-senha', supabase });
    await send('abc');
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });
});
