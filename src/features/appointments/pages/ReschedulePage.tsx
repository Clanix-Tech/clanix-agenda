import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { toAppError, type AppError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { formatDateBR, formatTime, instantToLocal, localToInstant, todayInTz } from '@/lib/time';
import { useProfile } from '@/features/profile/api';
import { useBusinessHours } from '@/features/business-hours/api';
import {
  useAppointment,
  useAppointmentsRange,
  useRescheduleAppointment,
  type Appointment,
} from '../api';
import { durationLabel } from '../domain/duration';
import { freeIntervals, slotStarts, type Shift } from '../domain/freeSlots';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAYS_AHEAD = 14;
// Chips de dia e horário: com o preenchimento sólido do selecionado, o anel precisa ficar afastado.
const CHIP_FOCUS =
  'outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function addDaysStr(date: string, n: number): string {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}

const weekdayOf = (date: string) =>
  new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))).getUTCDay();

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const shortDate = (date: string) => formatDateBR(date, 'UTC').slice(0, 5);

type Slot = { time: string; busy: boolean };

/** Passos da grade dentro do expediente que ainda não passaram; `busy` = não cabe a duração inteira. */
function buildSlots(
  date: string,
  tz: string,
  shifts: Shift[],
  busy: Array<{ startsAt: string; endsAt: string }>,
  duration: number,
  step: 15 | 30 | 60,
  now: Date,
): Slot[] {
  const free = new Set(slotStarts(freeIntervals(date, tz, shifts, busy, now), duration, step));
  const weekday = weekdayOf(date);
  const out: Slot[] = [];
  for (const s of shifts
    .filter((x) => x.weekday === weekday)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))) {
    const end = toMin(s.end_time);
    for (let t = toMin(s.start_time); t < end; t += step) {
      const time = fromMin(t);
      if (new Date(localToInstant(date, time, tz)) < now) continue;
      out.push({ time, busy: t + duration > end || !free.has(time) });
    }
  }
  return out;
}

export default function ReschedulePage() {
  return <RescheduleLoader />;
}

function RescheduleLoader() {
  const { id } = useParams();
  const appointment = useAppointment(id);
  const profile = useProfile();
  const hours = useBusinessHours();

  if (appointment.isPending || profile.isPending || hours.isPending) return <LoadingState />;
  if (appointment.isError || profile.isError || hours.isError) {
    const err = toAppError(appointment.error ?? profile.error ?? hours.error);
    return (
      <Shell>
        <ErrorState
          message={err.message}
          onRetry={
            err.kind === 'nao_encontrado'
              ? undefined
              : () => {
                  void appointment.refetch();
                  void profile.refetch();
                  void hours.refetch();
                }
          }
        />
        {err.kind === 'nao_encontrado' && <BackLink />}
      </Shell>
    );
  }
  if (appointment.data.status !== 'agendado') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <p className="text-foreground">Só atendimentos agendados podem ser remarcados.</p>
          <BackLink />
        </div>
      </Shell>
    );
  }
  return (
    <RescheduleBody
      appointment={appointment.data}
      tz={profile.data.timezone}
      step={profile.data.slot_interval_minutes as 15 | 30 | 60}
      shifts={hours.data}
    />
  );
}

function BackLink() {
  return (
    <Link
      to="/agenda"
      className="inline-flex h-11 items-center rounded-lg px-4 font-semibold text-link underline"
    >
      Voltar
    </Link>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="mx-auto w-full max-w-xl pb-28">
      <header className="flex items-center gap-2 p-4">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/agenda'))}
          className="flex size-11 items-center justify-center rounded-full text-foreground hover:bg-accent"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </button>
        <h1 className="font-display text-xl font-bold text-foreground">Remarcar atendimento</h1>
      </header>
      {children}
    </div>
  );
}

function RescheduleBody({
  appointment,
  tz,
  step,
  shifts,
}: {
  appointment: Appointment;
  tz: string;
  step: 15 | 30 | 60;
  shifts: Shift[];
}) {
  const navigate = useNavigate();
  const reschedule = useRescheduleAppointment();
  const sending = useRef(false);
  const dayRef = useRef<string | undefined>(undefined);

  const now = useMemo(() => new Date(), []);
  const current = instantToLocal(appointment.starts_at, tz);
  const duration = Math.round(
    (Date.parse(appointment.ends_at) - Date.parse(appointment.starts_at)) / 60_000,
  );

  const days = useMemo(() => {
    const today = todayInTz(tz, now);
    const withShifts = new Set(shifts.map((s) => s.weekday));
    return Array.from({ length: DAYS_AHEAD }, (_, i) => addDaysStr(today, i)).filter((d) =>
      withShifts.has(weekdayOf(d)),
    );
  }, [tz, now, shifts]);

  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const day = pickedDay ?? (days.includes(current.date) ? current.date : days[0]);

  useEffect(() => {
    dayRef.current = day;
  }, [day]);

  if (!day) {
    return (
      <Shell>
        <div className="p-8 text-center text-foreground">
          Nenhum dia com expediente nos próximos dias. Revise seus horários de atendimento.
        </div>
      </Shell>
    );
  }
  return (
    <Picker
      {...{
        appointment,
        tz,
        step,
        shifts,
        now,
        duration,
        days,
        day,
        time,
        setTime,
        error,
        setError,
        reschedule,
        navigate,
        tryStart: () => {
          if (sending.current) return false;
          sending.current = true;
          return true;
        },
        finish: () => {
          sending.current = false;
        },
        isCurrentDay: (d: string) => dayRef.current === d,
        pickDay: (d: string) => {
          setPickedDay(d);
          setTime(null);
          setError(null);
        },
      }}
    />
  );
}

type PickerProps = {
  appointment: Appointment;
  tz: string;
  step: 15 | 30 | 60;
  shifts: Shift[];
  now: Date;
  duration: number;
  days: string[];
  day: string;
  time: string | null;
  setTime: (t: string | null) => void;
  error: AppError | null;
  setError: (e: AppError | null) => void;
  reschedule: ReturnType<typeof useRescheduleAppointment>;
  navigate: ReturnType<typeof useNavigate>;
  tryStart: () => boolean;
  finish: () => void;
  isCurrentDay: (d: string) => boolean;
  pickDay: (d: string) => void;
};

function Picker(p: PickerProps) {
  const { appointment, tz, day, time, duration, now } = p;
  const range = useAppointmentsRange(
    localToInstant(day, '00:00', tz),
    localToInstant(addDaysStr(day, 1), '00:00', tz),
  );

  const slots = useMemo(() => {
    const busy = (range.data ?? [])
      .filter((a) => a.status !== 'cancelado' && a.id !== appointment.id)
      .map((a) => ({ startsAt: a.starts_at, endsAt: a.ends_at }));
    return buildSlots(day, tz, p.shifts, busy, duration, p.step, now);
  }, [range.data, appointment.id, day, tz, p.shifts, duration, p.step, now]);

  const pending = p.reschedule.isPending;

  async function submit() {
    if (!time || !p.tryStart()) return;
    p.setError(null);
    try {
      const endTime = fromMin(toMin(time) + duration);
      await p.reschedule.mutateAsync({
        id: appointment.id,
        startsAt: localToInstant(day, time, tz),
        // Duração dentro do dia é garantida pela grade (o fim nunca passa do expediente).
        endsAt: localToInstant(day, endTime, tz),
        confirmPast: false,
      });
      toast.success('Atendimento remarcado');
      p.navigate(`/agenda?visao=dia&data=${day}`, { replace: true });
    } catch (err) {
      if (!p.isCurrentDay(day)) return;
      const app = toAppError(err);
      p.setError(app);
      if (app.kind === 'conflito') {
        p.setTime(null);
        void range.refetch();
      }
    } finally {
      p.finish();
    }
  }

  return (
    <Shell>
      <section className="mx-4 rounded-card border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-lg font-semibold text-foreground">
            {appointment.client_name}
          </p>
          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-link">
            Atual
          </span>
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {appointment.service_name} · {durationLabel(duration)}
        </p>
        <p className="mt-1 text-sm text-foreground">
          {formatDateBR(appointment.starts_at, tz)} · {formatTime(appointment.starts_at, tz)} –{' '}
          {formatTime(appointment.ends_at, tz)}
        </p>
      </section>

      <h2 className="mt-5 px-4 text-sm font-semibold text-foreground">Escolha o dia</h2>
      <div className="mt-0.5 flex gap-2 overflow-x-auto px-4 pt-1.5 pb-1.5">
        {p.days.map((d) => {
          const selected = d === day;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={selected}
              disabled={pending}
              onClick={() => p.pickDay(d)}
              className={cn(
                'h-11 min-w-16 shrink-0 rounded-xl border px-3 text-sm font-semibold',
                CHIP_FOCUS,
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground',
              )}
            >
              {`${WEEKDAYS[weekdayOf(d)]} ${d.slice(8, 10)}`}
            </button>
          );
        })}
      </div>

      <h2 className="mt-5 px-4 text-sm font-semibold text-foreground">Escolha o horário</h2>
      <div className="mt-2 px-4">
        {range.isPending ? (
          <LoadingState label="Carregando horários…" />
        ) : range.isError ? (
          <ErrorState
            message={toAppError(range.error).message}
            onRetry={() => void range.refetch()}
          />
        ) : slots.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">Nenhum horário neste dia.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => {
              const selected = s.time === time;
              return (
                <button
                  key={s.time}
                  type="button"
                  disabled={s.busy || pending}
                  aria-label={s.busy ? `${s.time}, ocupado` : undefined}
                  aria-pressed={selected}
                  onClick={() => {
                    p.setTime(s.time);
                    p.setError(null);
                  }}
                  className={cn(
                    'flex h-12 flex-col items-center justify-center rounded-xl border text-sm font-semibold',
                    CHIP_FOCUS,
                    s.busy &&
                      'border-border bg-muted text-muted-foreground line-through opacity-70',
                    !s.busy && !selected && 'border-border bg-card text-foreground',
                    selected && 'border-primary bg-primary text-primary-foreground',
                  )}
                >
                  {s.time}
                  {s.busy && <span className="text-[10px] font-normal">ocupado</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {time && (
        <p className="mx-4 mt-4 rounded-xl bg-secondary p-3 text-sm font-semibold text-foreground">
          {`${shortDate(instantToLocal(appointment.starts_at, tz).date)} às ${formatTime(appointment.starts_at, tz)} → ${shortDate(day)} às ${time}`}
        </p>
      )}
      <p className="mt-3 px-4 text-sm text-muted-foreground">
        Nome, telefone, serviço e observações são mantidos.
      </p>

      {p.error && (
        <div role="alert" className="mx-4 mt-3 rounded-xl bg-error-surface p-3 text-sm text-error">
          <p>{p.error.message}</p>
          {p.error.kind === 'rede' && (
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={pending}
              className="mt-2 h-11 bg-primary px-5 text-primary-foreground hover:bg-primary-hover"
            >
              Tentar novamente
            </Button>
          )}
        </div>
      )}

      {/* Acima da navegação inferior no celular; à direita da barra lateral no computador. */}
      <div
        data-testid="reschedule-bar"
        className="fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-10 border-t border-border bg-card px-4 pt-4 pb-6 lg:bottom-0 lg:left-24 lg:pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <Button
          type="button"
          disabled={!time || pending}
          onClick={() => void submit()}
          className="mx-auto flex h-12 w-full max-w-xl bg-primary text-base text-primary-foreground hover:bg-primary-hover"
        >
          {pending ? 'Remarcando…' : 'Confirmar remarcação'}
        </Button>
      </div>
    </Shell>
  );
}
