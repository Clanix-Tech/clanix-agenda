// Envio Web Push (RFC 8030/8291) com VAPID (RFC 8292). Roda só no Deno (Edge Function);
// o Vitest nunca importa este arquivo em tempo de execução (handler.ts usa `import type`).
import webpush from 'npm:web-push@3.6.7';
import { withDeadline } from './deadline.ts';

/** Uma assinatura (aparelho) do profissional, como gravada em `push_subscriptions`. */
export type PushTarget = { id: string; endpoint: string; p256dh: string; auth: string };

/** Conteúdo lido pelo service worker. */
export type PushPayload = { title: string; body: string; url: string; tag: string };

/** `gone`: o serviço de push respondeu 404/410 (assinatura expirada ou cancelada). */
export type SendResult = { ok: true } | { ok: false; gone: boolean };

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

const TTL_SECONDS = 3600;
/** Tempo ocioso do socket (web-push). Não mede o tempo total: por isso há também o prazo abaixo. */
const SOCKET_TIMEOUT_MS = 8_000;
/** Prazo total do envio; estourou = falha temporária (a reserva é liberada). */
const TOTAL_DEADLINE_MS = 9_000;

export async function sendPush(
  target: PushTarget,
  payload: PushPayload,
  vapid: VapidConfig,
): Promise<SendResult> {
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
  });
  try {
    const sending = webpush
      .sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        body,
        {
          vapidDetails: {
            subject: vapid.subject,
            publicKey: vapid.publicKey,
            privateKey: vapid.privateKey,
          },
          TTL: TTL_SECONDS,
          urgency: 'high',
          timeout: SOCKET_TIMEOUT_MS,
        },
      )
      .then((): SendResult => ({ ok: true }));
    // O envio abandonado pode rejeitar depois do prazo: sem isso viraria rejeição não tratada.
    sending.catch(() => {});
    return await withDeadline<SendResult>(sending, TOTAL_DEADLINE_MS, {
      ok: false,
      gone: false,
    });
  } catch (error) {
    const status = statusOf(error);
    // Só id do aparelho, status HTTP e tipo do erro: nada do endpoint nem do conteúdo.
    console.warn(
      JSON.stringify({
        evento: 'push_falhou',
        aparelho: target.id,
        status: status ?? null,
        erro: errorKind(error),
      }),
    );
    return { ok: false, gone: status === 404 || status === 410 };
  }
}

function statusOf(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const status = (error as { statusCode: unknown }).statusCode;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

function errorKind(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string') return name;
  }
  return 'desconhecido';
}
