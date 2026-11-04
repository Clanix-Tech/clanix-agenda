import type { Appointment } from '@/features/appointments/api';
import { computeIndicators } from './indicators';

const ap = (
  id: string,
  day: string,
  start: string,
  end: string,
  status: Appointment['status'],
): Appointment => ({
  id,
  owner_id: 'user-1',
  client_name: `Cliente ${id}`,
  client_phone: null,
  service_name: 'Corte',
  notes: null,
  starts_at: `2026-${day}T${start}:00-03:00`,
  ends_at: `2026-${day}T${end}:00-03:00`,
  status,
  canceled_at: null,
  cancellation_reason: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
});

const A = ap('A', '10-29', '08:30', '09:30', 'concluido');
const B = ap('B', '10-29', '11:30', '12:00', 'nao_compareceu');
const C = ap('C', '10-29', '14:00', '15:00', 'agendado');
const D = ap('D', '10-29', '16:30', '17:00', 'cancelado');
const E = ap('E', '10-29', '17:00', '18:00', 'agendado');
const F = ap('F', '10-30', '09:00', '10:00', 'agendado');
const G = ap('G', '10-05', '10:00', '11:00', 'cancelado');
const H = ap('H', '11-02', '09:00', '10:00', 'agendado');

describe('computeIndicators', () => {
  it('calcula os indicadores do fixture (fuso de São Paulo, semana começa na segunda)', () => {
    const r = computeIndicators(
      [A, B, C, D, E, F, G, H],
      'America/Sao_Paulo',
      new Date('2026-10-29T13:40:00-03:00'),
      1,
    );
    expect(r).toEqual({
      today: 4,
      todayRemaining: 2,
      todayNoShows: 1,
      next: C,
      week: 5,
      monthCancellations: 2,
    });
  });

  it('sem agendamentos: zeros e next nulo', () => {
    expect(
      computeIndicators([], 'America/Sao_Paulo', new Date('2026-10-29T13:40:00-03:00'), 1),
    ).toEqual({
      today: 0,
      todayRemaining: 0,
      todayNoShows: 0,
      next: null,
      week: 0,
      monthCancellations: 0,
    });
  });
});
