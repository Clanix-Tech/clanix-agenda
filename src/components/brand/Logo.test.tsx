import { render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { resetThemeForTests, setThemePreference } from '@/lib/theme';
import claro from '@/assets/brand/clanix-agenda-horizontal-claro.svg';
import escuro from '@/assets/brand/clanix-agenda-horizontal-escuro.svg';
import icone from '@/assets/brand/clanix-agenda-icone.svg';
import { Logo } from './Logo';

afterEach(() => resetThemeForTests());

function img() {
  return screen.getByRole('img', { name: 'Clanix Agenda' });
}

it('horizontal no tema claro usa o arquivo claro', () => {
  setThemePreference('claro');
  render(<Logo variant="horizontal" size={36} />);
  expect(img()).toHaveAttribute('src', claro);
  expect(img()).toHaveAttribute('height', '36');
});

it('horizontal no tema escuro usa o arquivo escuro', () => {
  setThemePreference('escuro');
  render(<Logo variant="horizontal" size={36} />);
  expect(img()).toHaveAttribute('src', escuro);
});

it('tone sobre-escuro usa o escuro mesmo no tema claro', () => {
  setThemePreference('claro');
  render(<Logo variant="horizontal" tone="sobre-escuro" size={44} />);
  expect(img()).toHaveAttribute('src', escuro);
  expect(img()).toHaveAttribute('height', '44');
});

it('icone usa o ícone, com altura = size', () => {
  render(<Logo variant="icone" size={44} />);
  expect(img()).toHaveAttribute('src', icone);
  expect(img()).toHaveAttribute('height', '44');
});
