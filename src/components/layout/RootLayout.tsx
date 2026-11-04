import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { PageFallback } from './PageFallback';
import { OfflineBanner } from './OfflineBanner';

/** Raiz de todas as rotas: aviso de conexão visível também nas telas públicas. */
export function RootLayout() {
  return (
    <>
      <OfflineBanner />
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </>
  );
}
