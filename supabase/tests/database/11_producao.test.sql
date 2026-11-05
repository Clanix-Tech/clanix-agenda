begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

select tests.create_user('a@x.com') as a \gset
select tests.reset_role();

-- Schema net fechado para a API.
-- O revoke só tem efeito quando quem concedeu os grants é o postgres. No Supabase local o
-- schema net pertence a supabase_admin (superusuário) e o postgres não consegue revogar; nesse
-- caso os testes são pulados (e a API não expõe net: db.schemas = public, graphql_public).
select set_config('ae.net_revogavel', (pg_get_userbyid(nspowner) = 'postgres')::text, true)
  from pg_namespace where nspname = 'net';

select case when current_setting('ae.net_revogavel') = 'true'
  then is(has_schema_privilege('anon', 'net', 'usage'), false, 'anon sem usage em net')
  else skip(1, 'net pertence a supabase_admin: postgres não revoga') end;
select case when current_setting('ae.net_revogavel') = 'true'
  then is(has_schema_privilege('authenticated', 'net', 'usage'), false, 'authenticated sem usage em net')
  else skip(1, 'net pertence a supabase_admin: postgres não revoga') end;
select case when current_setting('ae.net_revogavel') = 'true'
  then is(has_table_privilege('authenticated', 'net.http_request_queue', 'select'), false,
    'authenticated sem select em net.http_request_queue')
  else skip(1, 'net pertence a supabase_admin: postgres não revoga') end;
select case when current_setting('ae.net_revogavel') = 'true'
  then is(
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'net'
        and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
    0, 'funções de net sem execute para anon/authenticated')
  else skip(1, 'net pertence a supabase_admin: postgres não revoga') end;

-- Cron de limpeza
select is((select schedule from cron.job where jobname = 'limpar-historico-cron'), '17 3 * * *', 'job de limpeza agendado às 03:17');
select is((select command from cron.job where jobname = 'limpar-historico-cron'),
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$, 'job apaga histórico com mais de 7 dias');

-- Timeout do pg_net
select ok(pg_get_functiondef('app_private.invoke_send_reminders()'::regprocedure) like '%30000%', 'invoke_send_reminders com timeout de 30000 ms');

-- Índices
select has_index('public', 'appointments', 'appointments_agendado_starts_at_idx', 'índice parcial de agendados existe');
select has_index('public', 'appointment_history', 'appointment_history_owner_id_idx', 'índice de owner_id do histórico existe');

-- record_push_results
insert into public.push_subscriptions (id, owner_id, endpoint, p256dh, auth, failure_count)
values ('00000000-0000-0000-0000-0000000000a1', :'a'::uuid, 'https://push.example/a1', 'k', 'a', 2),
       ('00000000-0000-0000-0000-0000000000a2', :'a'::uuid, 'https://push.example/a2', 'k', 'a', 2),
       ('00000000-0000-0000-0000-0000000000a3', :'a'::uuid, 'https://push.example/a3', 'k', 'a', 0);

set local role service_role;
select is(public.record_push_results('{}'::uuid[], array['00000000-0000-0000-0000-0000000000a1']::uuid[]), 1,
  'falha na 3ª vez: apaga e retorna 1');
select is((select count(*)::int from public.push_subscriptions where id = '00000000-0000-0000-0000-0000000000a1'), 0,
  'assinatura com 3 falhas some');
select public.record_push_results(array['00000000-0000-0000-0000-0000000000a2']::uuid[], '{}'::uuid[]);
select is((select failure_count from public.push_subscriptions where id = '00000000-0000-0000-0000-0000000000a2'), 0,
  'sucesso zera failure_count');
select isnt((select last_used_at from public.push_subscriptions where id = '00000000-0000-0000-0000-0000000000a2'), null::timestamptz,
  'sucesso atualiza last_used_at');
select is(public.record_push_results('{}'::uuid[], array['00000000-0000-0000-0000-0000000000a3']::uuid[]), 0,
  'falha abaixo do limite não apaga');
select is((select failure_count from public.push_subscriptions where id = '00000000-0000-0000-0000-0000000000a3'), 1,
  'falha incrementa failure_count');

reset role;
select tests.authenticate_as(:'a'::uuid);
select throws_ok($$select public.record_push_results('{}'::uuid[], '{}'::uuid[])$$, '42501', null,
  'authenticated sem record_push_results');

-- ping
reset role;
select tests.reset_role();
set local role anon;
select is(public.ping(), 'ok', 'anon chama ping');

select * from finish();
rollback;
