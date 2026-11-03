import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgendaToolbar } from './AgendaToolbar';
import type { AgendaView } from '../useAgendaParams';

function setup(view: AgendaView, date: string, weekStartsOn: 0 | 1 = 1) {
  const onDate = vi.fn();
  render(
    <AgendaToolbar
      view={view}
      date={date}
      today="2026-10-29"
      status={null}
      weekStartsOn={weekStartsOn}
      onView={() => {}}
      onDate={onDate}
      onStatus={() => {}}
    />,
  );
  return onDate;
}

describe('AgendaToolbar (semana e mês)', () => {
  it('semana: título com o intervalo e navegação de 7 dias', async () => {
    const onDate = setup('semana', '2026-10-29');
    expect(screen.getByText('26 de outubro a 1 de novembro de 2026')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Próxima semana' }));
    expect(onDate).toHaveBeenLastCalledWith('2026-11-05');
    await userEvent.click(screen.getByRole('button', { name: 'Semana anterior' }));
    expect(onDate).toHaveBeenLastCalledWith('2026-10-22');
  });

  it('semana dentro de um mês: "26 a 31 de outubro de 2026" (semana começando no domingo)', () => {
    setup('semana', '2026-10-28', 0);
    expect(screen.getByText('25 a 31 de outubro de 2026')).toBeInTheDocument();
  });

  it('mês: título e navegação de 1 mês mantendo o dia dentro do tamanho do mês', async () => {
    const onDate = setup('mes', '2026-10-31');
    expect(screen.getByText('Outubro de 2026')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(onDate).toHaveBeenLastCalledWith('2026-11-30');
    await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(onDate).toHaveBeenLastCalledWith('2026-09-30');
  });
});
