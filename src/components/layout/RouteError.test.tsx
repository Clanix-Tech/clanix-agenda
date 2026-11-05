import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { routes } from '@/routes';
import { RouteError } from './RouteError';

describe('RouteError', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mostra a mensagem e "Recarregar" recarrega a página', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(<RouteError />);
    expect(screen.getByText('Não foi possível carregar esta tela.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Recarregar' }));
    expect(reload).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('a rota raiz tem errorElement e ele aparece quando a parte da página não carrega', async () => {
    expect(routes[0]?.errorElement).toBeTruthy();
    const router = createMemoryRouter([
      {
        element: <div />,
        errorElement: routes[0]?.errorElement,
        children: [
          {
            path: '*',
            lazy: async () => {
              throw new TypeError('Importing a module script failed.');
            },
          },
        ],
      },
    ]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<RouterProvider router={router} />);
    expect(await screen.findByText('Não foi possível carregar esta tela.')).toBeInTheDocument();
  });
});
