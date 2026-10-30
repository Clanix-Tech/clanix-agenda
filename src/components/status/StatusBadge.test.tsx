import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

it.each([
  ['agendado', 'Agendado'],
  ['concluido', 'Concluído'],
  ['nao_compareceu', 'Não compareceu'],
  ['cancelado', 'Cancelado'],
] as const)('StatusBadge %s mostra texto e ícone', (status, label) => {
  render(<StatusBadge status={status} />);
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.getByText(label).parentElement?.querySelector('svg')).not.toBeNull();
});

it('StatusBadge compacto de falta mostra "Faltou"', () => {
  render(<StatusBadge status="nao_compareceu" compact />);
  expect(screen.getByText('Faltou')).toBeInTheDocument();
});
