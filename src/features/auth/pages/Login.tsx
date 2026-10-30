import { useLocation } from 'react-router';
import { toAppError } from '@/lib/errors';

// Placeholder da Task 4; a Task 5 implementa o formulário e mantém o aviso de sessão expirada.
export default function Login() {
  const location = useLocation();
  const expired = (location.state as { reason?: string } | null)?.reason === 'sessao';
  return (
    <main>
      <h1>Entrar</h1>
      {expired && <p role="alert">{toAppError({ code: '42501' }).message}</p>}
    </main>
  );
}
