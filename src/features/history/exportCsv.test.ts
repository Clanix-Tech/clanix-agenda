import type { Appointment } from '@/features/appointments/api';
import { fetchAllAppointments } from './exportCsv';
import { fetchHistoryRange, type HistoryFilters } from './useHistorySearch';

vi.mock('./useHistorySearch', () => ({ fetchHistoryRange: vi.fn() }));

const F: HistoryFilters = { q: '', statuses: [], service: '', from: '', to: '' };
const chunk = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: String(i) }) as Appointment);
const mocked = vi.mocked(fetchHistoryRange);

beforeEach(() => mocked.mockReset());

describe('fetchAllAppointments', () => {
  it('junta os blocos e pede o total só no primeiro', async () => {
    mocked
      .mockResolvedValueOnce({ rows: chunk(1000), count: 1500 })
      .mockResolvedValueOnce({ rows: chunk(500), count: 1500 });
    expect(await fetchAllAppointments(F, 'America/Sao_Paulo')).toHaveLength(1500);
    expect(mocked.mock.calls.map((c) => c[4])).toEqual([true, false]);
  });

  it('bloco curto com linhas restantes continua pedindo', async () => {
    mocked
      .mockResolvedValueOnce({ rows: chunk(999), count: 1500 })
      .mockResolvedValueOnce({ rows: chunk(501), count: 1500 });
    expect(await fetchAllAppointments(F, 'America/Sao_Paulo')).toHaveLength(1500);
  });

  it('bloco vazio antes do total: erro, sem arquivo truncado', async () => {
    mocked
      .mockResolvedValueOnce({ rows: chunk(999), count: 1500 })
      .mockResolvedValueOnce({ rows: [], count: 1500 });
    await expect(fetchAllAppointments(F, 'America/Sao_Paulo')).rejects.toThrow('incomplete export');
  });
});
