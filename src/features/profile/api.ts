import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toAppError, type AppError } from '@/lib/errors';
import { guard, must } from '@/lib/queryHelpers';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Database } from '@/types/database';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export const profileKey = (userId: string | undefined) => ['profile', userId] as const;

const EDITABLE = [
  'display_name',
  'business_name',
  'timezone',
  'default_duration_minutes',
  'slot_interval_minutes',
  'week_starts_on',
  'default_view',
  'reminder_minutes',
  'hide_client_name_in_notifications',
] as const;

export type ProfilePatch = Partial<Pick<Profile, (typeof EDITABLE)[number]>>;

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: profileKey(user?.id),
    enabled: !!user,
    queryFn: () => must<Profile>(supabase.from('profiles').select('*').eq('id', user!.id).single()),
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<Profile, AppError, ProfilePatch>({
    mutationFn: (patch) =>
      guard(async () => {
        if (!user) throw toAppError({ code: '42501' });
        // Só as colunas permitidas: nunca `id`, `created_at` nem `updated_at`.
        const values: ProfilePatch = {};
        for (const k of EDITABLE) if (k in patch) Object.assign(values, { [k]: patch[k] });
        return must(supabase.from('profiles').update(values).eq('id', user.id).select().single());
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}
