import { CalendarClock, CheckCircle2, UserX, XCircle, type LucideIcon } from 'lucide-react';
import type { Database } from '@/types/database';

export type AppointmentStatus = Database['public']['Enums']['appointment_status'];

export const statusMeta: Record<
  AppointmentStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  agendado: { label: 'Agendado', icon: CalendarClock, className: 'bg-[#E7F1FF] text-[#1D4ED8]' },
  concluido: { label: 'Concluído', icon: CheckCircle2, className: 'bg-[#DCFCE7] text-[#166534]' },
  nao_compareceu: {
    label: 'Não compareceu',
    icon: UserX,
    className: 'bg-[#FEF3C7] text-[#92400E]',
  },
  cancelado: { label: 'Cancelado', icon: XCircle, className: 'bg-[#F1F5F9] text-[#475569]' },
};
