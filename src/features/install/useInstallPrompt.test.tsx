import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startInstallPromptCapture } from './installPromptStore';
import { useInstallPrompt } from './useInstallPrompt';

function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = vi.fn(async () => {});
  event.userChoice = Promise.resolve({ outcome });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe('useInstallPrompt', () => {
  // A loja é global: limpa o que o teste anterior deixou.
  afterEach(() => {
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
  });

  it('evento que chegou antes de a tela montar continua valendo', () => {
    startInstallPromptCapture();
    fireBeforeInstallPrompt('accepted');
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canPrompt).toBe(true);
  });

  it('sem o evento do navegador (Safari/Firefox) não pode pedir instalação', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canPrompt).toBe(false);
  });

  it('com beforeinstallprompt guarda o evento e prompt() abre o diálogo do navegador', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = fireBeforeInstallPrompt('accepted');
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.canPrompt).toBe(true);
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.prompt();
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(outcome).toBe('accepted');
    // O evento só vale uma vez.
    expect(result.current.canPrompt).toBe(false);
  });

  it('recusar devolve dismissed', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    fireBeforeInstallPrompt('dismissed');
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.prompt();
    });
    expect(outcome).toBe('dismissed');
  });

  it('depois de instalado (appinstalled) o botão some', () => {
    const { result } = renderHook(() => useInstallPrompt());
    fireBeforeInstallPrompt('accepted');
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(result.current.canPrompt).toBe(false);
  });
});
