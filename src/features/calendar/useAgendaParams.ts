import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useProfile } from '@/features/profile/api';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import { localToInstant, todayInTz } from '@/lib/time';
import { statusMeta, type AppointmentStatus } from '@/features/appointments/domain/status';

export type AgendaView = 'dia' | 'semana' | 'mes' | 'lista';
const VIEWS: AgendaView[] = ['dia', 'semana', 'mes', 'lista'];
const STATUSES = Object.keys(statusMeta) as AppointmentStatus[];

export type AgendaParamsPatch = {
  view?: AgendaView;
  date?: string;
  status?: AppointmentStatus[] | null;
};

function validDate(value: string | null): value is string {
  if (!value) return false;
  try {
    localToInstant(value, '00:00', 'UTC');
    return true;
  } catch {
    return false;
  }
}

/** Estado da agenda na URL: `?visao=dia&data=2026-10-29&status=agendado,concluido`. */
export function useAgendaParams() {
  const [sp, setSp] = useSearchParams();
  const { data: profile } = useProfile();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const tz = profile?.timezone ?? 'America/Sao_Paulo';
  const today = todayInTz(tz);

  const rawView = sp.get('visao');
  const rawDate = sp.get('data');
  const rawStatus = sp.get('status');

  const view = useMemo<AgendaView>(() => {
    if (rawView && (VIEWS as string[]).includes(rawView)) return rawView as AgendaView;
    const def = profile?.default_view as AgendaView | undefined;
    if (!def || !VIEWS.includes(def)) return 'dia';
    if (!desktop && (def === 'semana' || def === 'mes')) return 'dia';
    return def;
  }, [rawView, profile?.default_view, desktop]);

  const date = validDate(rawDate) ? rawDate : today;

  const status = useMemo<AppointmentStatus[] | null>(() => {
    if (!rawStatus) return null;
    const list = rawStatus
      .split(',')
      .filter((s): s is AppointmentStatus => (STATUSES as string[]).includes(s));
    return list.length ? list : null;
  }, [rawStatus]);

  const set = useCallback(
    (partial: AgendaParamsPatch) => {
      setSp((prev) => {
        const next = new URLSearchParams(prev);
        if (partial.view !== undefined) next.set('visao', partial.view);
        if (partial.date !== undefined) next.set('data', partial.date);
        if (partial.status !== undefined) {
          if (partial.status === null || partial.status.length === 0) next.delete('status');
          else next.set('status', partial.status.join(','));
        }
        return next;
      });
    },
    [setSp],
  );

  return { view, date, status, set, tz, today };
}
