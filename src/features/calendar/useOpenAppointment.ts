import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { APPOINTMENT_PARAM } from '@/features/appointments/openParam';

/** Abre o painel de detalhes (`?atendimento=<id>`) mantendo os demais parâmetros. */
export function useOpenAppointment() {
  const [, setSp] = useSearchParams();
  return useCallback(
    (id: string) =>
      setSp((prev) => {
        const next = new URLSearchParams(prev);
        next.set(APPOINTMENT_PARAM, id);
        return next;
      }),
    [setSp],
  );
}
