import { render, screen } from '@testing-library/react';
import { Logo } from './Logo';

it('Logo tem nome acessível', () => {
  render(<Logo variant="full" />);
  expect(screen.getByRole('img', { name: 'Agenda em Ordem' })).toBeInTheDocument();
});

it('Logo icon-dark tem nome acessível', () => {
  render(<Logo variant="icon-dark" />);
  expect(screen.getByRole('img', { name: 'Agenda em Ordem' })).toBeInTheDocument();
});
