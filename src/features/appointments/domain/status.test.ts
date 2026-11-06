import { describe, expect, it } from 'vitest';
import { statusMeta } from './status';

describe('statusMeta', () => {
  const casos = [
    ['agendado', 'Agendado', 'bg-status-agendado text-status-agendado-foreground'],
    ['concluido', 'Concluído', 'bg-status-concluido text-status-concluido-foreground'],
    [
      'nao_compareceu',
      'Não compareceu',
      'bg-status-nao-compareceu text-status-nao-compareceu-foreground',
    ],
    ['cancelado', 'Cancelado', 'bg-status-cancelado text-status-cancelado-foreground'],
  ] as const;

  it.each(casos)('%s tem ícone, rótulo e classe de token', (status, label, className) => {
    const meta = statusMeta[status];
    expect(meta.icon).toBeTruthy();
    expect(meta.label).toBe(label);
    expect(meta.className).toBe(className);
  });
});
