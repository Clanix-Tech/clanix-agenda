import { z } from 'zod';
import { addMinutesToTime } from '@/lib/time';

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const c = new Date(Date.UTC(y, m - 1, d));
  return c.getUTCFullYear() === y && c.getUTCMonth() === m - 1 && c.getUTCDate() === d;
}

export const appointmentFormSchema = z
  .object({
    clientName: z
      .string()
      .trim()
      .min(1, 'Informe o nome do cliente')
      .max(120, 'O nome pode ter no máximo 120 caracteres'),
    clientPhone: z
      .string()
      .refine((v) => v === '' || (v.length >= 8 && v.length <= 20 && /^[0-9()+ -]+$/.test(v)), {
        message: 'Telefone inválido',
      }),
    serviceName: z
      .string()
      .trim()
      .min(1, 'Informe o serviço')
      .max(120, 'O serviço pode ter no máximo 120 caracteres'),
    date: z.string().refine(validDate, 'Data inválida'),
    startTime: z.string().refine((v) => addMinutesToTime(v, 0) !== null, 'Horário inválido'),
    durationMinutes: z
      .number('Informe a duração')
      .int('A duração deve ser em minutos inteiros')
      .min(5, 'A duração mínima é de 5 minutos')
      .max(720, 'A duração máxima é de 12 horas'),
    notes: z.string().max(1000, 'As observações podem ter no máximo 1000 caracteres'),
    confirmPast: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (addMinutesToTime(v.startTime, 0) === null || !Number.isFinite(v.durationMinutes)) return;
    if (addMinutesToTime(v.startTime, v.durationMinutes) === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['startTime'],
        message: 'O atendimento precisa terminar no mesmo dia',
      });
    }
  });

export type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;
