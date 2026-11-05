import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { createFakeSupabase } from '@/test/fakeSupabase';
import Login from './Login';

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
  { path: '/entrar', element: <Login /> },
  { path: '/', element: <h1>Início</h1> },
  { path: '/agenda', element: <h1>Agenda</h1> },
  { path: '/cadastro', element: <h1>Cadastro</h1> },
];

const invalid = {
  error: { name: 'AuthApiError', status: 400, code: 'invalid_credentials', message: 'x' },
};

async function fill(email = 'ana@example.com', senha = 'segredo123') {
  await userEvent.type(screen.getByLabelText('E-mail'), email);
  await userEvent.type(screen.getByLabelText('Senha'), senha);
}

describe('Login', () => {
  it('campos têm label associado e atributos de autocompletar', () => {
    renderWithProviders(null, { routes, route: '/entrar' });
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('avisa que a conta foi excluída quando a URL tem ?conta=excluida', () => {
    renderWithProviders(null, { routes, route: '/entrar?conta=excluida' });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sua conta e todos os seus dados foram excluídos.',
    );
  });

  it('tem o link Como instalar o app para o guia público', () => {
    renderWithProviders(null, { routes, route: '/entrar' });
    expect(screen.getByRole('link', { name: 'Como instalar o app' })).toHaveAttribute(
      'href',
      '/instalar',
    );
  });

  it('mostra e oculta a senha', async () => {
    renderWithProviders(null, { routes, route: '/entrar' });
    const senha = screen.getByLabelText('Senha');
    expect(senha).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(senha).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(senha).toHaveAttribute('type', 'password');
  });

  it('credenciais inválidas mostram a mensagem e mantêm o e-mail', async () => {
    const supabase = createFakeSupabase({ auth: { signInWithPassword: () => invalid } });
    renderWithProviders(null, { routes, route: '/entrar', supabase });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@example.com');
  });

  it('limite de tentativas (429)', async () => {
    const supabase = createFakeSupabase({
      auth: {
        signInWithPassword: () => ({ error: { name: 'AuthApiError', status: 429, message: 'x' } }),
      },
    });
    renderWithProviders(null, { routes, route: '/entrar', supabase });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(
      await screen.findByText('Muitas tentativas. Aguarde alguns minutos.'),
    ).toBeInTheDocument();
  });

  it('falha de rede mostra mensagem de conexão', async () => {
    const supabase = createFakeSupabase({
      auth: {
        signInWithPassword: () => ({
          error: { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' },
        }),
      },
    });
    renderWithProviders(null, { routes, route: '/entrar', supabase });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText(/Sem conexão/)).toBeInTheDocument();
  });

  it('duplo clique envia uma única vez', async () => {
    let calls = 0;
    let release: () => void = () => {};
    const supabase = createFakeSupabase({
      auth: {
        signInWithPassword: () => {
          calls++;
          return invalid;
        },
      },
    });
    const original = supabase.auth.signInWithPassword.bind(supabase.auth);
    supabase.auth.signInWithPassword = (args) =>
      new Promise((resolve) => {
        release = () => resolve(original(args));
      }) as ReturnType<typeof original>;
    renderWithProviders(null, { routes, route: '/entrar', supabase });
    await fill();
    await userEvent.dblClick(screen.getByRole('button', { name: 'Entrar' }));
    release();
    await screen.findByText('E-mail ou senha incorretos.');
    expect(calls).toBe(1);
  });

  it('botão fica desabilitado com "Entrando…" enquanto envia', async () => {
    let release: () => void = () => {};
    const supabase = createFakeSupabase();
    const original = supabase.auth.signInWithPassword.bind(supabase.auth);
    supabase.auth.signInWithPassword = (args) =>
      new Promise((resolve) => {
        release = () => resolve(original(args));
      }) as ReturnType<typeof original>;
    renderWithProviders(null, { routes, route: '/entrar', supabase });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('button', { name: 'Entrando…' })).toBeDisabled();
    release();
    expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument();
  });

  it('valida campos vazios sem chamar o servidor', async () => {
    const supabase = createFakeSupabase();
    const spy = vi.spyOn(supabase.auth, 'signInWithPassword');
    renderWithProviders(null, { routes, route: '/entrar', supabase });
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('após entrar vai para `from` (com query)', async () => {
    const { router } = renderWithProviders(null, { routes, route: '/entrar' });
    await router.navigate('/entrar', {
      state: { from: { pathname: '/agenda', search: '?v=semana' } },
    });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/agenda'));
    expect(router.state.location.search).toBe('?v=semana');
  });

  it('`from` externo (//evil.com) é ignorado e vai para /', async () => {
    const { router } = renderWithProviders(null, { routes, route: '/entrar' });
    await router.navigate('/entrar', { state: { from: { pathname: '//evil.com', search: '' } } });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('sem `from` vai para /', async () => {
    const { router } = renderWithProviders(null, { routes, route: '/entrar' });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('usuário já autenticado é levado para /', async () => {
    const { router } = renderWithProviders(null, { routes, route: '/entrar', session: true });
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('mostra o aviso de sessão expirada', async () => {
    const { router } = renderWithProviders(null, { routes, route: '/entrar' });
    await router.navigate('/entrar', { state: { reason: 'sessao' } });
    expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeInTheDocument();
  });

  it('links para recuperar senha e criar conta', () => {
    renderWithProviders(null, { routes, route: '/entrar' });
    expect(screen.getByRole('link', { name: 'Esqueci minha senha' })).toHaveAttribute(
      'href',
      '/recuperar-senha',
    );
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/cadastro');
  });

  it('com CAPTCHA sem token: bloqueia o envio e mostra a dica', async () => {
    const reset = vi.fn();
    captcha.value = { required: true, token: null, error: null, reset, element: null };
    renderWithProviders(null, { routes, route: '/entrar' });
    expect(screen.getByText('Conclua a verificação de segurança acima.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
  });

  it('com CAPTCHA e token: envia options.captchaToken e chama reset após o erro', async () => {
    const reset = vi.fn();
    captcha.value = { required: true, token: 'tok', error: null, reset, element: null };
    const supabase = createFakeSupabase({ auth: { signInWithPassword: () => invalid } });
    const spy = vi.spyOn(supabase.auth, 'signInWithPassword');
    renderWithProviders(null, { routes, route: '/entrar', supabase });
    expect(screen.queryByText('Conclua a verificação de segurança acima.')).not.toBeInTheDocument();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByText('E-mail ou senha incorretos.');
    expect(spy.mock.calls[0]![0]).toMatchObject({ options: { captchaToken: 'tok' } });
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
