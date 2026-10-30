import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AppError } from '@/lib/errors';
import { guard, must } from '@/lib/queryHelpers';
import type { Database } from '@/types/database';

export type FavoriteService = Database['public']['Tables']['favorite_services']['Row'];

export type SaveFavoriteInput = {
  id?: string;
  name: string;
  duration_minutes: number;
  color: string | null;
  is_active: boolean;
};

export const favoritesKey = (includeInactive: boolean) =>
  ['favorites', { includeInactive }] as const;

export function useFavorites(includeInactive = false) {
  return useQuery({
    queryKey: favoritesKey(includeInactive),
    queryFn: () => {
      let q = supabase.from('favorite_services').select('*');
      if (!includeInactive) q = q.eq('is_active', true);
      return must(q.order('name', { ascending: true }));
    },
  });
}

export function useSaveFavorite() {
  const qc = useQueryClient();
  return useMutation<FavoriteService, AppError, SaveFavoriteInput>({
    mutationFn: (input) =>
      guard(async () => {
        // Só as 4 colunas editáveis: o dono vem do banco (default auth.uid()).
        const values = {
          name: input.name,
          duration_minutes: input.duration_minutes,
          color: input.color,
          is_active: input.is_active,
        };
        const table = supabase.from('favorite_services');
        return input.id
          ? must(table.update(values).eq('id', input.id).select().single())
          : must(table.insert(values).select().single());
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });
}

export function useDeleteFavorite() {
  const qc = useQueryClient();
  return useMutation<null, AppError, { id: string }>({
    mutationFn: ({ id }) =>
      guard(async () => {
        const { error } = await supabase.from('favorite_services').delete().eq('id', id);
        if (error) throw error;
        return null;
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });
}
