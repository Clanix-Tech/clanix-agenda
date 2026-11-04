import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, setViewportWidth } from '@/test/render';
import { ResponsiveSheet } from './ResponsiveSheet';

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={setOpen}
      title="Novo agendamento"
      footer={<p>rodapé</p>}
    >
      <p>conteúdo</p>
    </ResponsiveSheet>
  );
}

describe('ResponsiveSheet', () => {
  it('no computador abre como diálogo e Esc fecha', async () => {
    setViewportWidth(1280);
    renderWithProviders(<Harness />);
    expect(screen.getByRole('dialog', { name: 'Novo agendamento' })).toBeInTheDocument();
    expect(screen.getByText('rodapé')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('no celular abre como gaveta com o mesmo conteúdo', () => {
    setViewportWidth(390);
    renderWithProviders(<Harness />);
    expect(screen.getByRole('dialog', { name: 'Novo agendamento' })).toBeInTheDocument();
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it.each([1280, 390])('em %i px o título é anunciado uma vez (sem descrição repetida)', (w) => {
    setViewportWidth(w);
    renderWithProviders(<Harness />);
    const dialog = screen.getByRole('dialog', { name: 'Novo agendamento' });
    expect(dialog).not.toHaveAttribute('aria-describedby');
    expect(screen.getAllByText('Novo agendamento')).toHaveLength(1);
  });
});
