import { CalendarClock, CheckCircle2, UserX, XCircle, type LucideIcon } from 'lucide-react';
import type { Database } from '@/types/database';

export type AppointmentStatus = Database['public']['Enums']['appointment_status'];

export const statusMeta: Record<
  AppointmentStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  agendado: {
    label: 'Agendado',
    icon: CalendarClock,
    className: 'bg-status-agendado text-status-agendado-foreground',
  },
  concluido: {
    label: 'Concluído',
    icon: CheckCircle2,
    className: 'bg-status-concluido text-status-concluido-foreground',
  },
  nao_compareceu: {
    label: 'Não compareceu',
    icon: UserX,
    className: 'bg-status-nao-compareceu text-status-nao-compareceu-foreground',
  },
  cancelado: {
    label: 'Cancelado',
    icon: XCircle,
    className: 'bg-status-cancelado text-status-cancelado-foreground',
  },
};
