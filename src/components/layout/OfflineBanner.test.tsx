import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { OfflineBanner } from './OfflineBanner';

const TEXT = 'Sem conexão. Você pode ver a agenda, mas nada será salvo até a internet voltar.';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

describe('OfflineBanner', () => {
  it('aparece ao ficar offline e some ao voltar', () => {
    renderWithProviders(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => setOnline(false));
    expect(screen.getByRole('status')).toHaveTextContent(TEXT);
    act(() => setOnline(true));
    expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
  });
});
