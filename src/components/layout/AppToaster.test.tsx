import { act, render } from '@testing-library/react';
import { toast } from 'sonner';
import { setViewportWidth } from '@/test/render';
import { AppToaster, MOBILE_TOAST_BOTTOM } from './AppToaster';

async function showToast() {
  render(<AppToaster />);
  act(() => {
    toast.success('Agendamento salvo');
  });
  const el = await vi.waitFor(() => {
    const t = document.querySelector<HTMLElement>('[data-sonner-toaster]');
    if (!t) throw new Error('sem toaster');
    return t;
  });
  return el;
}

describe('AppToaster', () => {
  afterEach(() => toast.dismiss());

  it('no celular o aviso fica acima da navegação inferior', async () => {
    setViewportWidth(390);
    const el = await showToast();
    expect(el.style.getPropertyValue('--mobile-offset-bottom')).toBe(MOBILE_TOAST_BOTTOM);
    // Entre 600 e 1023 px o sonner usa o offset "normal": também precisa subir.
    expect(el.style.getPropertyValue('--offset-bottom')).toBe(MOBILE_TOAST_BOTTOM);
  });

  it('no computador (sem navegação inferior) mantém a posição padrão', async () => {
    setViewportWidth(1440);
    const el = await showToast();
    expect(el.style.getPropertyValue('--offset-bottom')).not.toBe(MOBILE_TOAST_BOTTOM);
  });
});
