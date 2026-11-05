-- Endurecimento para produção: pg_net fechado para a API, limpeza do histórico do cron,
-- índices, contagem de falhas de push e função de "ping" para manter o projeto ativo.

-- 1) pg_net: nada do schema net fica acessível por papéis da API.
revoke usage on schema net from public, anon, authenticated;
revoke all on all tables in schema net from public, anon, authenticated;
revoke all on all sequences in schema net from public, anon, authenticated;
revoke execute on all functions in schema net from public, anon, authenticated;

-- 2) Timeout do pg_net: 30 s (corpo idêntico ao anterior, exceto o timeout).
create or replace function app_private.invoke_send_reminders()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'reminders_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'reminders_cron_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;
  return net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    timeout_milliseconds := 30000);
end;
$$;
revoke all on function app_private.invoke_send_reminders() from public;

-- 3) Limpeza diária do histórico de execuções do pg_cron (cron.schedule com nome substitui o job).
select cron.schedule(
  'limpar-historico-cron',
  '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);

-- 4) Índices.
create index if not exists appointments_agendado_starts_at_idx
  on public.appointments (starts_at) where status = 'agendado';
create index if not exists appointment_history_owner_id_idx
  on public.appointment_history (owner_id);

-- 5) Falhas permanentes de push: após 3 falhas seguidas a assinatura é apagada.
alter table public.push_subscriptions
  add column if not exists failure_count int not null default 0;

create or replace function public.record_push_results(p_ok uuid[], p_failed uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  update public.push_subscriptions
     set failure_count = 0, last_used_at = now()
   where id = any (coalesce(p_ok, '{}'::uuid[]));

  update public.push_subscriptions
     set failure_count = failure_count + 1
   where id = any (coalesce(p_failed, '{}'::uuid[]));

  delete from public.push_subscriptions
   where id = any (coalesce(p_failed, '{}'::uuid[])) and failure_count >= 3;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.record_push_results(uuid[], uuid[]) from public;
revoke execute on function public.record_push_results(uuid[], uuid[]) from anon, authenticated;
grant execute on function public.record_push_results(uuid[], uuid[]) to service_role;

-- 6) Ping: mantém o projeto gratuito ativo; não lê tabela alguma.
create or replace function public.ping()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select 'ok'::text;
$$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated, service_role;
