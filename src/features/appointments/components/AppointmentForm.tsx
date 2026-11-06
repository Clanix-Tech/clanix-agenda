import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useForm, useWatch, type FieldError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/layout/ResponsiveSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { toAppError, type AppError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import {
  addMinutesToTime,
  formatDateBR,
  formatTime,
  instantToLocal,
  localToInstant,
  todayInTz,
} from '@/lib/time';
import { useProfile, type Profile } from '@/features/profile/api';
import { useBusinessHours } from '@/features/business-hours/api';
import { useFavorites, type FavoriteService } from '@/features/favorites/api';
import {
  useAppointmentsRange,
  useCreateAppointment,
  useUpdateDetails,
  type Appointment,
  type CreateAppointmentInput,
} from '../api';
import { appointmentFormSchema, type AppointmentFormValues } from '../domain/schema';
import { freeIntervals, isWithinShifts, slotStarts, type Shift } from '../domain/freeSlots';
import { durationLabel, durationOptions, durationShort } from '../domain/duration';
import { ConflictPanel, type ConflictItem, type SuggestedSlot } from './ConflictPanel';
import type { NewAppointmentPrefill } from './NewAppointmentProvider';

export type AppointmentFormProps =
  | { mode: 'create'; prefill?: NewAppointmentPrefill; appointment?: never; onDone(): void }
  | { mode: 'edit'; appointment: Appointment; prefill?: never; onDone(): void };

type FormInput = z.input<typeof appointmentFormSchema>;

/**
 * Formulário de novo agendamento (T05/T08) e de edição de detalhes. Abre dentro de
 * `ResponsiveSheet`; todo o estado (react-hook-form, mutações, erros) vive aqui, acima da
 * gaveta/janela, então trocar entre Drawer e Dialog ao cruzar 1024 px não perde o que foi digitado.
 */
export function AppointmentForm(props: AppointmentFormProps) {
  const profile = useProfile();
  const hours = useBusinessHours();
  const favorites = useFavorites();
  const title = props.mode === 'edit' ? 'Editar agendamento' : 'Novo agendamento';
  // Sem favoritos (ou falha ao lê-los) o serviço vira texto livre; perfil e expediente são necessários.
  const favs = favorites.data ?? (favorites.isError ? [] : undefined);

  if (profile.data && hours.data && favs) {
    return (
      <FormBody
        {...props}
        title={title}
        profile={profile.data}
        shifts={hours.data}
        favorites={favs}
      />
    );
  }

  const failed = profile.isError || hours.isError;
  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && props.onDone()} title={title} fullScreen>
      {failed ? (
        <ErrorState
          message={toAppError(profile.error ?? hours.error).message}
          onRetry={() => {
            void profile.refetch();
            void hours.refetch();
          }}
        />
      ) : (
        <LoadingState />
      )}
    </ResponsiveSheet>
  );
}

type BodyProps = AppointmentFormProps & {
  title: string;
  profile: Profile;
  shifts: Shift[];
  favorites: FavoriteService[];
};

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function safeInstant(date: string, time: string, tz: string): string | null {
  try {
    return localToInstant(date, time, tz);
  } catch {
    return null;
  }
}

function nextDay(date: string): string {
  const d = new Date(
    Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)) + 1),
  );
  return d.toISOString().slice(0, 10);
}

function minutesBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000);
}

/** Mantém "agora" atualizado para o aviso de horário passado (RN13); `refresh` força a leitura. */
function useNow(intervalMs = 30_000): [number, () => void] {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return [now, () => setNow(Date.now())];
}

const UNEXPECTED: AppError = { kind: 'desconhecido', message: 'Algo deu errado. Tente novamente.' };

type Snapshot = string;
const snapshotOf = (v: Partial<FormInput>): Snapshot =>
  JSON.stringify([
    v.clientName,
    v.clientPhone,
    v.serviceName,
    v.date,
    v.startTime,
    v.durationMinutes,
    v.notes,
    v.confirmPast,
  ]);

function FormBody(props: BodyProps) {
  const { onDone, title, profile, shifts, favorites } = props;
  // `appointment` só existe no modo edit (garantido pelo tipo das props).
  const appointment = props.mode === 'edit' ? props.appointment : null;
  const prefill = props.mode === 'create' ? props.prefill : undefined;
  const isEdit = appointment !== null;
  const tz = profile.timezone;
  const step = profile.slot_interval_minutes as 15 | 30 | 60;
  const ids = useId();
  const formId = `${ids}-form`;
  const [now, refreshNow] = useNow();
  const [today] = useState(() => todayInTz(tz));

  const form = useForm<FormInput, unknown, AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: (() => {
      if (appointment) {
        const local = instantToLocal(appointment.starts_at, tz);
        return {
          clientName: appointment.client_name,
          clientPhone: appointment.client_phone ?? '',
          serviceName: appointment.service_name,
          date: local.date,
          startTime: local.time,
          durationMinutes: minutesBetween(appointment.starts_at, appointment.ends_at),
          notes: appointment.notes ?? '',
          confirmPast: false,
        };
      }
      return {
        clientName: '',
        clientPhone: '',
        serviceName: '',
        date: prefill?.date ?? today,
        startTime: prefill?.startTime ?? '',
        durationMinutes: profile.default_duration_minutes,
        notes: '',
        confirmPast: false,
      };
    })(),
  });
  const { register, setValue, getValues, formState } = form;
  const errors = formState.errors;
  const values = useWatch({ control: form.control }) as FormInput;
  const snapshot = snapshotOf(values);

  const [otherOpen, setOtherOpen] = useState(
    () =>
      favorites.length === 0 ||
      (!!appointment && !favorites.some((f) => f.name === appointment.service_name)),
  );
  const otherRef = useRef<HTMLInputElement | null>(null);
  const selectedFav = otherOpen ? undefined : favorites.find((f) => f.name === values.serviceName);

  // --- Disponibilidade (só no modo create) -------------------------------------------------
  const date = values.date ?? '';
  const startTime = values.startTime ?? '';
  const duration = Number(values.durationMinutes);
  const dayStartIso = safeInstant(date, '00:00', tz);
  const rangeDate = dayStartIso ? date : today;
  const dayQuery = useAppointmentsRange(
    localToInstant(rangeDate, '00:00', tz),
    localToInstant(nextDay(rangeDate), '00:00', tz),
  );
  const busyAppts = useMemo(
    () => (dayQuery.data ?? []).filter((a) => a.status !== 'cancelado'),
    [dayQuery.data],
  );
  const busy = useMemo(
    () => busyAppts.map((a) => ({ startsAt: a.starts_at, endsAt: a.ends_at })),
    [busyAppts],
  );

  const endTime = Number.isFinite(duration) ? addMinutesToTime(startTime, duration) : null;
  const startIso = dayStartIso && endTime ? safeInstant(date, startTime, tz) : null;
  const endIso = startIso && endTime ? safeInstant(date, endTime, tz) : null;
  const isPast = !isEdit && !!startIso && Date.parse(startIso) < now;
  const confirmPast = !!values.confirmPast;

  const conflicts: ConflictItem[] =
    !isEdit && startIso && endIso
      ? busyAppts
          .filter(
            (a) =>
              Date.parse(a.starts_at) < Date.parse(endIso) &&
              Date.parse(a.ends_at) > Date.parse(startIso),
          )
          .map((a) => ({
            id: a.id,
            name: a.client_name,
            start: formatTime(a.starts_at, tz),
            end: formatTime(a.ends_at, tz),
          }))
      : [];

  // Erros do servidor valem só enquanto os campos continuam iguais aos enviados.
  const [failure, setFailure] = useState<{ error: AppError; snapshot: Snapshot } | null>(null);
  const [serverConflict, setServerConflict] = useState<Snapshot | null>(null);
  const showServerConflict = serverConflict === snapshot;
  const showConflict = !isEdit && !!startIso && (conflicts.length > 0 || showServerConflict);
  const visibleFailure = failure && failure.snapshot === snapshot ? failure.error : null;

  // RN18: o cache do dia pode ter até 30 s. Antes de bloquear o Salvar por um conflito
  // calculado aqui, busca o dia de novo; só dados frescos sustentam o bloqueio.
  const conflictKey = conflicts.length > 0 ? `${startIso}|${endIso}` : null;
  const [verified, setVerified] = useState<{ key: string; ok: boolean } | null>(null);
  const { refetch: refetchDay } = dayQuery;
  const verifying = conflictKey !== null && verified?.key !== conflictKey;
  useEffect(() => {
    if (conflictKey === null || verified?.key === conflictKey) return;
    let alive = true;
    void refetchDay().then(
      (res) => alive && setVerified({ key: conflictKey, ok: !res.isError }),
      () => alive && setVerified({ key: conflictKey, ok: false }),
    );
    return () => {
      alive = false;
    };
  }, [conflictKey, verified, refetchDay]);
  const conflictConfirmed = conflictKey !== null && verified?.key === conflictKey && verified.ok;
  const checking = verifying || (showServerConflict && dayQuery.isFetching);
  const recheck = () => {
    if (conflictKey !== null) setVerified(null);
    else void refetchDay();
  };

  const suggestions: SuggestedSlot[] = useMemo(() => {
    if (!showConflict || !Number.isFinite(duration)) return [];
    const target = toMin(startTime);
    const starts = slotStarts(freeIntervals(date, tz, shifts, busy, new Date(now)), duration, step)
      .filter((s) => s !== startTime)
      .sort(
        (a, b) => Math.abs(toMin(a) - target) - Math.abs(toMin(b) - target) || a.localeCompare(b),
      )
      .slice(0, 3)
      .sort();
    return starts.map((s) => ({ start: s, end: addMinutesToTime(s, duration) ?? '' }));
  }, [showConflict, duration, startTime, date, tz, shifts, busy, now, step]);

  // Início padrão: o próximo horário livre do dia (quando nada foi informado).
  const defaultedStart = useRef(isEdit || !!prefill?.startTime);
  useEffect(() => {
    if (defaultedStart.current || !dayQuery.data) return;
    defaultedStart.current = true;
    const v = getValues();
    if (v.startTime !== '' || !safeInstant(v.date, '00:00', tz)) return;
    const free = freeIntervals(v.date, tz, shifts, busy, new Date());
    const first = slotStarts(free, Number(v.durationMinutes), step)[0];
    if (first) setValue('startTime', first);
  }, [dayQuery.data, busy, getValues, setValue, shifts, step, tz]);

  // --- Envio --------------------------------------------------------------------------------
  const create = useCreateAppointment();
  const update = useUpdateDetails();
  const busyRef = useRef(false);
  const [pending, setPending] = useState(false);
  const lastJob = useRef<(() => Promise<void>) | null>(null);

  const pastBlocked = !isEdit && isPast && !confirmPast;
  // Bloqueia enquanto confere e quando dados frescos confirmam o conflito (T08).
  const conflictBlocked = !isEdit && (verifying || conflictConfirmed);
  const blocked = pastBlocked || conflictBlocked;

  const release = () => {
    busyRef.current = false;
    setPending(false);
  };

  const succeed = () => {
    toast.success('Agendamento salvo');
    // Continua travado: o formulário sai de cena.
    onDone();
  };

  const fail = async (err: unknown, snap: Snapshot, rangeKey?: string) => {
    const app = toAppError(err);
    if (app.kind === 'conflito') {
      setFailure(null);
      setServerConflict(snap);
      // A lista de quem ocupa precisa estar atual (e já conta como verificação).
      const res = await refetchDay().catch(() => null);
      if (rangeKey) setVerified({ key: rangeKey, ok: !!res && !res.isError });
    } else {
      setFailure({ error: app, snapshot: snap });
    }
    release();
  };

  const sendCreate = (input: CreateAppointmentInput, snap: Snapshot) => async () => {
    try {
      // Mesma instância do hook em todas as tentativas: RN17 reconhece o próprio agendamento.
      await create.mutateAsync(input);
      succeed();
    } catch (e) {
      await fail(e, snap, `${input.startsAt}|${input.endsAt}`);
    }
  };

  const sendEdit =
    (input: Parameters<typeof update.mutateAsync>[0], snap: Snapshot) => async () => {
      try {
        await update.mutateAsync(input);
        succeed();
      } catch (e) {
        await fail(e, snap);
      }
    };

  const run = (job: () => Promise<void>) => {
    lastJob.current = job;
    void job();
  };

  const onValid = (v: AppointmentFormValues) => {
    const snap = snapshotOf(getValues());
    setFailure(null);
    setServerConflict(null);
    try {
      if (appointment) {
        run(
          sendEdit(
            {
              id: appointment.id,
              clientName: v.clientName,
              serviceName: v.serviceName,
              clientPhone: v.clientPhone,
              notes: v.notes,
            },
            snap,
          ),
        );
        return;
      }
      const end = addMinutesToTime(v.startTime, v.durationMinutes);
      if (end === null) throw new RangeError('fim inválido');
      const startsAt = localToInstant(v.date, v.startTime, tz);
      const endsAt = localToInstant(v.date, end, tz);
      // RN13 com o relógio de agora: o início pode ter passado desde a última renderização.
      const past = Date.parse(startsAt) < Date.now();
      if (past && !v.confirmPast) {
        refreshNow();
        release();
        return;
      }
      run(
        sendCreate(
          {
            clientName: v.clientName,
            clientPhone: v.clientPhone,
            serviceName: v.serviceName,
            startsAt,
            endsAt,
            notes: v.notes,
            confirmPast: past,
          },
          snap,
        ),
      );
    } catch {
      // Nunca fica preso em "Salvando…".
      setFailure({ error: UNEXPECTED, snapshot: snap });
      release();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    // A ref bloqueia o 2º clique/Enter antes de o React re-renderizar o botão desabilitado.
    if (busyRef.current || blocked) return;
    busyRef.current = true;
    setPending(true);
    void form.handleSubmit(onValid, release)();
  };

  const retry = () => {
    const job = lastJob.current;
    if (busyRef.current || !job) return;
    busyRef.current = true;
    setPending(true);
    setFailure(null);
    void job();
  };

  // --- Serviço ------------------------------------------------------------------------------
  const pickFavorite = (f: FavoriteService) => {
    setOtherOpen(false);
    setValue('serviceName', f.name, { shouldDirty: true, shouldValidate: formState.isSubmitted });
    if (!isEdit) setValue('durationMinutes', f.duration_minutes, { shouldDirty: true });
  };

  const pickOther = () => {
    if (!otherOpen) {
      setOtherOpen(true);
      setValue('serviceName', '', { shouldDirty: true });
    }
    requestAnimationFrame(() => otherRef.current?.focus());
  };

  /** Valor da lista de serviços: id de um favorito ou `OTHER_SERVICE`. */
  const pickService = (value: string) => {
    if (value === OTHER_SERVICE) return pickOther();
    const f = favorites.find((x) => x.id === value);
    if (f) pickFavorite(f);
  };

  const startRef = useRef<HTMLInputElement | null>(null);
  const pickSuggestion = (start: string) => {
    setValue('startTime', start, { shouldDirty: true, shouldValidate: formState.isSubmitted });
    // O botão clicado some com o conflito; o foco volta para o campo que mudou.
    startRef.current?.focus();
  };

  const options = durationOptions(
    profile.default_duration_minutes,
    selectedFav?.duration_minutes,
    Number.isFinite(duration) ? duration : undefined,
  );

  const errId = (name: string) => `${ids}-${name}-err`;
  const describe = (name: string, err?: FieldError, extra?: string) =>
    [err ? errId(name) : null, extra].filter(Boolean).join(' ') || undefined;
  const conflictId = `${ids}-conflict`;
  const pastId = `${ids}-past`;
  const serviceInput = register('serviceName');
  const startInput = register('startTime');
  // O botão desabilitado aponta para o motivo visível.
  const blockedReason =
    [pastBlocked ? pastId : null, conflictBlocked ? conflictId : null].filter(Boolean).join(' ') ||
    undefined;

  const submitLabel = isEdit ? 'Salvar alterações' : 'Salvar agendamento';
  const footer = (
    <div className="flex w-full gap-2.5 lg:justify-end">
      <Button
        type="button"
        variant="outline"
        onClick={onDone}
        className="h-[52px] flex-1 rounded-[14px] border-border text-[15px] font-semibold text-foreground lg:h-11 lg:flex-none lg:rounded-xl lg:px-5"
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        form={formId}
        disabled={pending || blocked}
        aria-describedby={!pending ? blockedReason : undefined}
        className="h-[52px] flex-[2] rounded-[14px] text-[15px] font-bold lg:h-11 lg:flex-none lg:rounded-xl lg:px-5"
      >
        {pending ? 'Salvando…' : submitLabel}
      </Button>
    </div>
  );

  return (
    <ResponsiveSheet
      open
      onOpenChange={(o) => !o && onDone()}
      title={title}
      footer={footer}
      fullScreen
    >
      <form id={formId} noValidate onSubmit={onSubmit} className="flex flex-col gap-4 pt-1">
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-3">
          <Field id={`${ids}-name`} label="Nome do cliente" error={errors.clientName} errId={errId}>
            <Input
              id={`${ids}-name`}
              autoComplete="off"
              aria-invalid={!!errors.clientName}
              aria-describedby={describe('name', errors.clientName)}
              className={inputCls}
              {...register('clientName')}
            />
          </Field>
          <Field
            id={`${ids}-phone`}
            label={
              <>
                Telefone <small className="font-medium text-muted-foreground">(opcional)</small>
              </>
            }
            error={errors.clientPhone}
            errId={errId}
            errKey="phone"
          >
            <Input
              id={`${ids}-phone`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 90000-0000"
              aria-invalid={!!errors.clientPhone}
              aria-describedby={describe('phone', errors.clientPhone)}
              className={inputCls}
              {...register('clientPhone')}
            />
          </Field>
        </div>

        {/* Lista (como Duração) em vez de um botão por favorito: com muitos serviços, os botões
            enchiam a tela. "Outro serviço…" abre o campo de texto. */}
        <div className="flex flex-col gap-2">
          {favorites.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${ids}-service-choice`} className={labelCls}>
                Serviço
              </Label>
              <select
                id={`${ids}-service-choice`}
                value={otherOpen ? OTHER_SERVICE : (selectedFav?.id ?? '')}
                onChange={(e) => pickService(e.target.value)}
                aria-invalid={!otherOpen && !!errors.serviceName}
                aria-describedby={!otherOpen ? describe('service', errors.serviceName) : undefined}
                className={cn(inputCls, selectCls)}
              >
                <option value="" disabled>
                  Escolha o serviço
                </option>
                {favorites.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} · {durationShort(f.duration_minutes)}
                  </option>
                ))}
                <option value={OTHER_SERVICE}>Outro serviço…</option>
              </select>
            </div>
          )}
          {otherOpen ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${ids}-service`} className={labelCls}>
                Nome do serviço
              </Label>
              <Input
                id={`${ids}-service`}
                autoComplete="off"
                placeholder="Ex.: Corte, Consulta…"
                aria-invalid={!!errors.serviceName}
                aria-describedby={describe('service', errors.serviceName)}
                className={inputCls}
                {...serviceInput}
                ref={(el) => {
                  serviceInput.ref(el);
                  otherRef.current = el;
                }}
              />
            </div>
          ) : null}
          <FieldErrorText id={errId('service')} error={errors.serviceName} />
        </div>

        {!isEdit && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <Field
                id={`${ids}-date`}
                label="Data"
                error={errors.date}
                errId={errId}
                errKey="date"
              >
                <Input
                  id={`${ids}-date`}
                  type="date"
                  aria-invalid={!!errors.date}
                  aria-describedby={describe('date', errors.date)}
                  className={inputCls}
                  {...register('date')}
                />
              </Field>
              <Field
                id={`${ids}-start`}
                label="Início"
                error={errors.startTime}
                errId={errId}
                errKey="start"
              >
                <Input
                  id={`${ids}-start`}
                  type="time"
                  step={step * 60}
                  aria-invalid={!!errors.startTime || showConflict}
                  aria-describedby={describe(
                    'start',
                    errors.startTime,
                    showConflict ? conflictId : undefined,
                  )}
                  className={cn(inputCls, showConflict && 'border-2 border-error')}
                  {...startInput}
                  ref={(el) => {
                    startInput.ref(el);
                    startRef.current = el;
                  }}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 items-end gap-2.5">
              <Field
                id={`${ids}-duration`}
                label="Duração"
                error={errors.durationMinutes}
                errId={errId}
                errKey="duration"
              >
                <select
                  id={`${ids}-duration`}
                  aria-invalid={!!errors.durationMinutes}
                  aria-describedby={describe('duration', errors.durationMinutes)}
                  className={cn(inputCls, selectCls)}
                  {...register('durationMinutes', { valueAsNumber: true })}
                >
                  {options.map((m) => (
                    <option key={m} value={m}>
                      {durationLabel(m)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex h-12 flex-col justify-center rounded-xl border border-border bg-muted px-3.5 lg:h-11">
                <span className="text-[11px] font-semibold text-muted-foreground">Termina às</span>
                <output
                  htmlFor={`${ids}-start ${ids}-duration`}
                  className="font-display text-[17px] leading-tight font-extrabold text-foreground"
                >
                  {endTime ?? '--:--'}
                </output>
              </div>
            </div>

            {isPast && (
              <div className="flex flex-col gap-2 rounded-[14px] border border-warning-border bg-warning-surface px-3.5 py-3 text-sm text-warning-foreground">
                {!confirmPast && (
                  <p id={pastId}>
                    Esse horário já passou. Para salvar, confirme que é o registro de um atendimento
                    que já aconteceu.
                  </p>
                )}
                <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    {...register('confirmPast')}
                  />
                  Este é um registro de atendimento que já aconteceu
                </label>
              </div>
            )}

            {startIso && endTime && dayQuery.data && (
              <Availability
                showConflict={showConflict}
                isPast={isPast}
                within={isWithinShifts(date, tz, shifts, startTime, duration)}
              >
                <ConflictPanel
                  id={conflictId}
                  start={startTime}
                  end={endTime}
                  conflicts={conflicts}
                  suggestions={suggestions}
                  dayLabel={formatDateBR(date, tz).slice(0, 5)}
                  durationLabel={durationLabel(duration)}
                  live={showServerConflict ? 'alert' : 'status'}
                  checking={checking}
                  unverified={
                    !showServerConflict &&
                    conflictKey !== null &&
                    verified?.key === conflictKey &&
                    !verified.ok
                  }
                  onPick={pickSuggestion}
                  onRecheck={recheck}
                />
              </Availability>
            )}
          </>
        )}

        <Field
          id={`${ids}-notes`}
          label={
            <>
              Observações <small className="font-medium text-muted-foreground">(opcional)</small>
            </>
          }
          error={errors.notes}
          errId={errId}
          errKey="notes"
        >
          <Textarea
            id={`${ids}-notes`}
            placeholder="Alguma preferência ou cuidado?"
            aria-invalid={!!errors.notes}
            aria-describedby={describe('notes', errors.notes)}
            className="min-h-[76px] resize-none rounded-xl border-input bg-card px-3.5 py-3 text-base md:text-base lg:text-[15px]"
            {...register('notes')}
          />
        </Field>

        {visibleFailure && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-[14px] border border-error-border bg-error-surface px-4 py-3.5 text-sm font-medium text-error"
          >
            <p>{visibleFailure.message}</p>
            {visibleFailure.kind === 'rede' && (
              <Button
                type="button"
                onClick={retry}
                disabled={pending}
                className="h-11 self-start rounded-xl px-5"
              >
                Tentar novamente
              </Button>
            )}
          </div>
        )}
      </form>
    </ResponsiveSheet>
  );
}

const labelCls = 'block text-[13px] font-semibold text-foreground-secondary';
const inputCls =
  'h-12 rounded-xl border-input bg-card px-3.5 text-base md:text-base lg:h-11 lg:text-[15px]';
// Listas nativas (Serviço e Duração): mesma aparência dos campos de texto.
const selectCls =
  'w-full border border-input bg-card px-3.5 text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring aria-invalid:border-error';
// Valor da opção "Outro serviço…" na lista de serviços (não colide com ids de favoritos, que são UUIDs).
const OTHER_SERVICE = '__outro__';

function Field({
  id,
  label,
  error,
  errId,
  errKey,
  children,
}: {
  id: string;
  label: ReactNode;
  error?: FieldError;
  errId(name: string): string;
  errKey?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className={labelCls}>
        {label}
      </Label>
      {children}
      <FieldErrorText id={errId(errKey ?? 'name')} error={error} />
    </div>
  );
}

function FieldErrorText({ id, error }: { id: string; error?: FieldError }) {
  if (!error?.message) return null;
  return (
    <p id={id} className="text-sm font-medium text-error">
      {error.message}
    </p>
  );
}

function Availability({
  showConflict,
  isPast,
  within,
  children,
}: {
  showConflict: boolean;
  isPast: boolean;
  within: boolean;
  children: ReactNode;
}) {
  if (showConflict) return <>{children}</>;
  // RN13: registro de atendimento passado não recebe aviso de expediente.
  if (isPast) return null;
  if (!within) {
    return (
      <div
        role="status"
        className="flex items-center gap-2.5 rounded-[14px] border border-warning-border bg-warning-surface px-3.5 py-3 text-sm font-semibold text-warning-foreground"
      >
        <TriangleAlert aria-hidden="true" className="size-5 shrink-0" />
        Fora do seu expediente
      </div>
    );
  }
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 rounded-[14px] border border-success-border bg-success-surface px-3.5 py-3 text-sm font-semibold text-success-foreground"
    >
      <CircleCheck aria-hidden="true" className="size-5 shrink-0" />
      Horário livre, dentro do expediente
    </div>
  );
}
