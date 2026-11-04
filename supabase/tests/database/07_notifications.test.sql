begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select tests.create_user('a@x.com') as a \gset
select tests.create_user('b@x.com') as b \gset

select tests.authenticate_as(:'a'::uuid);

select throws_ok(
  $$insert into public.push_subscriptions (endpoint, p256dh, auth, device_label) values ('https://push.example/a1', 'p', 'a', 'Celular')$$,
  '42501', null, 'insert direto por authenticated negado');
select throws_ok(
  format($$insert into public.push_subscriptions (owner_id, endpoint, p256dh, auth) values (%L, 'https://push.example/a2', 'p', 'a')$$, :'a'),
  '42501', null, 'insert direto com owner_id explícito negado');
select public.register_push_subscription('https://push.example/a1', 'p256dh-a', 'auth-a', 'Celular');
select is(
  (select owner_id from public.push_subscriptions where endpoint = 'https://push.example/a1'),
  :'a'::uuid, 'owner_id preenchido com auth.uid() pela RPC');
select throws_ok(
  format($$update public.push_subscriptions set owner_id = %L$$, :'b'),
  '42501', null, 'update de owner_id negado');
select throws_ok(
  $$select public.register_push_subscription('http://push.example/a3', 'p', 'a')$$,
  '23514', null, 'endpoint http rejeitado pela RPC');
select public.register_push_subscription('https://push.example/a1', 'p256dh-a2', 'auth-a2', 'Celular');
select is(
  (select count(*)::int || '|' || min(p256dh) from public.push_subscriptions where endpoint = 'https://push.example/a1'),
  '1|p256dh-a2', 'registrar o mesmo endpoint de novo não duplica e atualiza as chaves');

select tests.authenticate_as(:'b'::uuid);
select is((select count(*)::int from public.push_subscriptions), 0, 'B não enxerga assinaturas de A');
delete from public.push_subscriptions;
select tests.reset_role();
select is(
  (select count(*)::int from public.push_subscriptions where owner_id = :'a'::uuid),
  1, 'B não apagou assinatura de A');

select tests.authenticate_as(:'a'::uuid);
select throws_ok($$select * from public.appointment_reminders$$, '42501', null, 'A sem acesso a lembretes');
select tests.authenticate_anon();
select throws_ok($$select * from public.appointment_reminders$$, '42501', null, 'anon sem acesso a lembretes');
select throws_ok($$select * from public.push_subscriptions$$, '42501', null, 'anon sem acesso a assinaturas');

select tests.reset_role();
delete from auth.users where id = :'a'::uuid;
select is(
  (select count(*)::int from public.push_subscriptions where owner_id = :'a'::uuid),
  0, 'excluir usuário remove suas assinaturas');

select * from finish();
rollback;
