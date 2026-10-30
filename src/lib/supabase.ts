import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getEnv } from '@/lib/env';

let client: SupabaseClient<Database> | undefined;

function getClient(): SupabaseClient<Database> {
  if (!client) {
    const { supabaseUrl, supabasePublishableKey } = getEnv();
    client = createClient<Database>(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

/** Cliente criado sob demanda no primeiro uso (importar não exige variáveis de ambiente). */
export const supabase: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_t, prop) {
    const c = getClient();
    const value: unknown = Reflect.get(c, prop, c);
    return typeof value === 'function' ? value.bind(c) : value;
  },
});
