// Lógica da Edge Function delete-account, sem Deno nem rede: tudo vem por `deps`.
// Só o `sub` do token verificado no servidor é apagado; nada que venha do corpo é lido.

export type DeleteAccountDeps = {
  /** `null` para token inválido ou usuário inexistente. `passwordAuthAt` = segundos (amr 'password'). */
  verify(token: string): Promise<{ userId: string; passwordAuthAt: number | null } | null>;
  deleteUser(userId: string): Promise<void>;
  now(): Date;
};

/** Quanto tempo a entrada com senha continua valendo como "senha recente". */
export const RECENT_PASSWORD_SECONDS = 300;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export async function handleDeleteAccount(
  req: Request,
  deps: DeleteAccountDeps,
): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'metodo_nao_permitido' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'nao_autenticado' }, 401);
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) return json({ error: 'nao_autenticado' }, 401);

  try {
    const identity = await deps.verify(token);
    if (!identity) return json({ error: 'nao_autenticado' }, 401);

    const nowSeconds = Math.floor(deps.now().getTime() / 1000);
    if (
      identity.passwordAuthAt === null ||
      identity.passwordAuthAt < nowSeconds - RECENT_PASSWORD_SECONDS
    ) {
      return json({ error: 'reautenticacao_necessaria' }, 403);
    }

    await deps.deleteUser(identity.userId);
    return new Response(null, { status: 204, headers: CORS });
  } catch (error) {
    // Só o nome da operação vai para o log: nunca dados da pessoa.
    console.error(
      JSON.stringify({
        evento: 'falha_ao_excluir_conta',
        erro: error instanceof Error ? error.name : 'desconhecido',
      }),
    );
    return json({ error: 'falha_ao_excluir' }, 500);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
