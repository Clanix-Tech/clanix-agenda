import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { createQueryClient } from '@/lib/queryClient';
import { handleSessionExpired } from '@/lib/sessionExpiry';
import { supabase } from '@/lib/supabase';
import { routes } from '@/routes';

const router = createBrowserRouter(routes);
const queryClient = createQueryClient(() =>
  handleSessionExpired(router, () => supabase.auth.signOut()),
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
