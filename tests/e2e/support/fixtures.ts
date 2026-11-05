import { randomUUID } from 'node:crypto';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/types/database.ts';
import { readLocalStatus } from './localStatus.ts';
import { TZ, toInstant } from './dates.ts';

type Client = SupabaseClient<Database>;
type Status = Database['public']['Enums']['appointment_status'];

export type TestUser = {
  id: string;
  email: string;
  password: string;
  name: string;
  /** Cliente autenticado como o próprio usuário (chave publicável), só no Node. */
  client: Client;
};

export type UserOptions = {
  name?: string;
  /** Expediente padrão seg–sex 09–12 e 13–18 (padrão: sim). */
  hours?: boolean;
  favorites?: Array<{ name: string; duration_minutes: number }>;
};

export type SeedAppointment = {
  date: string;
  start: string;
  end: string;
  name: string;
  service?: string;
  phone?: string;
  notes?: string;
  status?: Status;
  cancelReason?: string;
};

const noSession = { persistSession: false, autoRefreshToken: false } as const;

function env() {
  const { E2E_SUPABASE_URL, E2E_SUPABASE_PUBLISHABLE_KEY, E2E_SUPABASE_SECRET_KEY } = process.env;
  if (E2E_SUPABASE_URL && E2E_SUPABASE_PUBLISHABLE_KEY && E2E_SUPABASE_SECRET_KEY) {
    return {
      url: E2E_SUPABASE_URL,
      publishableKey: E2E_SUPABASE_PUBLISHABLE_KEY,
      secretKey: E2E_SUPABASE_SECRET_KEY,
    };
  }
  const s = readLocalStatus();
  return { url: s.url, publishableKey: s.publishableKey, secretKey: s.secretKey };
}

let adminClient: Client | undefined;
/** Cliente com a chave secreta: existe só no processo Node do teste. */
export function admin(): Client {
  adminClient ??= createClient<Database>(env().url, env().secretKey, { auth: noSession });
  return adminClient;
}

const DEFAULT_SHIFTS = [1, 2, 3, 4, 5].flatMap((weekday) => [
  { weekday, start_time: '09:00', end_time: '12:00' },
  { weekday, start_time: '13:00', end_time: '18:00' },
]);

async function createUser(slug: string, opts: UserOptions): Promise<TestUser> {
  const email = uniqueEmail(slug);
  const password = `Senha-${randomUUID()}`;
  const name = opts.name ?? 'Ana Teste';
  const created = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (created.error || !created.data.user) {
    throw new Error(`Falha ao criar usuário de teste: ${created.error?.message}`);
  }
  const { url, publishableKey } = env();
  const client = createClient<Database>(url, publishableKey, { auth: noSession });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw new Error(`Falha ao autenticar: ${signedIn.error.message}`);

  if (opts.hours ?? true) {
    const { error } = await client.rpc('set_business_hours', { p_shifts: DEFAULT_SHIFTS });
    if (error) throw new Error(`Falha ao definir expediente: ${error.message}`);
  }
  if (opts.favorites?.length) {
    const { error } = await client.from('favorite_services').insert(opts.favorites);
    if (error) throw new Error(`Falha ao criar favoritos: ${error.message}`);
  }
  return { id: created.data.user.id, email, password, name, client };
}

/** Cria um agendamento pelas RPCs do próprio usuário (mesmo caminho do app) e aplica o status. */
export async function seedAppointment(user: TestUser, a: SeedAppointment): Promise<string> {
  const startsAt = toInstant(a.date, a.start, TZ);
  const { data, error } = await user.client.rpc('create_appointment', {
    p_client_name: a.name,
    p_service_name: a.service ?? 'Corte feminino',
    p_starts_at: startsAt,
    p_ends_at: toInstant(a.date, a.end, TZ),
    p_client_phone: a.phone,
    p_notes: a.notes,
    p_confirm_past: Date.parse(startsAt) < Date.now(),
  });
  if (error || !data) throw new Error(`Falha ao criar agendamento: ${error?.message}`);
  const id = (data as { id: string }).id;
  const status = a.status;
  if (status === 'cancelado') {
    const res = await user.client.rpc('cancel_appointment', {
      p_id: id,
      p_reason: a.cancelReason ?? 'Cliente pediu para desmarcar',
    });
    if (res.error) throw new Error(`Falha ao cancelar: ${res.error.message}`);
  } else if (status && status !== 'agendado') {
    const res = await user.client.rpc('set_appointment_status', { p_id: id, p_status: status });
    if (res.error) throw new Error(`Falha ao mudar status: ${res.error.message}`);
  }
  return id;
}

/** Quantos agendamentos o usuário tem no banco (consulta com a chave secreta, no Node). */
export async function countAppointments(ownerId: string): Promise<number> {
  const { count, error } = await admin()
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId);
  if (error) throw new Error(`Falha ao contar agendamentos: ${error.message}`);
  return count ?? 0;
}

type Fixtures = {
  /** Cria um usuário isolado para o teste (removido ao final). */
  makeUser: (opts?: UserOptions) => Promise<TestUser>;
};

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern -- assinatura exigida pelo Playwright
  makeUser: async ({}, provide, testInfo) => {
    const created: TestUser[] = [];
    await provide(async (opts = {}) => {
      const user = await createUser(testInfo.project.name, opts);
      created.push(user);
      return user;
    });
    for (const u of created) await deleteUser(u.id);
  },
});

export async function deleteUser(id: string): Promise<void> {
  const { error } = await admin().auth.admin.deleteUser(id);
  // Testes que excluem a própria conta pela tela deixam o usuário já inexistente.
  if (error && error.code !== 'user_not_found') {
    throw new Error(`Falha ao remover usuário de teste: ${error.message}`);
  }
}

/** Remove um usuário criado pela própria tela de cadastro (procura pelo e-mail). */
export async function deleteUserByEmail(email: string): Promise<void> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Falha ao listar usuários: ${error.message}`);
    const found = data.users.find((u) => u.email === email);
    if (found) return deleteUser(found.id);
    if (data.users.length < 1000) return;
  }
}

/** E-mail único por teste e projeto. */
export function uniqueEmail(slug: string): string {
  return `e2e-${slug}-${randomUUID().slice(0, 12)}@example.com`;
}

export { expect };

/** Navegação principal: barra lateral no computador, barra inferior no celular. */
export function mainNav(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Navegação principal' });
}

export function isDesktop(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 1024;
}

/** Entra pela tela "Entrar", como uma pessoa faria. */
export async function login(page: Page, user: Pick<TestUser, 'email' | 'password'>) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
}

/** Painel de detalhes (gaveta no celular, janela no computador). */
export function detailsSheet(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Detalhes do atendimento' });
}
