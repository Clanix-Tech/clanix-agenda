import { useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Profile } from '@/features/profile/api';
import { ChoiceGroup, FIELD, SectionCard } from './shared';
import { useAutoSaveProfile } from './useAutoSaveProfile';

const DURATION_ERROR = 'Informe de 5 a 480 minutos.';

export function AgendaPrefsSection({ profile }: { profile: Profile }) {
  const { save, value, status } = useAutoSaveProfile(profile);
  const [duration, setDuration] = useState(String(profile.default_duration_minutes));
  const [error, setError] = useState<string | null>(null);

  const commitDuration = (e?: FormEvent) => {
    e?.preventDefault();
    const n = Number(duration);
    if (duration.trim() === '' || !Number.isInteger(n) || n < 5 || n > 480) {
      setError(DURATION_ERROR);
      return;
    }
    setError(null);
    if (n !== value('default_duration_minutes')) save({ default_duration_minutes: n });
  };

  return (
    <SectionCard title="Agenda" description="Cada escolha é salva na hora.">
      <div className="flex max-w-xl flex-col gap-5">
        <form onSubmit={commitDuration} noValidate className="flex flex-col gap-1.5">
          <Label htmlFor="agenda-duracao">Duração padrão (minutos)</Label>
          <Input
            id="agenda-duracao"
            type="number"
            inputMode="numeric"
            min={5}
            max={480}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            onBlur={() => commitDuration()}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'agenda-duracao-erro' : undefined}
            className={`${FIELD} max-w-40`}
          />
          {error && (
            <p id="agenda-duracao-erro" role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
        </form>
        <ChoiceGroup
          legend="Intervalo da grade de horários"
          name="grade"
          value={value('slot_interval_minutes')}
          options={[
            { value: 15, label: '15 min' },
            { value: 30, label: '30 min' },
            { value: 60, label: '60 min' },
          ]}
          onChange={(v) => save({ slot_interval_minutes: v })}
        />
        <ChoiceGroup
          legend="Primeiro dia da semana"
          name="semana"
          value={value('week_starts_on')}
          options={[
            { value: 0, label: 'Domingo' },
            { value: 1, label: 'Segunda' },
          ]}
          onChange={(v) => save({ week_starts_on: v })}
        />
        <ChoiceGroup
          legend="Visão inicial da agenda"
          name="visao"
          value={value('default_view')}
          options={[
            { value: 'dia', label: 'Dia' },
            { value: 'semana', label: 'Semana' },
            { value: 'mes', label: 'Mês' },
            { value: 'lista', label: 'Lista' },
          ]}
          onChange={(v) => save({ default_view: v })}
        />
        {status}
      </div>
    </SectionCard>
  );
}
