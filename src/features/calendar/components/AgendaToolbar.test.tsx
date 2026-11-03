import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgendaToolbar } from './AgendaToolbar';
import type { AgendaView } from '../useAgendaParams';

function setup(
  view: AgendaView,
  date: string,
  weekStartsOn: 0 | 1 = 1,
  visibleDays?: string[] | null,
) {
  const onDate = vi.fn();
  render(
    <AgendaToolbar
      view={view}
      date={date}
      today="2026-10-29"
      status={null}
      weekStartsOn={weekStartsOn}
      visibleDays={visibleDays}
      onView={() => {}}
      onDate={onDate}
      onStatus={() => {}}
    />,
  );
  return onDate;
}

describe('AgendaToolbar (semana e mês)', () => {
  it('semana: navegação de 7 dias; sem colunas informadas o título cobre os 7 dias', async () => {
    const onDate = setup('semana', '2026-10-29');
    expect(screen.getByText('26 de outubro a 1 de novembro de 2026')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Próxima semana' }));
    expect(onDate).toHaveBeenLastCalledWith('2026-11-05');
    await userEvent.click(screen.getByRole('button', { name: 'Semana anterior' }));
    expect(onDate).toHaveBeenLastCalledWith('2026-10-22');
  });

  it('semana: o título vem dos dias visíveis (seg–sáb, domingo fechado)', () => {
    setup('semana', '2026-10-29', 1, ['2026-10-26', '2026-10-27', '2026-10-31']);
    expect(screen.getByText('26 a 31 de outubro de 2026')).toBeInTheDocument();
  });

  it('semana: dias visíveis que cruzam meses', () => {
    setup('semana', '2026-10-01', 1, ['2026-09-29', '2026-10-04']);
    expect(screen.getByText('29 de setembro a 4 de outubro de 2026')).toBeInTheDocument();
  });

  it('semana: cruzando o ano mostra os dois anos', () => {
    setup('semana', '2026-12-30', 1, ['2026-12-28', '2027-01-03']);
    expect(screen.getByText('28 de dezembro de 2026 a 3 de janeiro de 2027')).toBeInTheDocument();
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
