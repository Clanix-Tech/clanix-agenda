import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { createQueryClient, type ExpireRef } from '@/lib/queryClient';
import { routes } from '@/routes';

const router = createBrowserRouter(routes);
const expireRef: ExpireRef = { current: () => {} };
const queryClient = createQueryClient(expireRef);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider expireRef={expireRef}>
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
