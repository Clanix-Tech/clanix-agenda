import { expect } from '@playwright/test';

type Summary = { ID: string };
type Message = { HTML?: string; Text?: string };

function base(): string {
  const url = process.env.E2E_MAILPIT_URL;
  if (!url) throw new Error('E2E_MAILPIT_URL ausente (o global-setup não rodou?).');
  return url.replace(/\/$/, '');
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}${path}`);
  if (!res.ok) throw new Error(`Mailpit respondeu ${res.status} em ${path}`);
  return (await res.json()) as T;
}

/** Espera o e-mail mais recente enviado para `to` e devolve o link de verificação dele. */
export async function waitForAuthLink(to: string): Promise<string> {
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const query = encodeURIComponent(`to:"${to}"`);
        const res = await getJson<{ messages: Summary[] }>(`/api/v1/search?query=${query}`);
        id = res.messages[0]?.ID;
        return id;
      },
      { message: `e-mail para ${to} não chegou ao Mailpit`, timeout: 20_000 },
    )
    .toBeTruthy();
  const msg = await getJson<Message>(`/api/v1/message/${id}`);
  const html = msg.HTML ?? '';
  const href = /href="([^"]*\/auth\/v1\/verify[^"]*)"/.exec(html)?.[1];
  const fromText = /(https?:\/\/\S*\/auth\/v1\/verify\S*)/.exec(msg.Text ?? '')?.[1];
  const link = (href ?? fromText)?.replace(/&amp;/g, '&');
  if (!link) throw new Error('Link de verificação não encontrado no e-mail');
  return link;
}
