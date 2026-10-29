begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

select tests.create_user('a@x.com') as a \gset
select tests.create_user('b@x.com') as b \gset
select tests.reset_role();

-- Dia 0: conflitos (RN03, RN04, RN19)
insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
values (:'a', 'Cliente A', 'Corte', tests.local_ts(0, '14:00'), tests.local_ts(0, '15:00'));

select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, 'X', 'Y', tests.local_ts(0, '14:30'), tests.local_ts(0, '15:30'))$$, :'a'),
  '23P01', null, 'RN03: conflito parcial rejeitado');
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, 'X', 'Y', tests.local_ts(0, '14:00'), tests.local_ts(0, '15:00'))$$, :'a'),
  '23P01', null, 'conflito total rejeitado');
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, 'X', 'Y', tests.local_ts(0, '13:00'), tests.local_ts(0, '16:00'))$$, :'a'),
  '23P01', null, 'intervalo que envolve o existente rejeitado');
select lives_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, 'X', 'Y', tests.local_ts(0, '15:00'), tests.local_ts(0, '16:00'))$$, :'a'),
  'RN04: horário adjacente permitido');
select lives_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, 'Cliente B', 'Y', tests.local_ts(0, '14:00'), tests.local_ts(0, '15:00'))$$, :'b'),
  'RN19: outro profissional no mesmo horário permitido');

-- Dia 1: RN05 cancelado libera o horário
insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
values (:'a', 'Cancelar', 'Corte', tests.local_ts(1, '14:00'), tests.local_ts(1, '15:00'));
update public.appointments set status = 'cancelado', canceled_at = now() where client_name = 'Cancelar';
select lives_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, 'Novo', 'Y', tests.local_ts(1, '14:30'), tests.local_ts(1, '15:30'))$$, :'a'),
  'RN05: horário de cancelado fica livre');

-- Dia 2: RN06 concluído e não compareceu continuam bloqueando
insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at, status)
values (:'a', 'Concl', 'Corte', tests.local_ts(2, '09:00'), tests.local_ts(2, '10:00'), 'concluido'),
       (:'a', 'Falta', 'Corte', tests.local_ts(2, '11:00'), tests.local_ts(2, '12:00'), 'nao_compareceu');
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, 'X', 'Y', tests.local_ts(2, '09:30'), tests.local_ts(2, '10:30'))$$, :'a'),
  '23P01', null, 'RN06: concluído continua bloqueando');
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, 'X', 'Y', tests.local_ts(2, '11:30'), tests.local_ts(2, '12:30'))$$, :'a'),
  '23P01', null, 'RN06: não compareceu continua bloqueando');

-- Dia 3: constraints de domínio (todas rejeitadas)
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, 'X', 'Y', tests.local_ts(3, '10:00'), tests.local_ts(3, '10:00'))$$, :'a'),
  '23514', null, 'RN09: fim igual ao início rejeitado');
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, 'X', 'Y', tests.local_ts(3, '10:00'), tests.local_ts(3, '09:00'))$$, :'a'),
  '23514', null, 'RN10: fim antes do início rejeitado');
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, '   ', 'Y', tests.local_ts(3, '10:00'), tests.local_ts(3, '11:00'))$$, :'a'),
  '23514', null, 'nome só com espaços rejeitado');
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, ' Ana', 'Y', tests.local_ts(3, '10:00'), tests.local_ts(3, '11:00'))$$, :'a'),
  '23514', null, 'nome com espaço no início rejeitado');
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, repeat('a', 121), 'Y', tests.local_ts(3, '10:00'), tests.local_ts(3, '11:00'))$$, :'a'),
  '23514', null, 'nome com 121 caracteres rejeitado');
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, 'X', '   ', tests.local_ts(3, '10:00'), tests.local_ts(3, '11:00'))$$, :'a'),
  '23514', null, 'serviço só com espaços rejeitado');
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, 'X', repeat('a', 121), tests.local_ts(3, '10:00'), tests.local_ts(3, '11:00'))$$, :'a'),
  '23514', null, 'serviço com 121 caracteres rejeitado');
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, client_phone, service_name, starts_at, ends_at)
    values (%L, 'X', 'abc12345', 'Y', tests.local_ts(3, '10:00'), tests.local_ts(3, '11:00'))$$, :'a'),
  '23514', null, 'telefone com letras rejeitado');
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, client_phone, service_name, starts_at, ends_at)
    values (%L, 'X', '<b>1234</b>', 'Y', tests.local_ts(3, '10:00'), tests.local_ts(3, '11:00'))$$, :'a'),
  '23514', null, 'telefone com HTML rejeitado');
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, 'X', 'Y', tests.local_ts(3, '10:00') + interval '30 seconds', tests.local_ts(3, '11:00'))$$, :'a'),
  '23514', null, 'início com segundos rejeitado');
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, 'X', 'Y', tests.local_ts(3, '08:00'), tests.local_ts(3, '21:00'))$$, :'a'),
  '23514', null, 'duração de 13 h rejeitada');
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at, status)
    values (%L, 'X', 'Y', tests.local_ts(3, '10:00'), tests.local_ts(3, '11:00'), 'cancelado')$$, :'a'),
  '23514', null, 'cancelado sem canceled_at rejeitado');
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at, canceled_at)
    values (%L, 'X', 'Y', tests.local_ts(3, '10:00'), tests.local_ts(3, '11:00'), now())$$, :'a'),
  '23514', null, 'canceled_at sem status cancelado rejeitado');

-- Dia 4: telefone válido
select lives_ok(
  format($$insert into public.appointments (owner_id, client_name, client_phone, service_name, starts_at, ends_at)
    values (%L, 'Fone', '(11) 98765-4321', 'Y', tests.local_ts(4, '10:00'), tests.local_ts(4, '11:00'))$$, :'a'),
  'telefone formatado aceito');

-- Dia 5: histórico
insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
values (:'a', 'Hist', 'Corte', tests.local_ts(5, '10:00'), tests.local_ts(5, '11:00'));
select id as h from public.appointments where client_name = 'Hist' \gset

select is((select count(*)::int from public.appointment_history where appointment_id = :'h' and action = 'criado'),
  1, 'insert gera 1 linha criado');
select ok((select previous_values is null and new_values ? 'client_name' and not (new_values ? 'owner_id')
  from public.appointment_history where appointment_id = :'h' and action = 'criado'),
  'criado: previous nulo e new_values sem owner_id');

update public.appointments set starts_at = tests.local_ts(5, '14:00'), ends_at = tests.local_ts(5, '15:00') where id = :'h';
select ok((select previous_values ? 'starts_at' and previous_values ? 'ends_at' and new_values ? 'starts_at'
    and not (new_values ? 'notes')
  from public.appointment_history where appointment_id = :'h' and action = 'remarcado'),
  'remarcado com previous_values de starts_at/ends_at');

update public.appointments set notes = 'obs' where id = :'h';
select is((select array_agg(k order by k) from public.appointment_history ah, jsonb_object_keys(ah.new_values) k
    where ah.appointment_id = :'h' and ah.action = 'editado'),
  array['notes'], 'editado grava só notes');

update public.appointments set status = 'concluido' where id = :'h';
select is((select new_values ->> 'status' from public.appointment_history
    where appointment_id = :'h' and action = 'status_alterado'),
  'concluido', 'status_alterado gravado');
update public.appointments set status = 'agendado' where id = :'h';

select is((select count(*)::int from public.appointment_history where appointment_id = :'h'), 5,
  'até aqui 5 linhas de histórico');
update public.appointments set updated_at = now() + interval '1 minute' where id = :'h';
select is((select count(*)::int from public.appointment_history where appointment_id = :'h'), 5,
  'update sem campo relevante não grava histórico');

update public.appointments set status = 'cancelado', canceled_at = now(), cancellation_reason = 'motivo' where id = :'h';
select ok((select previous_values ->> 'status' = 'agendado' and new_values ? 'canceled_at'
    and new_values ->> 'cancellation_reason' = 'motivo'
  from public.appointment_history where appointment_id = :'h' and action = 'cancelado'),
  'cancelado grava status, canceled_at e motivo');

update public.appointments set status = 'agendado', canceled_at = null, cancellation_reason = null where id = :'h';
select ok((select previous_values ->> 'status' = 'cancelado' and new_values ->> 'status' = 'agendado'
  from public.appointment_history where appointment_id = :'h' and action = 'reativado'),
  'reativado gravado ao voltar para agendado');

-- Permissões
select tests.authenticate_as(:'a'::uuid);
select throws_ok(
  format($$insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at)
    values (%L, 'X', 'Y', tests.local_ts(6, '10:00'), tests.local_ts(6, '11:00'))$$, :'a'),
  '42501', null, 'authenticated não insere em appointments');
select throws_ok($$update public.appointments set notes = 'x'$$, '42501', null, 'authenticated não atualiza appointments');
select throws_ok($$delete from public.appointments$$, '42501', null, 'authenticated não apaga appointments');
select throws_ok(
  format($$insert into public.appointment_history (appointment_id, owner_id, action, new_values)
    values (%L, %L, 'criado', '{}')$$, :'h', :'a'),
  '42501', null, 'authenticated não insere em histórico');
select throws_ok($$update public.appointment_history set action = 'editado'$$, '42501', null, 'authenticated não atualiza histórico');
select throws_ok($$delete from public.appointment_history$$, '42501', null, 'authenticated não apaga histórico');
select ok((select count(*) > 0 and count(*) = count(*) filter (where owner_id = :'a'::uuid) from public.appointments),
  'A vê só os seus agendamentos');
select ok((select count(*) > 0 and count(*) = count(*) filter (where owner_id = :'a'::uuid) from public.appointment_history),
  'A vê só o seu histórico');

select tests.authenticate_as(:'b'::uuid);
select is((select count(*)::int from public.appointments where owner_id = :'a'::uuid), 0, 'B não vê agendamentos de A');
select is((select count(*)::int from public.appointment_history where owner_id = :'a'::uuid), 0, 'B não vê histórico de A');

select tests.authenticate_anon();
select throws_ok($$select * from public.appointments$$, '42501', null, 'anon sem acesso a appointments');
select throws_ok($$select * from public.appointment_history$$, '42501', null, 'anon sem acesso a histórico');

-- Cascata
select tests.reset_role();
delete from auth.users where id = :'a'::uuid;
select is((select count(*)::int from public.appointments where owner_id = :'a'::uuid), 0, 'excluir A remove agendamentos');
select is((select count(*)::int from public.appointment_history where owner_id = :'a'::uuid), 0, 'excluir A remove histórico');

select * from finish();
rollback;
