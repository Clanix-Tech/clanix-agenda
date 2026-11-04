import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { AppToaster } from './AppToaster';
import { UpdatePrompt } from './UpdatePrompt';

const sw = vi.hoisted(() => ({
  needRefresh: false,
  update: vi.fn(),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: sw.update,
  }),
}));

function renderPrompt() {
  render(
    <>
      <AppToaster />
      <UpdatePrompt />
    </>,
  );
}

describe('UpdatePrompt', () => {
  beforeEach(() => {
    sw.update.mockReset();
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => toast.dismiss());

  it('com versão nova mostra o aviso e "Atualizar" chama updateServiceWorker(true)', async () => {
    sw.needRefresh = true;
    renderPrompt();
    expect(await screen.findByText('Nova versão disponível')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(sw.update).toHaveBeenCalledWith(true);
  });

  it('sem versão nova não mostra nada', () => {
    sw.needRefresh = false;
    renderPrompt();
    expect(screen.queryByText('Nova versão disponível')).not.toBeInTheDocument();
  });
});
