import { Outlet } from 'react-router';
import { OfflineBanner } from './OfflineBanner';

/** Raiz de todas as rotas: aviso de conexão visível também nas telas públicas. */
export function RootLayout() {
  return (
    <>
      <OfflineBanner />
      <Outlet />
    </>
  );
}
