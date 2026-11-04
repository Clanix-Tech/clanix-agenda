begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select tests.create_user('a@x.com') as a \gset
select tests.reset_role();

-- Agenda
select is((select schedule from cron.job where jobname = 'send-reminders'), '* * * * *', 'job send-reminders a cada minuto');
select is((select command from cron.job where jobname = 'send-reminders'),
  'select app_private.invoke_send_reminders()', 'job chama invoke_send_reminders');

-- Sem segredos: não chama nada
select is(app_private.invoke_send_reminders(), null::bigint, 'sem segredos: retorna null');
select is((select count(*)::int from net.http_request_queue), 0, 'sem segredos: nada na fila do pg_net');

-- Validação
select tests.reset_role();
set local role service_role;
select throws_ok($$select public.set_reminder_config('ftp://x.local/f', repeat('x', 32))$$, '22023', null, 'URL sem http(s) é recusada');
select throws_ok($$select public.set_reminder_config('http://exemplo.local/functions/v1/send-reminders', repeat('x', 10))$$,
  '22023', null, 'segredo curto é recusado');

-- Configura e chama
select lives_ok($$select public.set_reminder_config('http://exemplo.local/functions/v1/send-reminders', repeat('x', 32))$$,
  'service_role configura');
reset role;
select isnt(app_private.invoke_send_reminders(), null::bigint, 'com segredos: retorna id da requisição');
select is((select headers ->> 'x-cron-secret' from net.http_request_queue order by id desc limit 1), repeat('x', 32),
  'requisição leva o header x-cron-secret');

-- Atualizar (segunda chamada) não duplica segredos
set local role service_role;
select public.set_reminder_config('http://exemplo.local/outra', repeat('y', 40));
reset role;
select is((select count(*)::int from vault.decrypted_secrets
            where name in ('reminders_function_url', 'reminders_cron_secret')), 2, 'segredos atualizados sem duplicar');

-- Privilégios
select tests.authenticate_as(:'a'::uuid);
select throws_ok($$select public.set_reminder_config('http://x.local/f', repeat('x', 32))$$, '42501', null,
  'authenticated sem set_reminder_config');

select throws_ok($$select app_private.invoke_send_reminders()$$, '42501', null, 'authenticated sem invoke_send_reminders');

select * from finish();
rollback;
