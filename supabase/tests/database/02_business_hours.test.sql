begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select tests.create_user('a@x.com') as a \gset
select tests.create_user('b@x.com') as b \gset

select tests.authenticate_as(:'a'::uuid);

select is(
  (select count(*)::int from public.set_business_hours(
    '[{"weekday":1,"start_time":"13:00","end_time":"18:00"},{"weekday":1,"start_time":"09:00","end_time":"12:00"}]'::jsonb)),
  2, 'retorna 2 turnos');
select is((select count(*)::int from public.business_hours), 2, 'count = 2');
select is(
  (select array_agg(start_time::text order by start_time) from public.business_hours),
  array['09:00:00', '13:00:00'], 'turnos gravados');

select is(
  (select start_time::text from public.set_business_hours(
    '[{"weekday":1,"start_time":"08:00","end_time":"12:00"}]'::jsonb)),
  '08:00:00', 'substituição retorna o novo turno');
select is((select count(*)::int from public.business_hours), 1, 'substitui, não acumula');

select throws_ok(
  $$select * from public.set_business_hours('[{"weekday":2,"start_time":"09:00","end_time":"12:00"},{"weekday":2,"start_time":"11:00","end_time":"14:00"}]'::jsonb)$$,
  '22023', 'expediente_invalido', 'turnos sobrepostos rejeitados');
select is((select count(*)::int from public.business_hours where weekday = 1), 1, 'turnos anteriores permanecem após sobreposição');
select is((select count(*)::int from public.business_hours), 1, 'nada novo foi gravado');

select throws_ok(
  $$select * from public.set_business_hours('[{"weekday":1,"start_time":"12:00","end_time":"12:00"}]'::jsonb)$$,
  '22023', 'expediente_invalido', 'fim <= início rejeitado');
select throws_ok(
  $$select * from public.set_business_hours('[{"weekday":1,"start_time":"09:00:30","end_time":"12:00"}]'::jsonb)$$,
  '22023', 'expediente_invalido', 'segundos rejeitados');
select throws_ok(
  $$select * from public.set_business_hours('[{"weekday":7,"start_time":"09:00","end_time":"12:00"}]'::jsonb)$$,
  '22023', 'expediente_invalido', 'dia da semana inválido rejeitado');
select throws_ok(
  $$select * from public.set_business_hours('[{"weekday":1,"start_time":"xx","end_time":"12:00"}]'::jsonb)$$,
  '22023', 'expediente_invalido', 'horário malformado rejeitado');
select throws_ok(
  $$select * from public.set_business_hours((select jsonb_agg(jsonb_build_object('weekday', 1, 'start_time', lpad(i::text, 2, '0') || ':00', 'end_time', lpad(i::text, 2, '0') || ':30')) from generate_series(0, 21) i))$$,
  '22023', 'expediente_invalido', 'mais de 21 turnos rejeitado');

select tests.authenticate_as(:'b'::uuid);
select is((select count(*)::int from public.business_hours), 0, 'B não enxerga turnos de A');

select tests.authenticate_as(:'a'::uuid);
select throws_ok(
  $$insert into public.business_hours (owner_id, weekday, start_time, end_time) values (gen_random_uuid(), 1, '09:00', '12:00')$$,
  '42501', null, 'sem insert direto');

select tests.authenticate_anon();
select throws_ok($$select * from public.set_business_hours('[]'::jsonb)$$, '42501', null, 'anon sem acesso');

select * from finish();
rollback;
