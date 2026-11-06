import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, resetThemeForTests } from '@/lib/theme';
import { AppearanceSection } from './AppearanceSection';

beforeEach(() => {
  resetThemeForTests();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('AppearanceSection', () => {
  it('mostra o grupo Tema com as três opções e a descrição', () => {
    render(<AppearanceSection />);
    const grupo = screen.getByRole('group', { name: 'Tema' });
    expect(grupo).toBeInTheDocument();
    for (const n of ['Automático', 'Claro', 'Escuro']) {
      expect(screen.getByRole('radio', { name: n })).toBeInTheDocument();
    }
    expect(screen.getByText('Vale só para este aparelho.')).toBeInTheDocument();
  });

  it('começa em Automático', () => {
    render(<AppearanceSection />);
    expect(screen.getByRole('radio', { name: 'Automático' })).toBeChecked();
  });

  it('Escuro liga a classe dark e grava a preferência', async () => {
    render(<AppearanceSection />);
    await userEvent.click(screen.getByRole('radio', { name: 'Escuro' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('escuro');
    expect(screen.getByRole('radio', { name: 'Escuro' })).toBeChecked();
  });

  it('Automático remove a chave', async () => {
    render(<AppearanceSection />);
    await userEvent.click(screen.getByRole('radio', { name: 'Escuro' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Automático' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});
