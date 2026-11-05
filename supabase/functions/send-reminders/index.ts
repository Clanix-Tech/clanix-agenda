// Edge Function send-reminders: chamada a cada minuto pelo pg_cron (header x-cron-secret).
// Só liga as dependências reais; a lógica está em handler.ts.
import 'jsr:@supabase/functions-js@2.119.0/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { serviceKey } from '../_shared/serviceKey.ts';
import { sendPush, type PushTarget } from '../_shared/webpush.ts';
import { handleSendReminders, type Due } from './handler.ts';

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

const supabase = createClient(requireEnv('SUPABASE_URL'), serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const vapid = {
  publicKey: requireEnv('VAPID_PUBLIC_KEY'),
  privateKey: requireEnv('VAPID_PRIVATE_KEY'),
  subject: requireEnv('VAPID_SUBJECT'),
};
const cronSecret = requireEnv('CRON_SECRET');

Deno.serve((req) =>
  handleSendReminders(req, {
    cronSecret,
    now: () => new Date(),
    async due(now) {
      const { data, error } = await supabase.rpc('due_reminders', { p_now: now.toISOString() });
      if (error) throw new Error(`due_reminders: ${error.code}`);
      return (data ?? []) as Due[];
    },
    async claim(id, startsAt) {
      const { data, error } = await supabase.rpc('claim_reminder', {
        p_appointment_id: id,
        p_starts_at: startsAt,
      });
      if (error) throw new Error(`claim_reminder: ${error.code}`);
      return data === true;
    },
    async release(id, startsAt) {
      const { error } = await supabase.rpc('release_reminder', {
        p_appointment_id: id,
        p_starts_at: startsAt,
      });
      if (error) throw new Error(`release_reminder: ${error.code}`);
    },
    async targets(ownerId) {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('owner_id', ownerId);
      if (error) throw new Error(`push_subscriptions: ${error.code}`);
      return (data ?? []) as PushTarget[];
    },
    send: (target, payload) => sendPush(target, payload, vapid),
    async removeTargets(ids) {
      const { error } = await supabase.from('push_subscriptions').delete().in('id', ids);
      if (error) throw new Error(`push_subscriptions: ${error.code}`);
    },
    async recordResults(okIds, failedIds) {
      const { data, error } = await supabase.rpc('record_push_results', {
        p_ok: okIds,
        p_failed: failedIds,
      });
      if (error) throw new Error(`record_push_results: ${error.code}`);
      return typeof data === 'number' ? data : 0;
    },
  }),
);
