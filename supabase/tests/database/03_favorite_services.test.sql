begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select tests.create_user('a@x.com') as a \gset
select tests.create_user('b@x.com') as b \gset

select tests.authenticate_as(:'a'::uuid);

insert into public.favorite_services (name, duration_minutes) values ('Manicure', 45);
select is(
  (select owner_id from public.favorite_services where name = 'Manicure'),
  :'a'::uuid, 'owner_id preenchido com auth.uid()');

select throws_ok(
  format($$insert into public.favorite_services (owner_id, name, duration_minutes) values (%L, 'Outro', 30)$$, :'b'),
  '42501', null, 'insert com owner_id explícito (de outro) negado');
select throws_ok(
  format($$insert into public.favorite_services (owner_id, name, duration_minutes) values (%L, 'Outro', 30)$$, :'a'),
  '42501', null, 'insert com owner_id explícito (próprio) negado');
select throws_ok(
  format($$update public.favorite_services set owner_id = %L$$, :'b'),
  '42501', null, 'update de owner_id negado');

select throws_ok(
  $$insert into public.favorite_services (name, duration_minutes, color) values ('Cor', 30, 'red')$$,
  '23514', null, 'cor inválida rejeitada');
select throws_ok(
  $$insert into public.favorite_services (name, duration_minutes) values ('Zero', 0)$$,
  '23514', null, 'duração 0 rejeitada');
select throws_ok(
  $$insert into public.favorite_services (name, duration_minutes) values ('Longa', 481)$$,
  '23514', null, 'duração acima de 480 rejeitada');
select throws_ok(
  $$insert into public.favorite_services (name, duration_minutes) values ('   ', 30)$$,
  '23514', null, 'nome só com espaços rejeitado');
select throws_ok(
  $$insert into public.favorite_services (name, duration_minutes) values ('manicure ', 30)$$,
  '23505', null, 'duplicado (case/espaços) rejeitado para A');

select tests.authenticate_as(:'b'::uuid);
select is((select count(*)::int from public.favorite_services), 0, 'B não enxerga serviços de A');
update public.favorite_services set name = 'Hack';
delete from public.favorite_services;
select tests.reset_role();
select is(
  (select name from public.favorite_services where owner_id = :'a'::uuid),
  'Manicure', 'B não alterou nem apagou serviço de A');

select tests.authenticate_as(:'b'::uuid);
select lives_ok(
  $$insert into public.favorite_services (name, duration_minutes) values ('Manicure', 45)$$,
  'mesmo nome para B é permitido');

select tests.authenticate_as(:'a'::uuid);
update public.favorite_services set name = 'Pedicure', color = '#A1b2C3' where name = 'Manicure';
select is(
  (select name from public.favorite_services), 'Pedicure', 'A atualiza o próprio serviço');

select tests.authenticate_anon();
select throws_ok($$select * from public.favorite_services$$, '42501', null, 'anon sem acesso');

select * from finish();
rollback;
