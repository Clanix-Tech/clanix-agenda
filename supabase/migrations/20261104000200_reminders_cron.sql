-- Agendamento por minuto: pg_cron chama a Edge Function send-reminders via pg_net.
-- URL e segredo ficam no Vault (nunca em arquivo versionado).

create extension if not exists pg_net;
create extension if not exists pg_cron;

create function public.set_reminder_config(p_function_url text, p_cron_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_function_url is null or p_function_url !~ '^https?://' then
    raise exception 'URL da função inválida' using errcode = '22023';
  end if;
  if p_cron_secret is null or char_length(p_cron_secret) < 32 then
    raise exception 'Segredo do cron precisa ter ao menos 32 caracteres' using errcode = '22023';
  end if;

  select id into v_id from vault.secrets where name = 'reminders_function_url';
  if v_id is null then
    perform vault.create_secret(p_function_url, 'reminders_function_url', 'URL da Edge Function send-reminders');
  else
    perform vault.update_secret(v_id, p_function_url);
  end if;

  select id into v_id from vault.secrets where name = 'reminders_cron_secret';
  if v_id is null then
    perform vault.create_secret(p_cron_secret, 'reminders_cron_secret', 'Segredo compartilhado do cron de lembretes');
  else
    perform vault.update_secret(v_id, p_cron_secret);
  end if;
end;
$$;

create function app_private.invoke_send_reminders()
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
    timeout_milliseconds := 10000);
end;
$$;

revoke all on function public.set_reminder_config(text, text) from public;
revoke execute on function public.set_reminder_config(text, text) from anon, authenticated;
grant execute on function public.set_reminder_config(text, text) to service_role;
revoke all on function app_private.invoke_send_reminders() from public;

-- Idempotente: desagenda antes de agendar.
select cron.unschedule(jobid) from cron.job where jobname = 'send-reminders';
select cron.schedule('send-reminders', '* * * * *', 'select app_private.invoke_send_reminders()');
