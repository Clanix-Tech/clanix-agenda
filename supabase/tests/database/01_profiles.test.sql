begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select tests.create_user('a@x.com', 'Camila') as a \gset
select tests.create_user('b@x.com') as b \gset

select is((select display_name from public.profiles where id = :'a'), 'Camila', 'perfil criado com display_name do metadata');
select is((select timezone from public.profiles where id = :'a'), 'America/Sao_Paulo', 'fuso padrão');
select is((select reminder_minutes from public.profiles where id = :'a'), 30, 'lembrete padrão 30');
select is((select display_name from public.profiles where id = :'b'), 'b', 'sem metadata usa parte local do email');

select tests.authenticate_as(:'a'::uuid);
select is((select count(*)::int from public.profiles), 1, 'A enxerga só o próprio perfil');

update public.profiles set display_name = 'X' where id = :'b';
select tests.reset_role();
select is((select display_name from public.profiles where id = :'b'), 'b', 'update no perfil de B afeta 0 linhas');

select tests.authenticate_as(:'a'::uuid);
select throws_ok($$update public.profiles set id = gen_random_uuid()$$, '42501', null, 'id não é atualizável');
select throws_ok($$insert into public.profiles (id, display_name) values (gen_random_uuid(), 'Z')$$, '42501', null, 'sem insert');
select throws_ok($$delete from public.profiles$$, '42501', null, 'sem delete');
select throws_ok($$update public.profiles set timezone = 'Marte/Base'$$, '22023', 'fuso_invalido', 'fuso inválido rejeitado');
select throws_ok($$update public.profiles set slot_interval_minutes = 20$$, '23514', null, 'intervalo 20 rejeitado');

select tests.authenticate_anon();
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon sem acesso');

select tests.reset_role();
delete from auth.users where id = :'a';
select is((select count(*)::int from public.profiles where id = :'a'), 0, 'excluir usuário remove o perfil');

-- Cadastro nunca pode abortar por causa do perfil
select tests.create_user('long1@x.com', repeat('n', 81)) as l1 \gset
select is((select char_length(display_name) from public.profiles where id = :'l1'), 80, 'display_name de 81 chars é cortado em 80');
select tests.create_user(null) as l2 \gset
select is((select display_name from public.profiles where id = :'l2'), 'Usuário', 'sem email e sem metadata usa Usuário');
select tests.create_user(repeat('m', 90) || '@x.com') as l3 \gset
select is((select char_length(display_name) from public.profiles where id = :'l3'), 80, 'parte local de 90 chars é cortada em 80');

select * from finish();
rollback;
