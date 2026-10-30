import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AppError } from '@/lib/errors';
import { guard, must } from '@/lib/queryHelpers';
import type { Shift } from '@/features/appointments/domain/freeSlots';

export const hoursKey = ['business-hours'] as const;

const hhmm = (t: string) => t.slice(0, 5);

export function useBusinessHours() {
  return useQuery({
    queryKey: hoursKey,
    queryFn: async (): Promise<Shift[]> => {
      const rows = await must(
        supabase
          .from('business_hours')
          .select('*')
          .order('weekday', { ascending: true })
          .order('start_time', { ascending: true }),
      );
      return rows.map((r) => ({
        weekday: r.weekday,
        start_time: hhmm(r.start_time),
        end_time: hhmm(r.end_time),
      }));
    },
  });
}

export function useSetBusinessHours() {
  const qc = useQueryClient();
  return useMutation<null, AppError, Shift[]>({
    mutationFn: (shifts) =>
      guard(async () => {
        const p_shifts = shifts.map((s) => ({
          weekday: s.weekday,
          start_time: s.start_time,
          end_time: s.end_time,
        }));
        const { error } = await supabase.rpc('set_business_hours', { p_shifts });
        if (error) throw error;
        return null;
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: hoursKey }),
  });
}
