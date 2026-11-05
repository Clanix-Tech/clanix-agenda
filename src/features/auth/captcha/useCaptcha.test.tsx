import { useEffect } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TurnstileApi, TurnstileRenderOptions } from './turnstile';
import { useCaptcha } from './useCaptcha';

const env = vi.hoisted(() => ({ key: null as string | null }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ turnstileSiteKey: env.key }) }));

const loader = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('./turnstile', () => ({ loadTurnstile: () => loader.load() }));

const ERRO =
  'Não foi possível carregar a verificação de segurança. Confira sua conexão e tente de novo.';

function fakeApi() {
  const opts: TurnstileRenderOptions[] = [];
  const api = {
    render: vi.fn((_c: HTMLElement, o: TurnstileRenderOptions) => {
      opts.push(o);
      return `w${opts.length}`;
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  } satisfies TurnstileApi;
  return { api, opts };
}

const seen = { snapshot: null as ReturnType<typeof useCaptcha> | null };
const last = () => seen.snapshot!;
function Probe() {
  const captcha = useCaptcha('login');
  useEffect(() => {
    seen.snapshot = captcha;
  });
  return <div data-testid="host">{captcha.element}</div>;
}

function ConditionalProbe({ show }: { show: boolean }) {
  const captcha = useCaptcha('login');
  useEffect(() => {
    seen.snapshot = captcha;
  });
  return <div data-testid="host">{show ? captcha.element : null}</div>;
}

beforeEach(() => {
  env.key = null;
  loader.load.mockReset();
});

describe('useCaptcha', () => {
  it('sem chave: não é exigido e não renderiza nada', () => {
    render(<Probe />);
    expect(last()).toMatchObject({
      required: false,
      token: null,
      error: null,
      element: null,
    });
    expect(loader.load).not.toHaveBeenCalled();
  });

  it('com chave: renderiza o widget com action e pt-br; callback guarda o token e reset limpa', async () => {
    env.key = 'site-key';
    const { api, opts } = fakeApi();
    loader.load.mockResolvedValue(api);
    render(<Probe />);
    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    expect(opts[0]).toMatchObject({ sitekey: 'site-key', action: 'login', language: 'pt-br' });
    expect(last().required).toBe(true);

    act(() => opts[0]!.callback!('tok'));
    expect(last().token).toBe('tok');
    act(() => opts[0]!['expired-callback']!());
    expect(last().token).toBeNull();

    act(() => opts[0]!.callback!('tok2'));
    act(() => last().reset());
    expect(api.reset).toHaveBeenCalledWith('w1');
    expect(last().token).toBeNull();
  });

  it('error-callback mostra o erro', async () => {
    env.key = 'site-key';
    const { api, opts } = fakeApi();
    loader.load.mockResolvedValue(api);
    render(<Probe />);
    await vi.waitFor(() => expect(api.render).toHaveBeenCalled());
    act(() => opts[0]!['error-callback']!());
    expect(await screen.findByText(ERRO)).toBeInTheDocument();
  });

  it('falha ao carregar: mostra erro e "Tentar de novo" recarrega e funciona', async () => {
    env.key = 'site-key';
    const { api, opts } = fakeApi();
    loader.load.mockRejectedValueOnce(new Error('rede')).mockResolvedValue(api);
    render(<Probe />);
    expect(await screen.findByText(ERRO)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    expect(loader.load).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(ERRO)).not.toBeInTheDocument();
    act(() => opts[0]!.callback!('ok'));
    expect(last().token).toBe('ok');
  });

  it('ao desmontar remove o widget', async () => {
    env.key = 'site-key';
    const { api } = fakeApi();
    loader.load.mockResolvedValue(api);
    const { unmount } = render(<Probe />);
    await vi.waitFor(() => expect(api.render).toHaveBeenCalled());
    unmount();
    expect(api.remove).toHaveBeenCalledWith('w1');
  });

  it('o contêiner aparece depois (renderização condicional): renderiza ao aparecer', async () => {
    env.key = 'site-key';
    const { api, opts } = fakeApi();
    loader.load.mockResolvedValue(api);
    const { rerender } = render(<ConditionalProbe show={false} />);
    // O script carrega com o contêiner ausente.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(api.render).not.toHaveBeenCalled();

    rerender(<ConditionalProbe show />);
    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    act(() => opts[0]!.callback!('tok'));
    expect(last().token).toBe('tok');
  });

  it('o contêiner some: remove o widget e descarta o token; ao voltar, renderiza de novo', async () => {
    env.key = 'site-key';
    const { api, opts } = fakeApi();
    loader.load.mockResolvedValue(api);
    const { rerender } = render(<ConditionalProbe show />);
    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    act(() => opts[0]!.callback!('tok'));
    expect(last().token).toBe('tok');

    rerender(<ConditionalProbe show={false} />);
    expect(api.remove).toHaveBeenCalledWith('w1');
    expect(last().token).toBeNull();

    rerender(<ConditionalProbe show />);
    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(2));
  });
});
