import { useState } from 'react';
import type { ComponentProps } from 'react';
import { Switch } from '@/components/ui/switch';
import type { Shift } from '@/features/appointments/domain/freeSlots';
import { MAX_SHIFTS, MAX_TIME, validateShifts } from '../domain/validateHours';

type Props = {
  value: Shift[];
  onChange: (shifts: Shift[]) => void;
  variant: 'compact' | 'full';
};

// Segunda a domingo (0 = domingo).
const DAYS = [
  { weekday: 1, short: 'Seg', long: 'Segunda' },
  { weekday: 2, short: 'Ter', long: 'Terça' },
  { weekday: 3, short: 'Qua', long: 'Quarta' },
  { weekday: 4, short: 'Qui', long: 'Quinta' },
  { weekday: 5, short: 'Sex', long: 'Sexta' },
  { weekday: 6, short: 'Sáb', long: 'Sábado' },
  { weekday: 0, short: 'Dom', long: 'Domingo' },
];

const addHour = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const next = (h ?? 0) + 1;
  return next > 23
    ? MAX_TIME
    : `${String(next).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
};

function summary(shifts: Shift[]) {
  return [...shifts]
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((s) => `${s.start_time}–${s.end_time}`)
    .join(' · ');
}

const TIME_CLASS = 'h-11 rounded-lg border border-input bg-card px-3 text-base text-foreground';

/**
 * Switch dentro de uma caixa própria de 44x44 px (label): o toque na caixa aciona o switch e a
 * área nunca invade controles vizinhos, porque faz parte do fluxo do layout.
 */
function DaySwitch(props: ComponentProps<typeof Switch>) {
  return (
    <label className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
      <Switch {...props} />
    </label>
  );
}

export function HoursEditor({ value, onChange, variant }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const { byIndex, global } = validateShifts(value);
  const atMax = value.length >= MAX_SHIFTS;

  const withIndex = value.map((s, index) => ({ s, index }));

  const toggleDay = (weekday: number, on: boolean) => {
    const others = value.filter((s) => s.weekday !== weekday);
    if (!on) return onChange(others);
    if (atMax) return;
    onChange([...others, { weekday, start_time: '09:00', end_time: '18:00' }]);
  };

  const patch = (index: number, change: Partial<Shift>) =>
    onChange(value.map((s, i) => (i === index ? { ...s, ...change } : s)));

  const addShift = (weekday: number) => {
    if (atMax) return;
    const last = value
      .filter((s) => s.weekday === weekday)
      .map((s) => s.end_time)
      .sort()
      .at(-1);
    const start = last && last < MAX_TIME ? last : '18:00';
    onChange([...value, { weekday, start_time: start, end_time: addHour(start) }]);
  };

  const dayControls = (day: (typeof DAYS)[number]) => {
    const rows = withIndex.filter(({ s }) => s.weekday === day.weekday);
    return (
      <div className="flex flex-col gap-2">
        {rows.map(({ s, index }, n) => {
          const error = byIndex.get(index);
          return (
            <div key={index} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  step={300}
                  max={MAX_TIME}
                  aria-label={`Início do turno ${n + 1} de ${day.long}`}
                  aria-invalid={error ? true : undefined}
                  value={s.start_time}
                  onChange={(e) => patch(index, { start_time: e.target.value })}
                  className={TIME_CLASS}
                />
                <span aria-hidden="true" className="text-muted-foreground">
                  –
                </span>
                <input
                  type="time"
                  step={300}
                  max={MAX_TIME}
                  aria-label={`Fim do turno ${n + 1} de ${day.long}`}
                  aria-invalid={error ? true : undefined}
                  value={s.end_time}
                  onChange={(e) => patch(index, { end_time: e.target.value })}
                  className={TIME_CLASS}
                />
                <button
                  type="button"
                  aria-label={`Remover turno ${n + 1} de ${day.long}`}
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  className="inline-flex size-11 items-center justify-center rounded-lg text-xl text-muted-foreground hover:bg-accent"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              {error && (
                <p role="alert" className="text-sm text-error">
                  {error}
                </p>
              )}
            </div>
          );
        })}
        {rows.length > 0 && (
          <button
            type="button"
            disabled={atMax}
            aria-label={`+ Turno em ${day.long}`}
            onClick={() => addShift(day.weekday)}
            className="inline-flex h-11 w-fit items-center rounded-lg px-3 text-sm font-semibold text-link hover:bg-secondary disabled:opacity-50"
          >
            + Turno
          </button>
        )}
      </div>
    );
  };

  const globalMessage = global && (
    <p role="status" className="text-sm text-muted-foreground">
      {global}
    </p>
  );

  if (variant === 'full') {
    return (
      <div className="flex flex-col gap-3">
        {DAYS.map((day) => {
          const has = value.some((s) => s.weekday === day.weekday);
          return (
            <div
              key={day.weekday}
              data-day={day.weekday}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-start"
            >
              <div className="flex w-44 items-center gap-3">
                <DaySwitch
                  checked={has}
                  disabled={!has && atMax}
                  onCheckedChange={(on) => toggleDay(day.weekday, on)}
                  aria-label={`Atender em ${day.long}`}
                />
                <span className="font-semibold text-foreground">{day.long}</span>
              </div>
              {has ? dayControls(day) : <span className="py-2 text-muted-foreground">Fechado</span>}
            </div>
          );
        })}
        {globalMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {DAYS.map((day) => {
        const dayShifts = value.filter((s) => s.weekday === day.weekday);
        const closed = dayShifts.length === 0;
        const dayError = withIndex
          .filter(({ s }) => s.weekday === day.weekday)
          .map(({ index }) => byIndex.get(index))
          .find(Boolean);
        const expanded = open === day.weekday;
        return (
          <div
            key={day.weekday}
            data-day={day.weekday}
            className="rounded-xl border border-border bg-card"
          >
            <button
              type="button"
              aria-expanded={expanded}
              aria-describedby={dayError && !expanded ? `day-error-${day.weekday}` : undefined}
              onClick={() => setOpen(expanded ? null : day.weekday)}
              className="flex min-h-12 w-full items-center gap-4 px-4 py-2 text-left"
            >
              <span
                className={`w-10 font-bold ${closed ? 'text-muted-foreground' : 'text-foreground'}`}
              >
                {day.short}
              </span>
              <span className={closed ? 'text-muted-foreground' : 'text-foreground'}>
                {closed ? 'Fechado' : summary(dayShifts)}
              </span>
              {dayError && !expanded && (
                <span
                  id={`day-error-${day.weekday}`}
                  className="ml-auto text-sm font-medium text-error"
                >
                  {dayError}
                </span>
              )}
            </button>
            {expanded && (
              <div className="flex flex-col gap-3 border-t border-border p-4">
                <div className="flex items-center gap-3">
                  <DaySwitch
                    checked={!closed}
                    disabled={closed && atMax}
                    onCheckedChange={(on) => toggleDay(day.weekday, on)}
                    aria-label={`Atender em ${day.long}`}
                  />
                  <span className="text-sm text-foreground-secondary">Atender em {day.long}</span>
                </div>
                {!closed && dayControls(day)}
              </div>
            )}
          </div>
        );
      })}
      {globalMessage}
    </div>
  );
}
