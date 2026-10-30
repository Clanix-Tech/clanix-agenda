import { act, waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/render';
import { createFakeSupabase, makeSession } from '@/test/fakeSupabase';
import { useDeleteFavorite, useFavorites, useSaveFavorite } from './api';

const fav = (over: Record<string, unknown>) => ({
  id: 'f1',
  owner_id: 'user-1',
  name: 'Corte',
  duration_minutes: 30,
  color: null,
  is_active: true,
  ...over,
});

describe('favoritos', () => {
  it('lista ativos por nome; includeInactive traz todos', async () => {
    const tables = {
      favorite_services: [
        fav({ id: 'b', name: 'Barba' }),
        fav({ id: 'a', name: 'Alisamento' }),
        fav({ id: 'c', name: 'Zero', is_active: false }),
      ],
    };
    const fake = createFakeSupabase({ session: makeSession(), tables });
    const a = renderHookWithProviders(() => useFavorites(), { supabase: fake });
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    expect(a.result.current.data!.map((f) => f.id)).toEqual(['a', 'b']);
    const b = renderHookWithProviders(() => useFavorites(true), { supabase: fake });
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));
    expect(b.result.current.data!.map((f) => f.id)).toEqual(['a', 'b', 'c']);
  });

  it('salvar novo nao envia owner_id nem id', async () => {
    const fake = createFakeSupabase({ session: makeSession() });
    const { result } = renderHookWithProviders(() => useSaveFavorite(), { supabase: fake });
    await act(async () => {
      await result.current.mutateAsync({
        name: 'Corte',
        duration_minutes: 45,
        color: '#3B82F6',
        is_active: true,
        owner_id: 'hack',
      } as never);
    });
    const row = fake.tables.favorite_services![0]!;
    expect(row.owner_id).toBeUndefined();
    expect(row).toMatchObject({ name: 'Corte', duration_minutes: 45, color: '#3B82F6' });
  });

  it('salvar existente atualiza so as 4 colunas; excluir remove', async () => {
    const fake = createFakeSupabase({
      session: makeSession(),
      tables: { favorite_services: [fav({})] },
    });
    const save = renderHookWithProviders(() => useSaveFavorite(), { supabase: fake });
    await act(async () => {
      await save.result.current.mutateAsync({
        id: 'f1',
        owner_id: 'hack',
        name: 'Novo',
        duration_minutes: 20,
        color: null,
        is_active: false,
      } as never);
    });
    expect(fake.tables.favorite_services![0]).toMatchObject({
      id: 'f1',
      owner_id: 'user-1',
      name: 'Novo',
      is_active: false,
    });
    const del = renderHookWithProviders(() => useDeleteFavorite(), { supabase: fake });
    await act(async () => {
      await del.result.current.mutateAsync({ id: 'f1' });
    });
    expect(fake.tables.favorite_services).toHaveLength(0);
  });
});
