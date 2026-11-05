import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import PrivacyPage from './PrivacyPage';

const env = vi.hoisted(() => ({
  name: null as string | null,
  email: null as string | null,
}));
vi.mock('@/lib/env', () => ({
  getEnv: () => ({ privacyControllerName: env.name, privacyContactEmail: env.email }),
}));

const TITLES = [
  'Quem somos',
  'Quais dados guardamos',
  'Para que usamos',
  'Com quem compartilhamos',
  'Por quanto tempo guardamos',
  'Seus direitos',
  'Segurança',
  'Mudanças nesta política',
];

beforeEach(() => {
  env.name = null;
  env.email = null;
});

describe('PrivacyPage', () => {
  it('mostra as seções na ordem, o título e a data', () => {
    renderWithProviders(<PrivacyPage />, { route: '/privacidade' });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Política de Privacidade' }),
    ).toBeVisible();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(TITLES);
    expect(screen.getAllByText(/05\/11\/2026/).length).toBeGreaterThan(0);
  });

  it('com as variáveis definidas, mostra o nome e o e-mail como mailto', () => {
    env.name = 'Ana Silva';
    env.email = 'ana@example.com';
    renderWithProviders(<PrivacyPage />, { route: '/privacidade' });
    expect(screen.getByText(/Ana Silva/)).toBeVisible();
    const links = screen.getAllByRole('link', { name: 'ana@example.com' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute('href', 'mailto:ana@example.com');
    expect(screen.queryByText('Contato do responsável ainda não informado.')).toBeNull();
  });

  it('sem as variáveis, avisa que o contato não foi informado', () => {
    renderWithProviders(<PrivacyPage />, { route: '/privacidade' });
    expect(screen.getByText('Contato do responsável ainda não informado.')).toBeVisible();
    expect(screen.queryByRole('link', { name: /@/ })).toBeNull();
  });
});
