import { execSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database.ts';

export interface LocalEnv {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

interface SupabaseStatus {
  API_URL?: string;
  PUBLISHABLE_KEY?: string;
  ANON_KEY?: string;
  SECRET_KEY?: string;
  SERVICE_ROLE_KEY?: string;
}

let cachedEnv: LocalEnv | undefined;

/** Lê URL e chaves do Supabase local em tempo de execução (nunca de arquivo versionado). */
export function getLocalEnv(): LocalEnv {
  if (cachedEnv) return cachedEnv;
  const raw = execSync('npx supabase status -o json', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const status = JSON.parse(raw.slice(start, end + 1)) as SupabaseStatus;
  const url = status.API_URL;
  const anonKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
  const serviceRoleKey = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error('Supabase local indisponível: rode `npm run db:start`.');
  }
  cachedEnv = { url, anonKey, serviceRoleKey };
  return cachedEnv;
}

const noSession = { persistSession: false, autoRefreshToken: false } as const;

/** Cria usuário (e-mail confirmado) pela API admin e devolve um cliente autenticado. */
export async function createTestUser(
  email: string,
): Promise<{ id: string; client: SupabaseClient<Database> }> {
  const { url, anonKey, serviceRoleKey } = getLocalEnv();
  const password = `${crypto.randomUUID()}${crypto.randomUUID()}`;

  const admin = createClient<Database>(url, serviceRoleKey, { auth: noSession });
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    throw new Error(`Falha ao criar usuário de teste: ${created.error?.message}`);
  }

  const client = createClient<Database>(url, anonKey, { auth: noSession });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) {
    throw new Error(`Falha ao autenticar usuário de teste: ${signedIn.error.message}`);
  }
  return { id: created.data.user.id, client };
}

/** Expediente padrão: segunda a sexta, 09–12 e 13–18. */
export async function setDefaultHours(client: SupabaseClient<Database>): Promise<void> {
  const shifts = [1, 2, 3, 4, 5].flatMap((weekday) => [
    { weekday, start_time: '09:00', end_time: '12:00' },
    { weekday, start_time: '13:00', end_time: '18:00' },
  ]);
  const { error } = await client.rpc('set_business_hours', { p_shifts: shifts });
  if (error) throw new Error(`Falha ao definir expediente: ${error.message}`);
}

/** Deslocamento do fuso (ex.: "-03:00") em um instante, via Intl. */
function offsetAt(instant: Date, tz: string): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(instant)
    .find((p) => p.type === 'timeZoneName')?.value;
  const match = /GMT([+-]\d{2}:\d{2})/.exec(part ?? '');
  return match?.[1] ?? '+00:00';
}

/** Próxima segunda-feira (nunca hoje) no horário `hhmm` do fuso, como ISO com offset explícito. */
export function nextMondayAt(hhmm: string, tz = 'America/Sao_Paulo', now = new Date()): string {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) throw new Error(`Horário inválido: ${hhmm}`);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekday = weekdays.indexOf(get('weekday'));
  const daysAhead = (1 - weekday + 7) % 7 || 7;

  const local = new Date(
    Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day'))),
  );
  local.setUTCDate(local.getUTCDate() + daysAhead);
  const date = local.toISOString().slice(0, 10);

  // o offset é avaliado no meio-dia UTC da data-alvo (fusos sem horário de verão nesse caso)
  const offset = offsetAt(new Date(`${date}T12:00:00Z`), tz);
  return `${date}T${hhmm}:00${offset}`;
}
