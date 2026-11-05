import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import {
  ANDROID_CHROME_UA,
  IPHONE_SAFARI_UA,
  installFakePush,
  type FakePush,
  type FakePushOptions,
} from '@/test/fakePush';
import { IosInstallBanner, HIDE_INSTALL_BANNER_KEY } from './IosInstallBanner';

const IPHONE_CHROME_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1';

let fake: FakePush | undefined;
function setup(options: FakePushOptions) {
  fake = installFakePush(options);
  return renderWithProviders(<IosInstallBanner />, { session: true });
}
beforeEach(() => localStorage.clear());
afterEach(() => {
  fake?.restore();
  fake = undefined;
});

const TEXT = 'Instale o app para receber lembretes';

describe('IosInstallBanner', () => {
  it('aparece no Safari do iPhone fora do app instalado, com link "Ver como"', () => {
    setup({ userAgent: IPHONE_SAFARI_UA });
    expect(screen.getByText(TEXT)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver como' })).toHaveAttribute('href', '/instalar');
  });

  it('não aparece no Android', () => {
    setup({ userAgent: ANDROID_CHROME_UA });
    expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
  });

  it('não aparece no app instalado', () => {
    setup({ userAgent: IPHONE_SAFARI_UA, standalone: true });
    expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
  });

  it('não aparece no Chrome do iPhone', () => {
    setup({ userAgent: IPHONE_CHROME_UA });
    expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
  });

  it('fechar grava só a flag de interface e não volta depois de remontar', async () => {
    const first = setup({ userAgent: IPHONE_SAFARI_UA });
    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
    expect(HIDE_INSTALL_BANNER_KEY).toBe('aeo:ocultar-banner-instalar');
    expect(localStorage.getItem(HIDE_INSTALL_BANNER_KEY)).toBe('1');
    expect(localStorage.length).toBe(1);
    first.unmount();
    renderWithProviders(<IosInstallBanner />, { session: true });
    expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
  });

  it('com localStorage indisponível (modo privado) ainda aparece e fecha sem quebrar', async () => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = () => {
      throw new Error('bloqueado');
    };
    Storage.prototype.setItem = () => {
      throw new Error('bloqueado');
    };
    try {
      setup({ userAgent: IPHONE_SAFARI_UA });
      await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
      expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
    } finally {
      Storage.prototype.getItem = getItem;
      Storage.prototype.setItem = setItem;
    }
  });
});
