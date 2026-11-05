// Lógica da Edge Function send-reminders, sem Deno nem rede: tudo vem por `deps`.
// Testada pelo Vitest; index.ts só liga as dependências reais.
import type { PushPayload, PushTarget, SendResult } from '../_shared/webpush.ts';

/** Linha de `public.due_reminders`. */
export type Due = {
  appointment_id: string;
  owner_id: string;
  starts_at: string;
  title: string;
  body: string;
  url: string;
};

/** Erros lançados pelas deps vão para o log: a mensagem não pode ter dados pessoais. */
export type SendRemindersDeps = {
  cronSecret: string;
  now(): Date;
  due(now: Date): Promise<Due[]>;
  claim(id: string, startsAt: string): Promise<boolean>;
  release(id: string, startsAt: string): Promise<void>;
  targets(ownerId: string): Promise<PushTarget[]>;
  send(t: PushTarget, p: PushPayload): Promise<SendResult>;
  removeTargets(ids: string[]): Promise<void>;
  /** Zera as falhas de quem recebeu, soma falha a quem recusou de vez; devolve quantos foram apagados. */
  recordResults(okIds: string[], failedIds: string[]): Promise<number>;
};

type Counts = { sent: number; removed: number; failed: number };

/** No máximo este número de lembretes processados ao mesmo tempo. */
export const REMINDER_CONCURRENCY = 5;

const TEMPORARY_FAILURE: SendResult = { ok: false, gone: false };

export async function handleSendReminders(
  req: Request,
  deps: SendRemindersDeps,
): Promise<Response> {
  if (!(await secretMatches(req.headers.get('x-cron-secret'), deps.cronSecret))) {
    return json({ error: 'nao_autorizado' }, 401);
  }

  let due: Due[];
  try {
    due = await deps.due(deps.now());
  } catch (error) {
    console.error(JSON.stringify({ evento: 'falha_ao_buscar_lembretes', erro: errorKind(error) }));
    return json({ error: 'falha_interna' }, 500);
  }

  const total: Counts = { sent: 0, removed: 0, failed: 0 };
  let next = 0;
  const worker = async () => {
    while (next < due.length) {
      const reminder = due[next++]!;
      const counts = await processReminder(reminder, deps);
      total.sent += counts.sent;
      total.removed += counts.removed;
      total.failed += counts.failed;
    }
  };
  await Promise.all(Array.from({ length: Math.min(REMINDER_CONCURRENCY, due.length) }, worker));

  if (due.length > 0) {
    console.info(JSON.stringify({ evento: 'lembretes_processados', due: due.length, ...total }));
  }
  return json({ due: due.length, ...total }, 200);
}

async function processReminder(reminder: Due, deps: SendRemindersDeps): Promise<Counts> {
  const { appointment_id: id, starts_at: startsAt } = reminder;
  // Reserva at-most-once: outra execução (ou o mesmo minuto duas vezes) já ficou com ele.
  let claimed: boolean;
  try {
    claimed = await deps.claim(id, startsAt);
  } catch (error) {
    logFailure('falha_ao_reservar', id, error);
    return { sent: 0, removed: 0, failed: 1 };
  }
  if (!claimed) return { sent: 0, removed: 0, failed: 0 };

  let targets: PushTarget[];
  try {
    targets = await deps.targets(reminder.owner_id);
  } catch (error) {
    logFailure('falha_ao_buscar_aparelhos', id, error);
    await bestEffort('falha_ao_liberar_reserva', id, () => deps.release(id, startsAt));
    return { sent: 0, removed: 0, failed: 1 };
  }

  const payload: PushPayload = {
    title: reminder.title,
    body: reminder.body,
    url: reminder.url,
    tag: `lembrete-${id}`,
  };
  const results = await Promise.all(
    targets.map((t) => deps.send(t, payload).catch(() => TEMPORARY_FAILURE)),
  );

  const delivered: string[] = [];
  const gone: string[] = [];
  const permanent: string[] = [];
  let failed = 0;
  results.forEach((result, i) => {
    const targetId = targets[i]!.id;
    if (result.ok) delivered.push(targetId);
    else if (result.gone) gone.push(targetId);
    else if (result.permanent) {
      permanent.push(targetId);
      failed += 1;
    } else failed += 1;
  });

  // Manutenção dos aparelhos não pode desfazer um envio que já aconteceu.
  if (gone.length > 0) {
    await bestEffort('falha_ao_remover_aparelhos', id, () => deps.removeTargets(gone));
  }
  let deleted = 0;
  if (delivered.length > 0 || permanent.length > 0) {
    try {
      deleted = await deps.recordResults(delivered, permanent);
    } catch (error) {
      logFailure('falha_ao_registrar_resultados', id, error);
    }
  }
  // Ninguém recebeu e houve falha (temporária ou permanente): devolve a reserva para o próximo minuto.
  // Aparelhos sumidos (404/410) não contam: não há para quem tentar de novo.
  if (delivered.length === 0 && failed > 0) {
    await bestEffort('falha_ao_liberar_reserva', id, () => deps.release(id, startsAt));
  }

  return { sent: delivered.length, removed: gone.length + deleted, failed };
}

async function bestEffort(event: string, id: string, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    logFailure(event, id, error);
  }
}

function logFailure(event: string, appointmentId: string, error: unknown): void {
  console.error(
    JSON.stringify({ evento: event, atendimento: appointmentId, erro: errorKind(error) }),
  );
}

/** Comparação em tempo constante: compara os SHA-256 (mesmo tamanho) byte a byte, sem atalho. */
async function secretMatches(received: string | null, expected: string): Promise<boolean> {
  if (!expected || received === null) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(received)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i]! ^ right[i]!;
  return diff === 0;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// As deps só lançam mensagens sem dados pessoais (nome da operação e código do erro).
function errorKind(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return 'desconhecido';
}
