import { supabase } from '@/lib/supabase';
import { toAppError } from '@/lib/errors';

export type DeleteAccountErrorKind = 'senha' | 'rede' | 'falha';

export class DeleteAccountError extends Error {
  readonly kind: DeleteAccountErrorKind;
  constructor(kind: DeleteAccountErrorKind) {
    super(kind);
    this.name = 'DeleteAccountError';
    this.kind = kind;
  }
}

export type DeleteAccountInput = {
  email: string;
  password: string;
  captchaToken: string | null;
};

function field(err: unknown, key: string): unknown {
  return typeof err === 'object' && err !== null
    ? (err as Record<string, unknown>)[key]
    : undefined;
}

/** O Auth confirma que o usuário já não existe (token de uma conta apagada). */
function isUserGone(err: unknown): boolean {
  if (field(err, 'code') === 'user_not_found') return true;
  const message = field(err, 'message');
  return (
    field(err, 'status') === 403 &&
    typeof message === 'string' &&
    /does not exist|user_not_found/i.test(message)
  );
}

/**
 * Entra de novo com a senha (prova de que quem pede é o dono) e pede a exclusão ao servidor.
 * O servidor só apaga a conta do token e só aceita senha digitada há poucos minutos.
 */
export async function deleteAccount(input: DeleteAccountInput): Promise<void> {
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
    options: { captchaToken: input.captchaToken ?? undefined },
  });
  if (signInError) {
    if (field(signInError, 'code') === 'invalid_credentials') throw new DeleteAccountError('senha');
    throw new DeleteAccountError(toAppError(signInError).kind === 'rede' ? 'rede' : 'falha');
  }

  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (!error) return;

  if (toAppError(error).kind !== 'rede') throw new DeleteAccountError('falha');

  // A resposta pode ter se perdido depois de a conta já ter sido apagada.
  const { error: userError } = await supabase.auth.getUser();
  if (userError && isUserGone(userError)) return;
  throw new DeleteAccountError('rede');
}
