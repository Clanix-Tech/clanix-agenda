import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { OfflineBanner } from './OfflineBanner';

const TEXT = 'Sem conexão. Você pode ver a agenda, mas nada será salvo até a internet voltar.';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

describe('OfflineBanner', () => {
  it('aparece ao ficar offline e some ao voltar, numa região viva sempre montada', () => {
    renderWithProviders(<OfflineBanner />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
    act(() => setOnline(false));
    // A mesma região (não uma nova) recebe o texto: assim o leitor de tela anuncia.
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent(TEXT);
    act(() => setOnline(true));
    expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
  });

  it('ocupa espaço no fluxo (sticky) em vez de cobrir o topo da página', () => {
    renderWithProviders(<OfflineBanner />);
    expect(screen.getByRole('status')).toHaveClass('sticky', 'top-0');
    expect(screen.getByRole('status')).not.toHaveClass('fixed');
  });
});
