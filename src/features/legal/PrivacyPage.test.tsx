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

  it('não promete demais: registros dos provedores, IP, prazo aproximado e o que o CSV traz', () => {
    renderWithProviders(<PrivacyPage />, { route: '/privacidade' });
    const dados = screen.getByRole('region', { name: 'Quais dados guardamos' });
    expect(dados).toHaveTextContent(/Registros técnicos de acesso/);
    expect(dados).toHaveTextContent(/endereço IP/);

    const retencao = screen.getByRole('region', { name: 'Por quanto tempo guardamos' });
    expect(retencao).toHaveTextContent(/tira seus dados do app na hora/);
    expect(retencao).toHaveTextContent(/em cerca de 30 dias/);
    expect(retencao).toHaveTextContent(/Supabase e o Cloudflare guardam os registros técnicos/);
    expect(retencao).not.toHaveTextContent(/não contêm dados pessoais/);
    expect(retencao).not.toHaveTextContent(/em até 30 dias/);
    expect(retencao).not.toHaveTextContent(/imediata e definitiva/);

    const direitos = screen.getByRole('region', { name: 'Seus direitos' });
    expect(direitos).toHaveTextContent(/seus atendimentos, com os dados dos clientes/);
  });

  it('sem as variáveis, avisa que o contato não foi informado', () => {
    renderWithProviders(<PrivacyPage />, { route: '/privacidade' });
    expect(screen.getByText('Contato do responsável ainda não informado.')).toBeVisible();
    expect(screen.queryByRole('link', { name: /@/ })).toBeNull();
  });
});
