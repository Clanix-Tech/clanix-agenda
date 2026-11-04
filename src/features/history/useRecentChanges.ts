import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { must } from '@/lib/queryHelpers';
import { apptKeys } from '@/features/appointments/keys';
import type { HistoryEntry } from '@/features/appointments/api';

export type RecentChange = {
  id: string;
  appointmentId: string;
  action: 'remarcado' | 'cancelado';
  at: string;
  clientName: string;
};

/** Últimas 10 remarcações/cancelamentos, com o nome do cliente (segunda consulta por ids). */
export function useRecentChanges() {
  return useQuery({
    queryKey: [...apptKeys.all, 'recent-changes'] as const,
    queryFn: async (): Promise<RecentChange[]> => {
      const entries = await must<HistoryEntry[]>(
        supabase
          .from('appointment_history')
          .select('*')
          .in('action', ['remarcado', 'cancelado'])
          .order('created_at', { ascending: false })
          .limit(10),
      );
      if (entries.length === 0) return [];
      const ids = [...new Set(entries.map((e) => e.appointment_id))];
      const appts = await must<Array<{ id: string; client_name: string }>>(
        supabase.from('appointments').select('id, client_name').in('id', ids),
      );
      const names = new Map(appts.map((a) => [a.id, a.client_name]));
      return entries.map((e) => ({
        id: e.id,
        appointmentId: e.appointment_id,
        action: e.action as 'remarcado' | 'cancelado',
        at: e.created_at,
        clientName: names.get(e.appointment_id) ?? 'Cliente',
      }));
    },
  });
}
