import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, setViewportWidth } from '@/test/render';
import { IPHONE_SAFARI_UA, installFakePush } from '@/test/fakePush';
import { AppShell } from './AppShell';
import {
  NewAppointmentProvider,
  useNewAppointment,
} from '@/features/appointments/components/NewAppointmentProvider';

const routes = [
  {
    element: <AppShell />,
    children: [{ path: '*', element: <h1>Conteúdo</h1> }],
  },
];

describe('AppShell', () => {
  it('no computador mostra a barra lateral com navegação e botão de novo agendamento', () => {
    setViewportWidth(1280);
    renderWithProviders(null, { routes, session: true });
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    for (const name of ['Início', 'Agenda', 'Histórico', 'Ajustes']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(nav).getByRole('button', { name: 'Novo agendamento' })).toBeInTheDocument();
    expect(screen.queryByTestId('bottom-nav')).not.toBeInTheDocument();
    expect(screen.getByTestId('side-rail')).toBeInTheDocument();
  });

  it('em Ajustes só um elemento marca a página atual (o avatar não)', () => {
    setViewportWidth(1280);
    renderWithProviders(null, { routes, session: true, route: '/ajustes' });
    const current = document.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName('Ajustes');
    expect(screen.getByRole('link', { name: 'Minha conta' })).not.toHaveAttribute('aria-current');
  });

  it('no celular mostra a navegação inferior', () => {
    setViewportWidth(390);
    renderWithProviders(null, { routes, session: true });
    const bottom = screen.getByTestId('bottom-nav');
    expect(bottom).toBe(screen.getByRole('navigation', { name: 'Navegação principal' }));
    for (const name of ['Início', 'Agenda', 'Histórico', 'Ajustes']) {
      expect(within(bottom).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.queryByTestId('side-rail')).not.toBeInTheDocument();
  });

  it('o botão "+" abre o formulário de novo agendamento via contexto', async () => {
    setViewportWidth(390);
    renderWithProviders(null, {
      session: true,
      routes: [
        {
          element: <AppShell renderForm={() => <p>formulário aberto</p>} />,
          children: [{ path: '*', element: <h1>Conteúdo</h1> }],
        },
      ],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Novo agendamento' }));
    expect(screen.getByText('formulário aberto')).toBeInTheDocument();
  });
});

describe('useNewAppointment', () => {
  it('abre com o prefill e renderForm recebe close()', async () => {
    function Opener() {
      const { open } = useNewAppointment();
      return (
        <button onClick={() => open({ date: '2026-11-02', startTime: '09:00' })}>abrir</button>
      );
    }
    renderWithProviders(
      <NewAppointmentProvider
        renderForm={({ prefill, close }) => (
          <div>
            form {prefill?.date} {prefill?.startTime}
            <button onClick={close}>fechar</button>
          </div>
        )}
      >
        <Opener />
      </NewAppointmentProvider>,
    );
    expect(screen.queryByText(/form/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('abrir'));
    expect(screen.getByText(/form 2026-11-02 09:00/)).toBeInTheDocument();
    await userEvent.click(screen.getByText('fechar'));
    expect(screen.queryByText(/form/)).not.toBeInTheDocument();
  });

  it('no Safari do iPhone mostra o aviso de instalação dentro do conteúdo, não por cima da navegação', async () => {
    setViewportWidth(390);
    const fake = installFakePush({ userAgent: IPHONE_SAFARI_UA });
    try {
      renderWithProviders(null, { routes, session: true });
      const banner = screen.getByRole('complementary', { name: 'Instalar o app' });
      expect(within(screen.getByRole('main')).getByText(/Instale o app/)).toBeInTheDocument();
      expect(banner).not.toHaveClass('fixed');
      expect(within(screen.getByTestId('bottom-nav')).queryByText(/Instale o app/)).toBeNull();
    } finally {
      fake.restore();
    }
  });
});
