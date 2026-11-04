import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { toAppError } from '@/lib/errors';
import type { Shift } from '@/features/appointments/domain/freeSlots';
import { hoursKey, useSetBusinessHours } from '../api';
import { DEFAULT_SHIFTS } from '../domain/defaultHours';
import { isValid } from '../domain/validateHours';
import { HoursEditor } from '../components/HoursEditor';

export default function FirstAccessPage() {
  const [shifts, setShifts] = useState<Shift[]>(DEFAULT_SHIFTS);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mutation = useSetBusinessHours();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const empty = shifts.length === 0;
  const valid = isValid(shifts) && !empty;

  const confirm = async () => {
    // A ref bloqueia o segundo clique antes de o React atualizar `isPending`.
    if (busy.current || !valid) return;
    busy.current = true;
    setError(null);
    try {
      await mutation.mutateAsync(shifts);
      // Evita voltar a /primeiro-acesso com a lista vazia ainda em cache.
      qc.setQueryData(hoursKey, shifts);
      void qc.invalidateQueries({ queryKey: hoursKey });
      // Sucesso: continua bloqueado, a página sai de cena.
      void navigate('/', { replace: true });
    } catch (e) {
      setError(toAppError(e).message);
      busy.current = false;
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 bg-[#F8FAFC] px-4 py-8">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-extrabold text-[#0F2D5B]">
          Quando você atende?
        </h1>
        <p className="mt-2 text-[15px] leading-normal text-[#475569]">
          Já deixamos um horário comum preenchido. Ajuste o que for diferente e toque em confirmar.
        </p>
      </header>
      <HoursEditor variant="compact" value={shifts} onChange={setShifts} />
      <p className="text-sm text-[#64748B]">
        O intervalo entre os turnos (12:00–13:00) fica livre para o almoço. Você pode mudar tudo
        depois em Ajustes.
      </p>
      {!valid && !mutation.isPending && (
        <p role="status" className="text-sm text-[#64748B]">
          {empty ? 'Escolha ao menos um dia de atendimento.' : 'Corrija os horários destacados.'}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-[#B91C1C]">
          {error}
        </p>
      )}
      <Button
        type="button"
        onClick={() => void confirm()}
        disabled={mutation.isPending || !valid}
        className="h-[54px] w-full rounded-[14px] bg-[#2563EB] text-base font-bold text-white hover:bg-[#1D4ED8]"
      >
        {mutation.isPending ? 'Salvando…' : 'Confirmar e começar'}
      </Button>
    </main>
  );
}
