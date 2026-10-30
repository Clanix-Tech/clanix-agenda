import { render, screen } from '@testing-library/react';
import { Logo } from './Logo';

it('Logo tem nome acessível', () => {
  render(<Logo variant="full" />);
  expect(screen.getByRole('img', { name: 'Agenda em Ordem' })).toBeInTheDocument();
});
