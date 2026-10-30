import { toAppError } from '@/lib/errors';

export const PASSWORD_MIN = 8;

const WEAK = `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;

/** Erro do Supabase Auth → mensagem segura em português (nunca a mensagem crua). */
export function authErrorMessage(err: unknown): string {
  const o = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : {};
  switch (o.code) {
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Já existe uma conta com esse e-mail.';
    case 'weak_password':
      return WEAK;
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Muitas tentativas. Aguarde alguns minutos.';
  }
  if (o.status === 429) return 'Muitas tentativas. Aguarde alguns minutos.';
  return toAppError(err).message;
}

export function isRateLimited(err: unknown): boolean {
  const o = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : {};
  return (
    o.status === 429 ||
    o.code === 'over_request_rate_limit' ||
    o.code === 'over_email_send_rate_limit'
  );
}

export function isNetworkError(err: unknown): boolean {
  return toAppError(err).kind === 'rede';
}
