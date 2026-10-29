begin;
create extension if not exists pgtap with schema extensions;
select plan(59);

select tests.create_user('a@x.com') as a \gset
select tests.create_user('b@x.com') as b \gset
select tests.reset_role();
select tests.set_default_hours(:'a'::uuid);
select tests.set_default_hours(:'b'::uuid);

select ((date_trunc('day', now() at time zone 'America/Sao_Paulo') - interval '1 day' + interval '10 hours')
         at time zone 'America/Sao_Paulo') as ontem10,
       ((date_trunc('day', now() at time zone 'America/Sao_Paulo') - interval '1 day' + interval '11 hours')
         at time zone 'America/Sao_Paulo') as ontem11
\gset

-- Grants: anon sem execute nas 4 funções
select tests.reset_role();
select ok(not has_function_privilege('anon', 'public.update_appointment_details(uuid, text, text, text, text)', 'execute'),
  'anon sem execute em update_appointment_details');
select ok(not has_function_privilege('anon', 'public.set_appointment_status(uuid, public.appointment_status)', 'execute'),
  'anon sem execute em set_appointment_status');
select ok(not has_function_privilege('anon', 'public.cancel_appointment(uuid, text)', 'execute'),
  'anon sem execute em cancel_appointment');
select ok(not has_function_privilege('anon', 'public.reactivate_appointment(uuid)', 'execute'),
  'anon sem execute em reactivate_appointment');
select ok(has_function_privilege('authenticated', 'public.update_appointment_details(uuid, text, text, text, text)', 'execute')
  and has_function_privilege('authenticated', 'public.set_appointment_status(uuid, public.appointment_status)', 'execute')
  and has_function_privilege('authenticated', 'public.cancel_appointment(uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.reactivate_appointment(uuid)', 'execute'),
  'authenticated executa as 4 funções');

select tests.authenticate_as(:'a'::uuid);

-- Detalhes: agendado
select id as d1 from public.create_appointment('Cliente D1', 'Corte', tests.local_ts(0, '10:00'), tests.local_ts(0, '11:00')) \gset
select lives_ok(
  format($$select public.update_appointment_details(%L, '  Ana  ', '  Barba  ', '  11999990000  ', '  obs  ')$$, :'d1'),
  'editar detalhes de agendado');
select is((select client_name || '|' || service_name || '|' || client_phone || '|' || notes from public.appointments where id = :'d1'),
  'Ana|Barba|11999990000|obs', 'detalhes normalizados (aparados)');
select ok((select new_values ->> 'client_name' = 'Ana' and previous_values ->> 'client_name' = 'Cliente D1'
    from public.appointment_history where appointment_id = :'d1' and action = 'editado'),
  'histórico editado com nome anterior e novo');
select lives_ok(
  format($$select public.update_appointment_details(%L, 'Ana', 'Barba', '', '   ')$$, :'d1'),
  'telefone e observações vazios aceitos');
select ok((select client_phone is null and notes is null from public.appointments where id = :'d1'),
  'telefone e observações vazios viram null');
select ok((select starts_at = tests.local_ts(0, '10:00') and ends_at = tests.local_ts(0, '11:00') and status = 'agendado'
    from public.appointments where id = :'d1'),
  'editar detalhes não altera horário nem status');

-- Substituição completa: valores informados são gravados; null/'' limpam; omitir não é possível
select lives_ok(
  format($$select public.update_appointment_details(%L, 'Ana', 'Barba', '11988887777', 'nota')$$, :'d1'),
  'substituição completa com telefone e notas');
select is((select client_phone || '|' || notes from public.appointments where id = :'d1'),
  '11988887777|nota', 'telefone e notas informados são gravados');
select lives_ok(
  format($$select public.update_appointment_details(%L, 'Ana', 'Barba', null, null)$$, :'d1'),
  'null explícito aceito');
select ok((select client_phone is null and notes is null from public.appointments where id = :'d1'),
  'null explícito limpa telefone e notas');
select throws_ok(
  format($$select public.update_appointment_details(%L, 'Ana', 'Barba')$$, :'d1'),
  '42883', null, 'chamada sem telefone/notas não existe (todos os parâmetros são obrigatórios)');

select throws_ok(format($$select public.set_appointment_status(%L, null)$$, :'d1'),
  'AE005', 'transicao_invalida', 'status nulo dá AE005');
-- Detalhes: concluido e nao_compareceu (status preparado como postgres)
select id as d2 from public.create_appointment('Cliente D2', 'Corte', tests.local_ts(0, '14:00'), tests.local_ts(0, '15:00')) \gset
select id as d3 from public.create_appointment('Cliente D3', 'Corte', tests.local_ts(0, '15:00'), tests.local_ts(0, '16:00')) \gset
select tests.reset_role();
update public.appointments set status = 'concluido' where id = :'d2';
update public.appointments set status = 'nao_compareceu' where id = :'d3';
select tests.authenticate_as(:'a'::uuid);
select lives_ok(
  format($$select public.update_appointment_details(%L, 'Novo D2', 'Corte', null, null)$$, :'d2'),
  'editar detalhes de concluido');
select lives_ok(
  format($$select public.update_appointment_details(%L, 'Novo D3', 'Corte', null, null)$$, :'d3'),
  'editar detalhes de nao_compareceu');
select ok((select count(*) = 1 and bool_and(new_values ->> 'client_name' = 'Novo D2')
    from public.appointment_history where appointment_id = :'d2' and action = 'editado'),
  'histórico editado para concluido');
select ok((select count(*) = 1 and bool_and(new_values ->> 'client_name' = 'Novo D3')
    from public.appointment_history where appointment_id = :'d3' and action = 'editado'),
  'histórico editado para nao_compareceu');

-- Transições permitidas (cadeia única; cada par aparece uma vez)
select id as s1 from public.create_appointment('Cliente S1', 'Corte', tests.local_ts(1, '10:00'), tests.local_ts(1, '11:00')) \gset
select lives_ok(format($$select public.set_appointment_status(%L, 'concluido')$$, :'s1'), 'agendado -> concluido');
select lives_ok(format($$select public.set_appointment_status(%L, 'nao_compareceu')$$, :'s1'), 'concluido -> nao_compareceu');
select lives_ok(format($$select public.set_appointment_status(%L, 'concluido')$$, :'s1'), 'nao_compareceu -> concluido');
select lives_ok(format($$select public.set_appointment_status(%L, 'agendado')$$, :'s1'), 'concluido -> agendado');
select lives_ok(format($$select public.set_appointment_status(%L, 'nao_compareceu')$$, :'s1'), 'agendado -> nao_compareceu');
select lives_ok(format($$select public.set_appointment_status(%L, 'agendado')$$, :'s1'), 'nao_compareceu -> agendado');
select is((select count(distinct (previous_values ->> 'status') || '>' || (new_values ->> 'status'))::int
    from public.appointment_history where appointment_id = :'s1' and action = 'status_alterado'
      and (previous_values ->> 'status') || '>' || (new_values ->> 'status') in
        ('agendado>concluido', 'concluido>nao_compareceu', 'nao_compareceu>concluido',
         'concluido>agendado', 'agendado>nao_compareceu', 'nao_compareceu>agendado')),
  6, 'histórico status_alterado com status anterior e novo nas 6 transições');
select is((select status::text from public.appointments where id = :'s1'), 'agendado', 'status final da cadeia');

-- Transições inválidas
select throws_ok(format($$select public.set_appointment_status(%L, 'agendado')$$, :'s1'),
  'AE005', 'transicao_invalida', 'agendado -> agendado rejeitado');
select throws_ok(format($$select public.set_appointment_status(%L, 'cancelado')$$, :'s1'),
  'AE005', 'transicao_invalida', 'agendado -> cancelado via set_appointment_status rejeitado');
select tests.reset_role();
update public.appointments set status = 'concluido' where id = :'s1';
select tests.authenticate_as(:'a'::uuid);
select throws_ok(format($$select public.set_appointment_status(%L, 'cancelado')$$, :'s1'),
  'AE005', 'transicao_invalida', 'concluido -> cancelado rejeitado');
select throws_ok(format($$select public.set_appointment_status(%L, 'concluido')$$, :'s1'),
  'AE005', 'transicao_invalida', 'concluido -> concluido rejeitado');

-- Cancelamento
select id as k1 from public.create_appointment('Cliente K1', 'Corte', tests.local_ts(1, '14:00'), tests.local_ts(1, '15:00')) \gset
select lives_ok(format($$select public.cancel_appointment(%L, '  Imprevisto ')$$, :'k1'), 'cancelar agendado');
select ok((select status = 'cancelado' and cancellation_reason = 'Imprevisto' and canceled_at is not null
    from public.appointments where id = :'k1'),
  'cancelado com motivo aparado e canceled_at preenchido; registro continua existindo');
select ok((select previous_values ->> 'status' = 'agendado' and new_values ->> 'status' = 'cancelado'
      and new_values ->> 'cancellation_reason' = 'Imprevisto'
    from public.appointment_history where appointment_id = :'k1' and action = 'cancelado'),
  'histórico cancelado com status e motivo');
select throws_ok(format($$select public.cancel_appointment(%L)$$, :'k1'),
  'AE005', 'transicao_invalida', 'cancelar cancelado rejeitado');
select throws_ok(format($$select public.set_appointment_status(%L, 'concluido')$$, :'k1'),
  'AE005', 'transicao_invalida', 'cancelado -> concluido rejeitado');
select throws_ok(format($$select public.update_appointment_details(%L, 'X', 'Y', null, null)$$, :'k1'),
  'AE005', 'transicao_invalida', 'editar detalhes de cancelado rejeitado');
select throws_ok(format($$select public.set_appointment_status(%L, 'agendado')$$, :'k1'),
  'AE005', 'transicao_invalida', 'cancelado -> agendado via set_appointment_status rejeitado');

select throws_ok(format($$select public.cancel_appointment(%L)$$, :'s1'),
  'AE005', 'transicao_invalida', 'cancelar concluido rejeitado');

select id as k2 from public.create_appointment('Cliente K2', 'Corte', tests.local_ts(1, '15:00'), tests.local_ts(1, '16:00')) \gset
select throws_ok(format($$select public.cancel_appointment(%L, %L)$$, :'k2', repeat('x', 301)),
  '23514', null, 'motivo com 301 caracteres viola o check (23514)');
select is((select status::text from public.appointments where id = :'k2'), 'agendado', 'agendamento intacto após motivo inválido');
select lives_ok(format($$select public.cancel_appointment(%L, %L)$$, :'k2', repeat('x', 300)), 'motivo com 300 caracteres aceito');
select id as k3 from public.create_appointment('Cliente K3', 'Corte', tests.local_ts(1, '16:00'), tests.local_ts(1, '17:00')) \gset
select lives_ok(format($$select public.cancel_appointment(%L, '   ')$$, :'k3'), 'cancelar com motivo em branco');
select ok((select cancellation_reason is null from public.appointments where id = :'k3'),
  'motivo em branco vira null');

-- Reativação: horário livre
select lives_ok(format($$select public.reactivate_appointment(%L)$$, :'k1'), 'reativar com horário livre');
select ok((select status = 'agendado' and canceled_at is null and cancellation_reason is null
    from public.appointments where id = :'k1'),
  'reativado: agendado, canceled_at e motivo nulos');
select ok((select previous_values ->> 'status' = 'cancelado' and new_values ->> 'status' = 'agendado'
    from public.appointment_history where appointment_id = :'k1' and action = 'reativado'),
  'histórico reativado');
select throws_ok(format($$select public.reactivate_appointment(%L)$$, :'k1'),
  'AE005', 'transicao_invalida', 'reativar agendado rejeitado');

-- Reativação: passado isento de expediente
select id as p1 from public.create_appointment('Passado', 'Corte', :'ontem10', :'ontem11', null, null, true) \gset
select public.cancel_appointment(:'p1');
select lives_ok(format($$select public.reactivate_appointment(%L)$$, :'p1'), 'reativar no passado isento de expediente');

-- Reativação: conflito (primeiro teste da exclusion constraint em UPDATE)
select id as o1 from public.create_appointment('Original', 'Corte', tests.local_ts(2, '10:00'), tests.local_ts(2, '11:00')) \gset
select public.cancel_appointment(:'o1');
select public.create_appointment('Ocupante', 'Corte', tests.local_ts(2, '10:00'), tests.local_ts(2, '11:00'));
select throws_ok(format($$select public.reactivate_appointment(%L)$$, :'o1'),
  'AE001', 'horario_indisponivel', 'reativar em horário ocupado dá AE001 (exclusion em UPDATE)');
select tests.reset_role();
select ok((select status = 'cancelado' and canceled_at is not null from public.appointments where id = :'o1'),
  'registro continua cancelado após AE001');
select tests.authenticate_as(:'a'::uuid);

-- Reativação: futuro fora do expediente (expediente alterado depois)
select id as h1 from public.create_appointment('Horario', 'Corte', tests.local_ts(3, '10:00'), tests.local_ts(3, '11:00')) \gset
select public.cancel_appointment(:'h1');
select tests.reset_role();
delete from public.business_hours where owner_id = :'a'::uuid and weekday = 4;
select tests.authenticate_as(:'a'::uuid);
select throws_ok(format($$select public.reactivate_appointment(%L)$$, :'h1'),
  'AE002', 'fora_do_expediente', 'reativar futuro fora do expediente dá AE002');

-- Isolamento: B não mexe em agendamento de A
select tests.authenticate_as(:'b'::uuid);
select throws_ok(format($$select public.update_appointment_details(%L, 'Hack', 'Hack', null, null)$$, :'d1'),
  'AE006', 'agendamento_nao_encontrado', 'B não edita detalhes de A');
select throws_ok(format($$select public.set_appointment_status(%L, 'concluido')$$, :'d1'),
  'AE006', 'agendamento_nao_encontrado', 'B não altera status de A');
select throws_ok(format($$select public.cancel_appointment(%L)$$, :'d1'),
  'AE006', 'agendamento_nao_encontrado', 'B não cancela agendamento de A');
select throws_ok(format($$select public.reactivate_appointment(%L)$$, :'h1'),
  'AE006', 'agendamento_nao_encontrado', 'B não reativa agendamento de A');
select tests.reset_role();
select ok((select status = 'agendado' and client_name = 'Ana' from public.appointments where id = :'d1')
    and (select status = 'cancelado' from public.appointments where id = :'h1'),
  'registros de A não mudaram');

select * from finish();
rollback;
