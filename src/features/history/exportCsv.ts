import { toAppError } from '@/lib/errors';
import { toCsv } from '@/lib/csv';
import { formatDateBR, formatTime, todayInTz } from '@/lib/time';
import type { Appointment } from '@/features/appointments/api';
import { statusMeta } from '@/features/appointments/domain/status';
import { fetchHistoryRange, type HistoryFilters } from './useHistorySearch';

const CHUNK = 1000;

export const CSV_HEADER = [
  'Data',
  'Início',
  'Fim',
  'Cliente',
  'Telefone',
  'Serviço',
  'Status',
  'Observações',
  'Motivo do cancelamento',
];

/** Sem filtros = todos os atendimentos do usuário (usado por "Baixar meus dados"). */
export const NO_FILTERS: HistoryFilters = { q: '', statuses: [], service: '', from: '', to: '' };

export async function fetchAllAppointments(
  filters: HistoryFilters,
  tz: string,
): Promise<Appointment[]> {
  const all: Appointment[] = [];
  let total = 0;
  for (let from = 0; ; from += CHUNK) {
    // O total só é pedido no primeiro bloco; os demais não repetem a contagem.
    const { rows, count } = await fetchHistoryRange(
      filters,
      tz,
      from,
      from + CHUNK - 1,
      from === 0,
    );
    if (from === 0) total = count;
    all.push(...rows);
    if (rows.length === 0 || all.length >= total) break;
  }
  // Nunca entrega arquivo truncado como se fosse completo.
  if (all.length !== total) throw new Error('incomplete export');
  return all;
}

export function appointmentsToCsv(rows: Appointment[], tz: string): string {
  return toCsv([
    CSV_HEADER,
    ...rows.map((a) => [
      formatDateBR(a.starts_at, tz),
      formatTime(a.starts_at, tz),
      formatTime(a.ends_at, tz),
      a.client_name,
      a.client_phone ?? '',
      a.service_name,
      statusMeta[a.status].label,
      a.notes ?? '',
      a.cancellation_reason ?? '',
    ]),
  ]);
}

function download(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    a.remove();
    // Revogar na hora aborta o download em alguns Safari/iOS.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Baixa todos os atendimentos do filtro (só os do usuário, via RLS). Lança `AppError`. */
export async function exportAppointmentsCsv(
  filters: HistoryFilters,
  tz: string,
  now: Date = new Date(),
): Promise<void> {
  let csv: string;
  try {
    csv = appointmentsToCsv(await fetchAllAppointments(filters, tz), tz);
  } catch (err) {
    throw toAppError(err);
  }
  download(csv, `agenda-em-ordem-${todayInTz(tz, now)}.csv`);
}
