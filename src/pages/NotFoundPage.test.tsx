import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import NotFoundPage from './NotFoundPage';

describe('NotFoundPage', () => {
  it('mostra o título e os links de saída', () => {
    renderWithProviders(<NotFoundPage />, { route: '/nada' });
    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para o início' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Abrir agenda' })).toHaveAttribute('href', '/agenda');
  });
});
