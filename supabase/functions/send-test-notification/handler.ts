// Lógica da Edge Function send-test-notification, sem Deno nem rede: tudo vem por `deps`.
// Testada pelo Vitest; index.ts só liga as dependências reais.
import type { PushPayload, PushTarget, SendResult } from '../_shared/webpush.ts';

/** Aparelhos do usuário dono do JWT, lidos e apagados com o cliente dele (sob RLS). */
export type UserDevices = {
  list(): Promise<PushTarget[]>;
  remove(ids: string[]): Promise<void>;
};

/** Erros lançados pelas deps vão para o log: a mensagem não pode ter dados pessoais. */
export type SendTestDeps = {
  /** `null` quando o header não é o JWT de um usuário (ex.: a chave anônima). */
  userDevices(authorization: string): Promise<UserDevices | null>;
  send(target: PushTarget, payload: PushPayload): Promise<SendResult>;
};

export const TEST_PAYLOAD: PushPayload = {
  title: 'Clanix Agenda',
  body: 'Notificações ativadas neste aparelho.',
  url: '/ajustes/notificacoes',
  tag: 'teste',
};

// O app chama a função de outra origem (supabase.functions.invoke) com o JWT no header.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TEMPORARY_FAILURE: SendResult = { ok: false, gone: false };

export async function handleSendTestNotification(
  req: Request,
  deps: SendTestDeps,
): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'metodo_nao_permitido' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'nao_autorizado' }, 401);

  let targets: PushTarget[];
  let devices: UserDevices | null;
  try {
    devices = await deps.userDevices(authorization);
    if (!devices) return json({ error: 'nao_autorizado' }, 401);
    targets = await devices.list();
  } catch (error) {
    console.error(JSON.stringify({ evento: 'falha_ao_buscar_aparelhos', erro: errorKind(error) }));
    return json({ error: 'falha_interna' }, 500);
  }

  // Sem limite de frequência: só alcança os aparelhos do próprio usuário.
  const results = await Promise.all(
    targets.map((t) => deps.send(t, TEST_PAYLOAD).catch(() => TEMPORARY_FAILURE)),
  );
  const gone = targets.filter((_t, i) => {
    const result = results[i]!;
    return !result.ok && result.gone;
  });
  const sent = results.filter((r) => r.ok).length;

  let removed = 0;
  if (gone.length > 0) {
    try {
      await devices.remove(gone.map((t) => t.id));
      removed = gone.length;
    } catch (error) {
      // A notificação já foi enviada (ou não) para os outros aparelhos: não vira erro.
      console.error(
        JSON.stringify({ evento: 'falha_ao_remover_aparelhos', erro: errorKind(error) }),
      );
    }
  }

  return json({ sent, removed }, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// As deps só lançam mensagens sem dados pessoais (nome da operação e código do erro).
function errorKind(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return 'desconhecido';
}
