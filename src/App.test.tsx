import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('@/lib/supabase', async () => {
  const { createFakeSupabase } = await import('@/test/fakeSupabase');
  return { supabase: createFakeSupabase() };
});

import App from './App';

it('sem sessão, o app abre na tela Entrar', async () => {
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
});
