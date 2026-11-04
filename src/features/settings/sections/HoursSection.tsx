import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import type { Shift } from '@/features/appointments/domain/freeSlots';
import { useBusinessHours, useSetBusinessHours } from '@/features/business-hours/api';
import { HoursEditor } from '@/features/business-hours/components/HoursEditor';
import { isValid } from '@/features/business-hours/domain/validateHours';
import { SaveButton, SectionCard } from './shared';

const INVALID_SHIFTS = 'Revise os turnos: há horários inválidos ou sobrepostos.';

const key = (shifts: Shift[]) =>
  JSON.stringify(
    shifts
      .map((s) => [s.weekday, s.start_time, s.end_time] as const)
      .sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2])),
  );

export function HoursSection({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const hours = useBusinessHours();
  if (hours.isPending) return <LoadingState label="Carregando expediente…" />;
  if (hours.isError) {
    return (
      <ErrorState
        message="Não foi possível carregar o expediente."
        onRetry={() => void hours.refetch()}
      />
    );
  }
  return <HoursForm initial={hours.data} onDirtyChange={onDirtyChange} />;
}

function HoursForm({
  initial,
  onDirtyChange,
}: {
  initial: Shift[];
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [base, setBase] = useState(initial);
  const [shifts, setShifts] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mutation = useSetBusinessHours();

  const dirty = key(shifts) !== key(base);
  const empty = shifts.length === 0;
  const valid = isValid(shifts) && !empty;

  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  const save = async () => {
    if (busy.current || !valid) return;
    busy.current = true;
    setError(null);
    try {
      await mutation.mutateAsync(shifts);
      setBase(shifts);
      toast.success('Alterações salvas');
    } catch (err) {
      const kind = (err as { kind?: string }).kind;
      setError(
        kind === 'dados_invalidos'
          ? INVALID_SHIFTS
          : ((err as { message?: string }).message ?? 'Algo deu errado. Tente novamente.'),
      );
    } finally {
      busy.current = false;
    }
  };

  return (
    <SectionCard title="Expediente" description="Os dias e turnos em que você atende.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="flex flex-col gap-4"
      >
        <HoursEditor variant="full" value={shifts} onChange={setShifts} />
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
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 px-5"
            disabled={!dirty || mutation.isPending}
            onClick={() => {
              setShifts(base);
              setError(null);
            }}
          >
            Descartar
          </Button>
          <SaveButton
            pending={mutation.isPending}
            label="Salvar expediente"
            disabled={!dirty || !valid}
          />
        </div>
      </form>
    </SectionCard>
  );
}
