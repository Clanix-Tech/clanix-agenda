import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { toast } from 'sonner';
import { renderWithProviders } from '@/test/render';
import { createFakeSupabase, makeSession, type Row } from '@/test/fakeSupabase';
import { FavoritesSection } from './FavoritesSection';

vi.mock('sonner', async (importOriginal) => {
  const mod = await importOriginal<typeof import('sonner')>();
  return { ...mod, toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) };
});

const fav = (id: string, name: string, extra: Row = {}): Row => ({
  id,
  owner_id: 'user-1',
  name,
  duration_minutes: 30,
  color: null,
  is_active: true,
  ...extra,
});

function setup(
  rows: Row[] = [
    fav('f1', 'Corte', { color: '#2563EB' }),
    fav('f2', 'Barba', { is_active: false }),
  ],
  errors?: Record<string, Partial<Record<'insert' | 'update' | 'delete', unknown>>>,
) {
  const fake = createFakeSupabase({
    session: makeSession(),
    tables: { favorite_services: rows },
    errors,
  });
  const view = renderWithProviders(<FavoritesSection />, { supabase: fake, session: true });
  return { ...view, fake };
}

beforeEach(() => vi.mocked(toast.success).mockClear());

describe('FavoritesSection', () => {
  it('lista ativos e inativos, com a cor também em texto', async () => {
    setup();
    const active = await screen.findByRole('list', { name: 'Serviços ativos' });
    expect(within(active).getByText('Corte')).toBeInTheDocument();
    expect(within(active).getByText('30 min')).toBeInTheDocument();
    expect(within(active).getByText('Azul')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Inativos' })).toBeInTheDocument();
    const inactive = screen.getByRole('list', { name: 'Serviços inativos' });
    expect(within(inactive).getByText('Barba')).toBeInTheDocument();
  });

  it('adiciona um serviço com cor', async () => {
    const user = userEvent.setup();
    const { fake } = setup([]);
    await user.click(await screen.findByRole('button', { name: 'Adicionar serviço' }));
    await user.type(screen.getByLabelText('Nome do serviço'), 'Hidratação');
    const dur = screen.getByLabelText('Duração (minutos)');
    await user.clear(dur);
    await user.type(dur, '45');
    await user.click(screen.getByRole('radio', { name: 'Verde' }));
    await user.click(screen.getByRole('button', { name: 'Salvar serviço' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Alterações salvas'));
    expect(fake.tables.favorite_services![0]).toMatchObject({
      name: 'Hidratação',
      duration_minutes: 45,
      color: '#16A34A',
      is_active: true,
    });
  });

  it('nome duplicado mostra a mensagem e mantém o formulário', async () => {
    const user = userEvent.setup();
    setup(undefined, { favorite_services: { insert: { code: '23505' } } });
    await user.click(await screen.findByRole('button', { name: 'Adicionar serviço' }));
    await user.type(screen.getByLabelText('Nome do serviço'), 'Corte');
    await user.click(screen.getByRole('button', { name: 'Salvar serviço' }));
    expect(await screen.findByText('Você já tem um serviço com esse nome.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome do serviço')).toHaveValue('Corte');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('valida o nome', async () => {
    const user = userEvent.setup();
    const { fake } = setup([]);
    await user.click(await screen.findByRole('button', { name: 'Adicionar serviço' }));
    await user.click(screen.getByRole('button', { name: 'Salvar serviço' }));
    expect(await screen.findByText('Informe o nome do serviço.')).toBeInTheDocument();
    expect(fake.tables.favorite_services).toHaveLength(0);
  });

  it('edita e desativa um serviço', async () => {
    const user = userEvent.setup();
    const { fake } = setup();
    await user.click(await screen.findByRole('button', { name: 'Editar Corte' }));
    await user.click(screen.getByRole('switch', { name: 'Serviço ativo' }));
    await user.click(screen.getByRole('button', { name: 'Salvar serviço' }));
    await waitFor(() => expect(fake.tables.favorite_services![0]!.is_active).toBe(false));
  });

  it('remover pede confirmação', async () => {
    const user = userEvent.setup();
    const { fake } = setup();
    await user.click(await screen.findByRole('button', { name: 'Remover Corte' }));
    expect(await screen.findByText('Remover serviço?')).toBeInTheDocument();
    expect(fake.tables.favorite_services).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Remover' }));
    await waitFor(() => expect(fake.tables.favorite_services).toHaveLength(1));
  });
});
