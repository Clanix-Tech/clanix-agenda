import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { createFakeSupabase } from '@/test/fakeSupabase';
import Signup from './Signup';

const captcha = vi.hoisted(() => ({
  value: { required: false, token: null, error: null, reset: () => {}, element: null } as {
    required: boolean;
    token: string | null;
    error: string | null;
    reset: () => void;
    element: unknown;
  },
}));
vi.mock('../captcha/useCaptcha', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../captcha/useCaptcha')>()),
  useCaptcha: () => captcha.value,
}));

beforeEach(() => {
  captcha.value = { required: false, token: null, error: null, reset: () => {}, element: null };
});

const routes = [
  { path: '/cadastro', element: <Signup /> },
  { path: '/', element: <h1>Início</h1> },
];

async function fill(over: Partial<Record<string, string>> = {}) {
  const v = {
    nome: '  Camila Souza  ',
    email: 'camila@example.com',
    senha: 'segredo123',
    conf: 'segredo123',
    ...over,
  };
  await userEvent.type(screen.getByLabelText('Nome'), v.nome);
  await userEvent.type(screen.getByLabelText('E-mail'), v.email);
  await userEvent.type(screen.getByLabelText('Senha'), v.senha);
  await userEvent.type(screen.getByLabelText('Confirmar senha'), v.conf);
}

const authError = (code: string, status = 422) => ({
  error: { name: 'AuthApiError', status, code, message: 'x' },
});

describe('Signup', () => {
  it('envia display_name aparado e pede confirmação quando não há sessão', async () => {
    const supabase = createFakeSupabase();
    const spy = vi.spyOn(supabase.auth, 'signUp');
    renderWithProviders(null, { routes, route: '/cadastro', supabase });
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'new-password');
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(
      await screen.findByText('Enviamos um link de confirmação para camila@example.com.'),
    ).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toMatchObject({
      email: 'camila@example.com',
      password: 'segredo123',
      options: { data: { display_name: 'Camila Souza' } },
    });
  });

  it('com sessão imediata vai para /', async () => {
    const supabase = createFakeSupabase({
      auth: { signUp: () => ({ data: { session: { access_token: 't' }, user: { id: 'u' } } }) },
    });
    const { router } = renderWithProviders(null, { routes, route: '/cadastro', supabase });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('valida nome, senha curta e confirmação diferente sem chamar o servidor', async () => {
    const supabase = createFakeSupabase();
    const spy = vi.spyOn(supabase.auth, 'signUp');
    renderWithProviders(null, { routes, route: '/cadastro', supabase });
    await fill({ nome: '   ', senha: 'curta', conf: 'outra' });
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByText('Informe seu nome (até 80 caracteres).')).toBeInTheDocument();
    expect(screen.getByText('A senha precisa ter pelo menos 8 caracteres.')).toBeInTheDocument();
    expect(screen.getByText('As senhas não são iguais.')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('e-mail já usado', async () => {
    const supabase = createFakeSupabase({
      auth: { signUp: () => authError('user_already_exists') },
    });
    renderWithProviders(null, { routes, route: '/cadastro', supabase });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByText('Já existe uma conta com esse e-mail.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveValue('camila@example.com');
  });

  it('senha fraca segundo o servidor', async () => {
    const supabase = createFakeSupabase({ auth: { signUp: () => authError('weak_password') } });
    renderWithProviders(null, { routes, route: '/cadastro', supabase });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(
      await screen.findByText('A senha precisa ter pelo menos 8 caracteres.'),
    ).toBeInTheDocument();
  });

  it('duplo clique envia uma vez', async () => {
    const supabase = createFakeSupabase();
    const spy = vi.spyOn(supabase.auth, 'signUp');
    renderWithProviders(null, { routes, route: '/cadastro', supabase });
    await fill();
    await userEvent.dblClick(screen.getByRole('button', { name: 'Criar conta' }));
    await screen.findByText(/Enviamos um link/);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('com CAPTCHA e token: envia captchaToken e reinicia o widget', async () => {
    const reset = vi.fn();
    captcha.value = { required: true, token: 'tok', error: null, reset, element: null };
    const supabase = createFakeSupabase();
    const spy = vi.spyOn(supabase.auth, 'signUp');
    renderWithProviders(null, { routes, route: '/cadastro', supabase });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    await screen.findByText(/Enviamos um link de confirmação/);
    expect(spy.mock.calls[0]![0]).toMatchObject({
      options: { captchaToken: 'tok', data: { display_name: 'Camila Souza' } },
    });
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('com CAPTCHA sem token: bloqueia o envio e mostra a dica', () => {
    captcha.value = { required: true, token: null, error: null, reset: () => {}, element: null };
    renderWithProviders(null, { routes, route: '/cadastro' });
    expect(screen.getByText('Conclua a verificação de segurança acima.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeDisabled();
  });
});
