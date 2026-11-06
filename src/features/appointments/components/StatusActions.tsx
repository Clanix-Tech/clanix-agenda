import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Ban, CalendarClock, CheckCircle2, Pencil, Repeat, RotateCcw, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toAppError, type AppError } from '@/lib/errors';
import {
  useCancelAppointment,
  useReactivateAppointment,
  useSetStatus,
  type Appointment,
} from '../api';
import type { AppointmentStatus } from '../domain/status';
import { CancelDialog } from './CancelDialog';

type Confirm = 'cancelar' | 'faltou' | 'reativar' | null;

type Props = {
  appointment: Appointment;
  onEdit?: () => void;
  /** Reativação bloqueada por conflito/expediente: abre novo agendamento no mesmo dia. */
  onCreateNew?: () => void;
};

function Act({
  label,
  icon,
  onClick,
  pending,
  className = '',
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  pending: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={onClick}
      className={`${ACTION} ${className}`}
    >
      {icon}
      {label}
    </Button>
  );
}

const ACTION =
  'h-auto min-h-[52px] rounded-[14px] border border-border bg-card py-2 text-center text-sm leading-tight font-semibold whitespace-normal';

/** Ações permitidas por status (design §6.1); nada além da tabela aprovada. */
export function StatusActions({ appointment, onEdit, onCreateNew }: Props) {
  const navigate = useNavigate();
  const setStatus = useSetStatus();
  const cancel = useCancelAppointment();
  const reactivate = useReactivateAppointment();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [error, setError] = useState<AppError | null>(null);
  const busy = useRef(false);
  const { id, status } = appointment;

  async function run(action: () => Promise<unknown>, success: string) {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      await action();
      toast.success(success);
      setConfirm(null);
    } catch (err) {
      setConfirm(null);
      setError(toAppError(err));
    } finally {
      busy.current = false;
    }
  }

  const changeTo = (next: AppointmentStatus) =>
    run(() => setStatus.mutateAsync({ id, status: next }), 'Status atualizado');
  const pending = setStatus.isPending || cancel.isPending || reactivate.isPending;

  const edit = (
    <Act
      label="Editar dados"
      icon={<Pencil aria-hidden="true" />}
      onClick={() => onEdit?.()}
      pending={pending}
      className="text-foreground"
    />
  );
  const backToScheduled = (
    <Act
      label="Voltar para agendado"
      icon={<CalendarClock aria-hidden="true" />}
      onClick={() => void changeTo('agendado')}
      pending={pending}
      className="text-link"
    />
  );

  let actions: ReactNode;
  if (status === 'agendado') {
    actions = (
      <>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            disabled={pending}
            onClick={() => void navigate(`/agenda/remarcar/${id}`)}
            className="h-auto min-h-[52px] rounded-[14px] border border-primary py-2 text-center text-sm leading-tight font-semibold whitespace-normal"
          >
            <Repeat aria-hidden="true" />
            Remarcar
          </Button>
          {
            <Act
              label="Concluir"
              icon={<CheckCircle2 aria-hidden="true" />}
              onClick={() => void changeTo('concluido')}
              pending={pending}
              className="border-success-border bg-success-surface text-success-foreground"
            />
          }
          {
            <Act
              label="Não compareceu"
              icon={<UserX aria-hidden="true" />}
              onClick={() => setConfirm('faltou')}
              pending={pending}
              className="text-warning-foreground"
            />
          }
          {edit}
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirm('cancelar')}
          className="h-11 text-sm font-semibold text-error hover:bg-error-surface hover:text-error"
        >
          <Ban aria-hidden="true" />
          Cancelar atendimento
        </Button>
      </>
    );
  } else if (status === 'concluido') {
    actions = (
      <div className="grid grid-cols-2 gap-2">
        {
          <Act
            label="Marcar como não compareceu"
            icon={<UserX aria-hidden="true" />}
            onClick={() => void changeTo('nao_compareceu')}
            pending={pending}
            className="text-warning-foreground"
          />
        }
        {backToScheduled}
        {edit}
      </div>
    );
  } else if (status === 'nao_compareceu') {
    actions = (
      <div className="grid grid-cols-2 gap-2">
        {
          <Act
            label="Marcar como concluído"
            icon={<CheckCircle2 aria-hidden="true" />}
            onClick={() => void changeTo('concluido')}
            pending={pending}
            className="text-success-foreground"
          />
        }
        {backToScheduled}
        {edit}
      </div>
    );
  } else {
    actions = (
      <div className="grid grid-cols-2 gap-2">
        {
          <Act
            label="Reativar"
            icon={<RotateCcw aria-hidden="true" />}
            onClick={() => setConfirm('reativar')}
            pending={pending}
            className="text-foreground"
          />
        }
      </div>
    );
  }

  const confirmCopy =
    confirm === 'faltou'
      ? {
          title: 'Marcar como não compareceu?',
          text: 'Você poderá voltar o atendimento para agendado depois.',
          label: 'Não compareceu',
          go: () => void changeTo('nao_compareceu'),
        }
      : {
          title: 'Reativar este atendimento?',
          text: 'Ele volta para agendado, se o horário continuar livre.',
          label: 'Reativar',
          go: () => void run(() => reactivate.mutateAsync({ id }), 'Atendimento reativado'),
        };

  const blocked = error && (error.kind === 'conflito' || error.kind === 'fora_expediente');

  return (
    <div className="flex flex-col gap-2">
      {actions}
      {error && (
        <div role="alert" className="rounded-xl bg-error-surface p-3 text-sm text-error">
          <p>{error.message}</p>
          {blocked && status === 'cancelado' && onCreateNew && (
            <Button type="button" onClick={onCreateNew} className="mt-2 h-11">
              Criar novo agendamento
            </Button>
          )}
        </div>
      )}

      {confirm === 'cancelar' && (
        <CancelDialog
          open
          pending={pending}
          onOpenChange={(o) => !o && setConfirm(null)}
          onConfirm={(reason) =>
            void run(() => cancel.mutateAsync({ id, reason }), 'Atendimento cancelado')
          }
        />
      )}

      <Dialog
        open={confirm === 'faltou' || confirm === 'reativar'}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{confirmCopy.title}</DialogTitle>
            <DialogDescription>{confirmCopy.text}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setConfirm(null)}
            >
              Voltar
            </Button>
            <Button type="button" disabled={pending} className="h-11" onClick={confirmCopy.go}>
              {confirmCopy.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
