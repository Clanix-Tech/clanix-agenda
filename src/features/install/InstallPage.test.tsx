import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import {
  ANDROID_CHROME_UA,
  IPHONE_SAFARI_UA,
  installFakePush,
  type FakePush,
  type FakePushOptions,
} from '@/test/fakePush';
import InstallPage from './InstallPage';

const env = vi.hoisted(() => ({ apk: null as string | null }));
vi.mock('@/lib/env', () => ({
  getEnv: () => ({
    supabaseUrl: 'http://supabase.test',
    supabasePublishableKey: 'chave',
    vapidPublicKey: null,
    apkDownloadUrl: env.apk,
  }),
}));

const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

let fake: FakePush | undefined;
function setup(options: FakePushOptions, apk: string | null = null, session = false) {
  env.apk = apk;
  fake = installFakePush(options);
  return renderWithProviders(<InstallPage />, { route: '/instalar', session });
}
afterEach(() => {
  fake?.restore();
  fake = undefined;
});

const tab = (name: string) => screen.getByRole('tab', { name });

describe('InstallPage', () => {
  it('sem login mostra as três seções e abre em iPhone com user agent de iPhone', () => {
    setup({ userAgent: IPHONE_SAFARI_UA });
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'iPhone',
      'Android',
      'Computador',
    ]);
    expect(tab('iPhone')).toHaveAttribute('aria-selected', 'true');
    const steps = screen.getAllByRole('listitem');
    expect(steps[0]).toHaveTextContent('No Safari, toque em Compartilhar na barra inferior.');
    expect(steps[1]).toHaveTextContent('Escolha Adicionar à Tela de Início.');
    expect(steps[2]).toHaveTextContent(
      'Abra o Agenda em Ordem pelo ícone e volte aqui para ativar.',
    );
    expect(screen.getByText(/entrar de novo/)).toBeInTheDocument();
  });

  it('abre em Android no Android', () => {
    setup({ userAgent: ANDROID_CHROME_UA });
    expect(tab('Android')).toHaveAttribute('aria-selected', 'true');
  });

  it('abre em Computador no computador', () => {
    setup({ userAgent: WINDOWS_UA });
    expect(tab('Computador')).toHaveAttribute('aria-selected', 'true');
  });

  it('as outras seções abrem ao tocar na aba', async () => {
    setup({ userAgent: IPHONE_SAFARI_UA });
    await userEvent.click(tab('Computador'));
    expect(screen.getByText(/ícone de instalar na barra de endereço/)).toBeInTheDocument();
    expect(screen.getByText(/Adicionar ao Dock/)).toBeInTheDocument();
  });

  it('Android sem APK configurado: nenhum "Baixar o APK" e passos do menu', () => {
    setup({ userAgent: ANDROID_CHROME_UA }, null);
    expect(screen.queryByText(/APK/)).not.toBeInTheDocument();
    expect(screen.getByText(/Instalar app/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Instalar app' })).not.toBeInTheDocument();
  });

  it('Android com APK configurado: link para a URL e instruções de apps desconhecidos', () => {
    setup({ userAgent: ANDROID_CHROME_UA }, 'https://exemplo.test/agenda.apk');
    expect(screen.getByRole('link', { name: /Baixar o APK/ })).toHaveAttribute(
      'href',
      'https://exemplo.test/agenda.apk',
    );
    expect(screen.getByText(/apps desconhecidos/)).toBeInTheDocument();
  });

  it('com beforeinstallprompt o botão "Instalar app" chama prompt()', async () => {
    setup({ userAgent: ANDROID_CHROME_UA });
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: ReturnType<typeof vi.fn>;
      userChoice: Promise<{ outcome: string }>;
    };
    event.prompt = vi.fn(async () => {});
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    act(() => {
      window.dispatchEvent(event);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Instalar app' }));
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it('o link de volta vai para a entrada sem login', () => {
    setup({ userAgent: ANDROID_CHROME_UA });
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/entrar');
  });

  it('com login o link de volta leva ao início', async () => {
    setup({ userAgent: ANDROID_CHROME_UA }, null, true);
    expect(await screen.findByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/');
  });
});
