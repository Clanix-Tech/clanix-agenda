import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Shift } from '@/features/appointments/domain/freeSlots';
import { DEFAULT_SHIFTS } from '../domain/defaultHours';
import { HoursEditor } from './HoursEditor';

function Harness({
  initial,
  variant,
  spy,
}: {
  initial: Shift[];
  variant: 'compact' | 'full';
  spy?: (s: Shift[]) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <HoursEditor
      variant={variant}
      value={value}
      onChange={(s) => {
        spy?.(s);
        setValue(s);
      }}
    />
  );
}

describe('HoursEditor full', () => {
  it('mostra Domingo como Fechado e turnos editáveis', () => {
    const { container } = render(<Harness initial={DEFAULT_SHIFTS} variant="full" />);
    expect(container.querySelector('[data-day="0"]')).toHaveTextContent('Fechado');
    expect(screen.getByLabelText('Início do turno 1 de Segunda')).toHaveValue('09:00');
    expect(screen.getByLabelText('Fim do turno 2 de Segunda')).toHaveValue('18:00');
    expect(screen.getByLabelText('Início do turno 1 de Segunda')).toHaveAttribute('step', '300');
  });

  it('recusa turno que sobrepõe outro do mesmo dia', async () => {
    render(
      <Harness initial={[{ weekday: 1, start_time: '09:00', end_time: '12:00' }]} variant="full" />,
    );
    await userEvent.click(screen.getByRole('button', { name: '+ Turno em Segunda' }));
    const start = screen.getByLabelText('Início do turno 2 de Segunda');
    const end = screen.getByLabelText('Fim do turno 2 de Segunda');
    await userEvent.clear(start);
    await userEvent.type(start, '11:00');
    await userEvent.clear(end);
    await userEvent.type(end, '14:00');
    expect(screen.getByText('Turnos não podem se sobrepor')).toBeInTheDocument();
  });

  it('fim antes do início mostra mensagem', async () => {
    render(
      <Harness initial={[{ weekday: 1, start_time: '09:00', end_time: '12:00' }]} variant="full" />,
    );
    const end = screen.getByLabelText('Fim do turno 1 de Segunda');
    await userEvent.clear(end);
    await userEvent.type(end, '08:00');
    expect(screen.getByText('O fim precisa ser depois do início')).toBeInTheDocument();
  });

  it('liga o dia com 09:00–18:00 e remove turno', async () => {
    const spy = vi.fn();
    render(<Harness initial={[]} variant="full" spy={spy} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Atender em Domingo' }));
    expect(spy).toHaveBeenLastCalledWith([{ weekday: 0, start_time: '09:00', end_time: '18:00' }]);
    await userEvent.click(screen.getByRole('button', { name: 'Remover turno 1 de Domingo' }));
    expect(spy).toHaveBeenLastCalledWith([]);
  });

  it('limita a 21 turnos', () => {
    const many: Shift[] = Array.from({ length: 21 }, (_, i) => ({
      weekday: Math.floor(i / 3),
      start_time: ['06:00', '10:00', '14:00'][i % 3]!,
      end_time: ['08:00', '12:00', '16:00'][i % 3]!,
    }));
    render(<Harness initial={many} variant="full" />);
    expect(screen.getByText('Máximo de 21 turnos')).toBeInTheDocument();
    for (const b of screen.getAllByRole('button', { name: /^\+ Turno em/ }))
      expect(b).toBeDisabled();
  });

  it('o horário nunca passa de 23:59', () => {
    render(<Harness initial={DEFAULT_SHIFTS} variant="full" />);
    expect(screen.getByLabelText('Fim do turno 2 de Segunda')).toHaveAttribute('max', '23:59');
  });
});

describe('HoursEditor compact', () => {
  it('resume cada dia e abre a edição ao tocar', async () => {
    render(<Harness initial={DEFAULT_SHIFTS} variant="compact" />);
    const seg = screen.getByRole('button', { name: /Seg/ });
    expect(within(seg).getByText('09:00–12:00 · 13:00–18:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dom/ })).toHaveTextContent('Fechado');
    expect(screen.queryByLabelText('Início do turno 1 de Segunda')).not.toBeInTheDocument();
    await userEvent.click(seg);
    expect(screen.getByLabelText('Início do turno 1 de Segunda')).toBeInTheDocument();
  });
});
