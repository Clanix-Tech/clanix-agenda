begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

select tests.create_user('a@x.com') as a \gset
select tests.create_user('b@x.com') as b \gset
select tests.reset_role();
select tests.set_default_hours(:'a'::uuid);
select tests.set_default_hours(:'b'::uuid);

-- Instantes de referência calculados como postgres (fuso de São Paulo)
select to_char(tests.local_ts(1, '10:00') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as z_utc,
       to_char(tests.local_ts(1, '10:00') at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') as z_br,
       to_char(tests.local_ts(1, '11:00') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as z_utc_end,
       to_char(tests.local_ts(1, '11:00') at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') as z_br_end,
       ((date_trunc('day', now() at time zone 'America/Sao_Paulo') - interval '1 day' + interval '10 hours')
         at time zone 'America/Sao_Paulo') as ontem10,
       ((date_trunc('day', now() at time zone 'America/Sao_Paulo') - interval '1 day' + interval '11 hours')
         at time zone 'America/Sao_Paulo') as ontem11,
       ((date_trunc('day', now() at time zone 'America/Sao_Paulo') - interval '1 day' + interval '10 hours 30 minutes')
         at time zone 'America/Sao_Paulo') as ontem1030,
       ((date_trunc('day', now() at time zone 'America/Sao_Paulo') - interval '1 day' + interval '11 hours 30 minutes')
         at time zone 'America/Sao_Paulo') as ontem1130,
       ((date_trunc('day', now() at time zone 'America/Sao_Paulo')
           - (case when extract(dow from now() at time zone 'America/Sao_Paulo') = 0 then 7
                   else extract(dow from now() at time zone 'America/Sao_Paulo')::int end) * interval '1 day'
           + interval '20 hours') at time zone 'America/Sao_Paulo') as dom20,
       ((date_trunc('day', now() at time zone 'America/Sao_Paulo')
           - (case when extract(dow from now() at time zone 'America/Sao_Paulo') = 0 then 7
                   else extract(dow from now() at time zone 'America/Sao_Paulo')::int end) * interval '1 day'
           + interval '21 hours') at time zone 'America/Sao_Paulo') as dom21
\gset

select tests.authenticate_as(:'a'::uuid);

-- Criação básica e conflito
select id as c1 from public.create_appointment('Cliente 1', 'Corte', tests.local_ts(0, '14:00'), tests.local_ts(0, '15:00')) \gset
select ok((select status = 'agendado' and owner_id = :'a'::uuid from public.appointments where id = :'c1'),
  'cria agendamento agendado com owner = auth.uid()');
select throws_ok(
  $$select public.create_appointment('Cliente 2', 'Corte', tests.local_ts(0, '14:00'), tests.local_ts(0, '15:00'))$$,
  'AE001', 'horario_indisponivel', 'mesmo slot rejeitado com AE001');
select lives_ok(
  $$select public.create_appointment('Cliente 3', 'Corte', tests.local_ts(0, '15:00'), tests.local_ts(0, '16:00'))$$,
  'slot adjacente permitido');

-- Review Focus 1: mesmo instante com offsets diferentes
select lives_ok(
  format($$select public.create_appointment('Z', 'Corte', %L::timestamptz, %L::timestamptz)$$, :'z_utc', :'z_utc_end'),
  'instante enviado em UTC aceito');
select throws_ok(
  format($$select public.create_appointment('Z2', 'Corte', %L::timestamptz, %L::timestamptz)$$, :'z_br', :'z_br_end'),
  'AE001', 'horario_indisponivel', 'mesmo instante com offset -03:00 conflita (AE001)');

-- Expediente
select throws_ok(
  $$select public.create_appointment('X', 'Y', tests.local_ts(0, '12:00'), tests.local_ts(0, '13:00'))$$,
  'AE002', 'fora_do_expediente', 'intervalo de almoço rejeitado');
select throws_ok(
  $$select public.create_appointment('X', 'Y', tests.local_ts(0, '17:30'), tests.local_ts(0, '18:30'))$$,
  'AE002', 'fora_do_expediente', 'terminando após o turno rejeitado');
select throws_ok(
  $$select public.create_appointment('X', 'Y', tests.local_ts(5, '10:00'), tests.local_ts(5, '11:00'))$$,
  'AE002', 'fora_do_expediente', 'sábado sem expediente rejeitado');
select lives_ok(
  $$select public.create_appointment('X', 'Y', tests.local_ts(0, '17:00'), tests.local_ts(0, '18:00'))$$,
  'terminando exatamente no fim do turno aceito');
select lives_ok(
  $$select public.create_appointment('X', 'Y', tests.local_ts(0, '09:00'), tests.local_ts(0, '10:00'))$$,
  'começando exatamente no início do turno aceito');

-- Review Focus 4: meia-noite
select throws_ok(
  $$select public.create_appointment('X', 'Y', tests.local_ts(0, '23:00'), tests.local_ts(1, '00:00'))$$,
  'AE003', 'atravessa_meia_noite', 'terminar à meia-noite é AE003 (antes do expediente)');

-- Passado
select throws_ok(
  format($$select public.create_appointment('X', 'Y', %L::timestamptz, %L::timestamptz)$$, :'ontem10', :'ontem11'),
  'AE004', 'horario_passado_sem_confirmacao', 'passado sem confirmação rejeitado');
select lives_ok(
  format($$select public.create_appointment('X', 'Y', %L::timestamptz, %L::timestamptz, null, null, true)$$, :'ontem10', :'ontem11'),
  'passado com confirmação aceito');
select lives_ok(
  format($$select public.create_appointment('X', 'Y', %L::timestamptz, %L::timestamptz, null, null, true)$$, :'dom20', :'dom21'),
  'passado no domingo (sem expediente) isento de expediente');
select throws_ok(
  format($$select public.create_appointment('X', 'Y', %L::timestamptz, %L::timestamptz, null, null, true)$$, :'ontem1030', :'ontem1130'),
  'AE001', 'horario_indisponivel', 'passado sobrepondo outro passado conflita');

-- Fuso do perfil
select tests.reset_role();
update public.profiles set timezone = 'America/Manaus' where id = :'b'::uuid;
select tests.authenticate_as(:'b'::uuid);
select lives_ok(
  $$select public.create_appointment('M', 'Y', tests.local_ts(0, '09:00', 'America/Manaus'), tests.local_ts(0, '10:00', 'America/Manaus'))$$,
  'Manaus 09:00 local aceito');
select throws_ok(
  $$select public.create_appointment('M', 'Y', tests.local_ts(0, '08:30', 'America/Manaus'), tests.local_ts(0, '09:30', 'America/Manaus'))$$,
  'AE002', 'fora_do_expediente', 'Manaus 08:30 local fora do expediente');

-- Remarcação
select tests.authenticate_as(:'a'::uuid);
select id as r1 from public.create_appointment('R1', 'Corte', tests.local_ts(2, '10:00'), tests.local_ts(2, '11:00')) \gset
select id as r2 from public.create_appointment('R2', 'Corte', tests.local_ts(2, '14:00'), tests.local_ts(2, '15:00')) \gset

select lives_ok(
  format($$select public.reschedule_appointment(%L, tests.local_ts(2, '11:00'), tests.local_ts(2, '12:00'))$$, :'r1'),
  'remarcar para slot livre');
select ok((select previous_values ->> 'starts_at' <> new_values ->> 'starts_at'
    and previous_values ? 'ends_at' and new_values ? 'ends_at'
  from public.appointment_history where appointment_id = :'r1' and action = 'remarcado'),
  'histórico remarcado com horários antigos e novos');

select throws_ok(
  format($$select public.reschedule_appointment(%L, tests.local_ts(2, '14:30'), tests.local_ts(2, '15:30'))$$, :'r1'),
  'AE001', 'horario_indisponivel', 'remarcar para horário ocupado dá AE001');
select is((select starts_at from public.appointments where id = :'r1'), tests.local_ts(2, '11:00'),
  'linha original intacta após AE001');

select tests.reset_role();
update public.appointments set status = 'concluido' where id = :'r2';
select tests.authenticate_as(:'a'::uuid);
select throws_ok(
  format($$select public.reschedule_appointment(%L, tests.local_ts(2, '16:00'), tests.local_ts(2, '17:00'))$$, :'r2'),
  'AE005', 'transicao_invalida', 'remarcar concluído dá AE005');

select tests.authenticate_as(:'b'::uuid);
select throws_ok(
  format($$select public.reschedule_appointment(%L, tests.local_ts(2, '16:00'), tests.local_ts(2, '17:00'))$$, :'r1'),
  'AE006', 'agendamento_nao_encontrado', 'B não remarca agendamento de A');
select throws_ok(
  $$select public.reschedule_appointment(gen_random_uuid(), tests.local_ts(2, '16:00'), tests.local_ts(2, '17:00'))$$,
  'AE006', 'agendamento_nao_encontrado', 'id inexistente dá AE006');

-- Anon
select tests.authenticate_anon();
select throws_ok(
  $$select public.create_appointment('X', 'Y', tests.local_ts(3, '10:00'), tests.local_ts(3, '11:00'))$$,
  '42501', null, 'anon não executa create_appointment');

-- Normalização
select tests.authenticate_as(:'a'::uuid);
select id as n1 from public.create_appointment('  Ana  ', '  Corte  ', tests.local_ts(3, '10:00'), tests.local_ts(3, '11:00'), '', '   ') \gset
select is((select client_name || '|' || service_name from public.appointments where id = :'n1'), 'Ana|Corte',
  'nome e serviço aparados');
select ok((select client_phone is null and notes is null from public.appointments where id = :'n1'),
  'telefone e observações vazios viram null');

select * from finish();
rollback;
