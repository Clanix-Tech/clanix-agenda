import { exec } from 'node:child_process';
import { createECDH, randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { admin, expect, login, test } from './support/fixtures.ts';
import { TZ } from './support/dates.ts';
import { expectNoHorizontalScroll } from './support/layout.ts';
import { hasLocalFunctionsEnv, readLocalVapidPublicKey } from './support/localStatus.ts';

const onlyIn = (project: string) => test.info().project.name !== project;

test('iPhone sem instalar: guia de 3 passos, sem "Ativar" e teste desabilitado', async ({
  page,
  makeUser,
}) => {
  test.skip(onlyIn('webkit-iphone'), 'cenário do Safari no iPhone');
  test.skip(
    !readLocalVapidPublicKey(),
    'sem supabase/functions/.env o app mostra "lembretes não configurados": rode `npm run vapid:gerar`',
  );
  const user = await makeUser();
  await login(page, user);
  await page.goto('/ajustes/notificacoes');

  const guide = page.getByRole('region', {
    name: 'No iPhone, instale o app para receber lembretes',
  });
  await expect(guide).toBeVisible();
  await expect(guide.getByRole('listitem')).toHaveText([
    /toque em Compartilhar/,
    /Adicionar à Tela de Início/,
    /Abra o Clanix Agenda pelo ícone e volte aqui para ativar/,
  ]);
  await expect(page.getByRole('button', { name: 'Ativar neste aparelho' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enviar notificação de teste' })).toBeDisabled();
  await expect(page.getByText('Disponível depois de ativar neste aparelho.')).toBeVisible();
});

test('antecedência "1 hora" e "Ocultar nome" gravam no perfil e mudam a prévia', async ({
  page,
  makeUser,
}) => {
  test.skip(onlyIn('chromium-desktop'), 'preferência do perfil: basta um navegador');
  const user = await makeUser();
  await login(page, user);
  await page.goto('/ajustes/notificacoes');

  // O rádio fica visualmente oculto dentro do rótulo: toca-se no rótulo, como uma pessoa faria.
  const lead = page.getByRole('group', { name: 'Lembrar antes do atendimento' });
  await lead.getByText('1 hora', { exact: true }).click();
  await expect(lead.getByRole('radio', { name: '1 hora' })).toBeChecked();
  await page.getByRole('switch', { name: 'Ocultar nome do cliente na tela de bloqueio' }).click();

  await expect
    .poll(async () => {
      const { data, error } = await admin()
        .from('profiles')
        .select('reminder_minutes, hide_client_name_in_notifications')
        .eq('id', user.id)
        .single();
      if (error) throw new Error(`Falha ao ler o perfil: ${error.message}`);
      return data;
    })
    .toEqual({ reminder_minutes: 60, hide_client_name_in_notifications: true });

  const preview = page.getByRole('group', { name: 'Prévia do lembrete' });
  await expect(preview.getByText('Lembrete de atendimento')).toBeVisible();
  await expect(
    preview.getByText('Atendimento às 14:00 · em 1 hora', { exact: true }),
  ).toBeVisible();
  await expect(preview).not.toContainText('Juliana');
});

test('/instalar sem login abre e não rola na horizontal', async ({ page }) => {
  await page.goto('/instalar');
  await expect(page.getByRole('heading', { name: 'Instalar o app' })).toBeVisible();
  await expectNoHorizontalScroll(page);
  for (const name of ['iPhone', 'Android', 'Computador']) {
    await page.getByRole('tab', { name }).click();
    await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
    await expectNoHorizontalScroll(page);
  }
});

// ---- Lembrete de ponta a ponta: pg_cron → pg_net → Edge Function → banco ----

const execAsync = promisify(exec);
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CLIENT = 'Cliente Lembrete E2E';
const SERVICE = 'Corte feminino';

type HttpResponse = { status_code: number | null; content: string | null };
type SendRemindersBody = { due?: number; sent?: number; removed?: number; failed?: number };

/**
 * Respostas que o pg_net guardou desde `since` (instante do banco). O schema `net` não passa pela
 * API: a consulta vai direto ao banco local pela CLI (`supabase db query --local`).
 */
async function pgNetResponsesSince(since: string): Promise<HttpResponse[]> {
  const sql = `select status_code, content from net._http_response where created >= '${since}' order by id`;
  const { stdout } = await execAsync(`npx supabase db query --local -o json "${sql}"`, {
    cwd: REPO_ROOT,
  });
  const json = stdout.slice(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1);
  return (JSON.parse(json) as { rows: HttpResponse[] }).rows;
}

/** A send-reminders respondeu 200 depois de reservar um lembrete devido e falhar o envio. */
function claimedAndFailed(r: HttpResponse): boolean {
  if (r.status_code !== 200 || !r.content) return false;
  const body = JSON.parse(r.content) as SendRemindersBody;
  return (body.due ?? 0) >= 1 && (body.failed ?? 0) >= 1;
}

/** Chaves de assinatura Web Push válidas (P-256 + 16 bytes), para o envio chegar à rede. */
function subscriptionKeys(): { p256dh: string; auth: string } {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    p256dh: ecdh.getPublicKey().toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  };
}

function hhmm(instant: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
}

test('cron de lembretes: aparelho inalcançável → reserva feita, envio falha e reserva liberada', async ({
  makeUser,
}) => {
  test.skip(onlyIn('chromium-desktop'), 'roda só no Node: basta uma vez');
  test.skip(
    !hasLocalFunctionsEnv(),
    'sem supabase/functions/.env não há CRON_SECRET nem Vault configurado: rode `npm run vapid:gerar` e reinicie a pilha local',
  );
  test.setTimeout(180_000);

  const user = await makeUser({ hours: false });
  const profile = await admin().from('profiles').update({ reminder_minutes: 15 }).eq('id', user.id);
  expect(profile.error).toBeNull();

  // Aparelho registrado pelo mesmo caminho do app, com um endpoint que nunca responde.
  const keys = subscriptionKeys();
  const registered = await user.client.rpc('register_push_subscription', {
    p_endpoint: `https://push.invalid/${randomUUID()}`,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_device_label: 'e2e · push.invalid',
  });
  expect(registered.error).toBeNull();
  const device = await admin()
    .from('push_subscriptions')
    .select('created_at')
    .eq('id', registered.data!)
    .single();
  expect(device.error).toBeNull();
  // Relógio do banco (o do cron), não o desta máquina.
  const dbNow = new Date(device.data!.created_at);

  // O aviso (15 min antes) cai na próxima virada de minuto com folga de 10 s: entra na janela em
  // até ~1 min, e a âncora do aviso (agora, na criação) fica antes dele.
  const tick = new Date(Math.ceil((dbNow.getTime() + 10_000) / 60_000) * 60_000);
  const startsAt = new Date(tick.getTime() + 15 * 60_000);
  const appointment = await admin()
    .from('appointments')
    .insert({
      owner_id: user.id,
      client_name: CLIENT,
      service_name: SERVICE,
      starts_at: startsAt.toISOString(),
      ends_at: new Date(startsAt.getTime() + 30 * 60_000).toISOString(),
    })
    .select('id')
    .single();
  expect(appointment.error).toBeNull();
  const id = appointment.data!.id;

  // O banco só considera o lembrete devido a partir da virada (consulta sem efeito colateral;
  // sem instante, vale o `now()` do banco).
  const dueAt = async (instant?: Date) => {
    const args = instant ? { p_now: instant.toISOString() } : {};
    const { data, error } = await admin().rpc('due_reminders', args);
    if (error) throw new Error(`Falha em due_reminders: ${error.message}`);
    return data.filter((d) => d.appointment_id === id);
  };
  expect(await dueAt(new Date(tick.getTime() - 1_000))).toEqual([]);
  expect(await dueAt(tick)).toEqual([
    expect.objectContaining({
      title: 'Lembrete de atendimento',
      body: `${hhmm(startsAt)} · ${CLIENT} — ${SERVICE} · em 15 min`,
      url: `/?atendimento=${id}`,
    }),
  ]);

  // O cron chamou a função pelo pg_net (URL e segredo do Vault) e ela respondeu 200 depois de
  // reservar o lembrete e falhar o envio. Com o cron parado, a URL errada ou o segredo trocado
  // (401), nenhuma resposta assim aparece e o teste falha.
  await expect
    .poll(async () => (await pgNetResponsesSince(dbNow.toISOString())).some(claimedAndFailed), {
      message:
        'nenhuma resposta 200 da send-reminders com {due ≥ 1, failed ≥ 1} em net._http_response',
      timeout: 120_000,
      intervals: [2_000],
    })
    .toBe(true);

  // Falha temporária: a reserva foi liberada (o lembrete continua devido para o próximo minuto) e
  // o aparelho continua cadastrado (só 404/410 removem).
  await expect
    .poll(async () => {
      const [reserved, due] = await Promise.all([
        admin().from('appointment_reminders').select('appointment_id').eq('appointment_id', id),
        dueAt(),
      ]);
      if (reserved.error) throw new Error(`Falha ao ler reservas: ${reserved.error.message}`);
      return { reservas: reserved.data.length, aindaDevido: due.length === 1 };
    })
    .toEqual({ reservas: 0, aindaDevido: true });
  const devices = await admin().from('push_subscriptions').select('id').eq('owner_id', user.id);
  expect(devices.data).toHaveLength(1);
});
