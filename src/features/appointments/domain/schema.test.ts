import { describe, expect, it } from 'vitest';
import { appointmentFormSchema } from './schema';

const valid = {
  clientName: '  Maria Silva ',
  clientPhone: '(11) 98888-7777',
  serviceName: 'Corte',
  date: '2026-10-29',
  startTime: '09:00',
  durationMinutes: 45,
  notes: '',
  confirmPast: false,
};

const msgs = (v: unknown) => {
  const r = appointmentFormSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('appointmentFormSchema', () => {
  it('aceita válido e apara o nome', () => {
    const r = appointmentFormSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.clientName).toBe('Maria Silva');
  });
  it('nome em branco', () => {
    expect(msgs({ ...valid, clientName: '   ' })).toContain('Informe o nome do cliente');
  });
  it('serviço em branco', () => {
    expect(msgs({ ...valid, serviceName: ' ' })).toContain('Informe o serviço');
  });
  it('telefone inválido, vazio ok', () => {
    expect(msgs({ ...valid, clientPhone: 'abc12345' })).toContain('Telefone inválido');
    expect(msgs({ ...valid, clientPhone: '123' })).toContain('Telefone inválido');
    expect(msgs({ ...valid, clientPhone: '' })).toEqual([]);
  });
  it('fim no mesmo dia', () => {
    expect(msgs({ ...valid, startTime: '23:30' })).toContain(
      'O atendimento precisa terminar no mesmo dia',
    );
  });
  it('duração inteira 5–720', () => {
    expect(msgs({ ...valid, durationMinutes: 4 }).length).toBeGreaterThan(0);
    expect(msgs({ ...valid, durationMinutes: 721 }).length).toBeGreaterThan(0);
    expect(msgs({ ...valid, durationMinutes: 30.5 }).length).toBeGreaterThan(0);
  });
  it('data e hora inválidas, notas longas', () => {
    expect(msgs({ ...valid, date: '2026-02-30' }).length).toBeGreaterThan(0);
    expect(msgs({ ...valid, startTime: '25:00' }).length).toBeGreaterThan(0);
    expect(msgs({ ...valid, notes: 'x'.repeat(1001) }).length).toBeGreaterThan(0);
    expect(msgs({ ...valid, clientName: 'x'.repeat(121) }).length).toBeGreaterThan(0);
  });
});
