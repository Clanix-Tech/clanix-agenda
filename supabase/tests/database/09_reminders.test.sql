begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

select tests.create_user('a@x.com') as a \gset
select tests.create_user('b@x.com') as b \gset
select tests.reset_role();

-- Perfil A: fuso de São Paulo, 30 min. Atendimento 14:00 BRT.
update public.profiles set reminder_minutes = 30 where id = :'a'::uuid;
insert into public.push_subscriptions (owner_id, endpoint, p256dh, auth)
values (:'a'::uuid, 'https://push.example/a1', 'p', 'a');

insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at, reminder_anchor_at)
values (:'a'::uuid, 'Juliana Rocha', 'Escova e hidratação', '2026-11-10T14:00-03', '2026-11-10T15:00-03', '2026-11-10T10:00-03')
returning id as ap \gset

-- Janela
select is((select count(*)::int from public.due_reminders('2026-11-10T13:29-03')), 0, 'antes da janela: vazio');
select is((select count(*)::int from public.due_reminders('2026-11-10T13:30-03')), 1, 'na janela: 1 lembrete');
select is((select body from public.due_reminders('2026-11-10T13:30-03')),
  '14:00 · Juliana Rocha — Escova e hidratação · em 30 min', 'corpo no formato do design');
select is((select title from public.due_reminders('2026-11-10T13:30-03')), 'Lembrete de atendimento', 'título');
select is((select url from public.due_reminders('2026-11-10T13:30-03')), '/?atendimento=' || :'ap', 'url');
select is((select owner_id from public.due_reminders('2026-11-10T13:30-03')), :'a'::uuid, 'owner_id');
select is((select starts_at from public.due_reminders('2026-11-10T13:30-03')), '2026-11-10T14:00-03'::timestamptz, 'starts_at');
select matches((select body from public.due_reminders('2026-11-10T13:45-03')), '· em 15 min$', 'em 15 min');
select matches((select body from public.due_reminders('2026-11-10T13:59:30-03')), '· em 1 min$', 'arredonda para cima: em 1 min');
select is((select count(*)::int from public.due_reminders('2026-11-10T14:00-03')), 0, 'no horário ou depois: vazio');

-- 60 min -> "em 1 hora"
update public.profiles set reminder_minutes = 60 where id = :'a'::uuid;
select matches((select body from public.due_reminders('2026-11-10T13:00-03')), '· em 1 hora$', 'em 1 hora');

-- Ocultar nome
update public.profiles set reminder_minutes = 30, hide_client_name_in_notifications = true where id = :'a'::uuid;
select is((select body from public.due_reminders('2026-11-10T13:30-03')),
  'Atendimento às 14:00 · em 30 min', 'nome e serviço ocultos');
update public.profiles set hide_client_name_in_notifications = false where id = :'a'::uuid;

-- Lembrete desligado
update public.profiles set reminder_minutes = null where id = :'a'::uuid;
select is((select count(*)::int from public.due_reminders('2026-11-10T13:30-03')), 0, 'reminder_minutes nulo: vazio');
update public.profiles set reminder_minutes = 30 where id = :'a'::uuid;

-- Status
update public.appointments set status = 'concluido' where id = :'ap'::uuid;
select is((select count(*)::int from public.due_reminders('2026-11-10T13:30-03')), 0, 'concluido: vazio');
update public.appointments set status = 'agendado' where id = :'ap'::uuid;
update public.appointments set status = 'cancelado', canceled_at = now() where id = :'ap'::uuid;
select is((select count(*)::int from public.due_reminders('2026-11-10T13:30-03')), 0, 'cancelado: vazio');

-- Reativar atualiza a âncora; editar só observações não
update public.appointments set reminder_anchor_at = '2020-01-01' where id = :'ap'::uuid;
update public.appointments set status = 'agendado', canceled_at = null where id = :'ap'::uuid;
select ok((select reminder_anchor_at > '2020-01-01' from public.appointments where id = :'ap'::uuid),
  'reativar cancelado atualiza reminder_anchor_at');
update public.appointments set reminder_anchor_at = '2020-01-01' where id = :'ap'::uuid;
update public.appointments set notes = 'só observação' where id = :'ap'::uuid;
select is((select reminder_anchor_at from public.appointments where id = :'ap'::uuid),
  '2020-01-01'::timestamptz, 'editar só observações não atualiza reminder_anchor_at');

-- Dono sem assinatura
select tests.create_user('c@x.com') as c \gset
select tests.reset_role();
insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at, reminder_anchor_at)
values (:'c'::uuid, 'Sem Push', 'Corte', '2026-11-10T14:00-03', '2026-11-10T15:00-03', '2026-11-10T10:00-03');
select is((select count(*)::int from public.due_reminders('2026-11-10T13:30-03') where owner_id = :'c'::uuid),
  0, 'dono sem assinatura: vazio');

-- Âncora: marcado às 13:50 para 14:00 (antecedência 30) não avisa
update public.appointments set reminder_anchor_at = '2026-11-10T13:50-03' where id = :'ap'::uuid;
select is((select count(*)::int from public.due_reminders('2026-11-10T13:51-03')), 0,
  'marcado dentro da janela de aviso: vazio');
update public.appointments set reminder_anchor_at = '2020-01-01' where id = :'ap'::uuid;

-- Reserva (claim)
select is(public.claim_reminder(:'ap'::uuid, '2026-11-10T14:00-03'), true, 'claim: primeira vez true');
select is(public.claim_reminder(:'ap'::uuid, '2026-11-10T14:00-03'), false, 'claim: segunda vez false');
select is((select count(*)::int from public.due_reminders('2026-11-10T13:30-03')), 0, 'depois do claim: vazio');
select lives_ok(format($$select public.release_reminder(%L, '2026-11-10T14:00-03')$$, :'ap'), 'release_reminder');
select is((select count(*)::int from public.due_reminders('2026-11-10T13:30-03')), 1, 'depois do release: devido de novo');
select is(public.claim_reminder(:'ap'::uuid, '2026-11-10T14:00-03'), true, 'claim volta a dar true após release');

-- Remarcar para 16:00: devido de novo no novo horário (a reserva antiga é do par antigo)
update public.appointments set starts_at = '2026-11-10T16:00-03', ends_at = '2026-11-10T17:00-03' where id = :'ap'::uuid;
update public.appointments set reminder_anchor_at = '2020-01-01' where id = :'ap'::uuid;
select is((select count(*)::int from public.due_reminders('2026-11-10T15:30-03')), 1, 'remarcado: devido de novo');
select matches((select body from public.due_reminders('2026-11-10T15:30-03')), '^16:00 ', 'texto com o novo horário');

-- Remarcar atualiza a âncora: remarcado para dentro da janela não avisa
update public.appointments set reminder_anchor_at = '2020-01-01' where id = :'ap'::uuid;
update public.appointments set starts_at = '2026-11-10T17:00-03', ends_at = '2026-11-10T18:00-03' where id = :'ap'::uuid;
select ok((select reminder_anchor_at > '2020-01-01' from public.appointments where id = :'ap'::uuid),
  'remarcar atualiza reminder_anchor_at');

-- Fuso do perfil: America/Manaus com sessão em UTC
select tests.create_user('m@x.com') as m \gset
select tests.reset_role();
update public.profiles set timezone = 'America/Manaus', reminder_minutes = 30 where id = :'m'::uuid;
insert into public.push_subscriptions (owner_id, endpoint, p256dh, auth)
values (:'m'::uuid, 'https://push.example/m1', 'p', 'a');
insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at, reminder_anchor_at)
values (:'m'::uuid, 'Cliente Manaus', 'Corte', '2026-11-10T14:00-04', '2026-11-10T15:00-04', '2026-11-10T10:00-03');
set local timezone = 'UTC';
select matches((select body from public.due_reminders('2026-11-10T13:30-04') where owner_id = :'m'::uuid),
  '^14:00 · Cliente Manaus', 'texto no fuso do perfil (Manaus), sessão em UTC');

-- Nome longo
select tests.create_user('l@x.com') as l \gset
select tests.reset_role();
insert into public.push_subscriptions (owner_id, endpoint, p256dh, auth)
values (:'l'::uuid, 'https://push.example/l1', 'p', 'a');
insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at, reminder_anchor_at)
values (:'l'::uuid, repeat('x', 120), 'Corte', '2026-11-10T14:00-03', '2026-11-10T15:00-03', '2026-11-10T10:00-03');
select is((select body from public.due_reminders('2026-11-10T13:30-03') where owner_id = :'l'::uuid),
  '14:00 · ' || repeat('x', 60) || '… — Corte · em 30 min', 'nome cortado em 60 caracteres com reticências');

-- Limite superior: atendimento a 3 horas não é devido cedo
select is((select count(*)::int from public.due_reminders('2026-11-10T11:00-03') where owner_id = :'a'::uuid),
  0, 'atendimento a 3 horas não é devolvido');

-- Claim só vale para atendimento agendado e no mesmo horário
select tests.create_user('k@x.com') as k \gset
select tests.reset_role();
insert into public.appointments (owner_id, client_name, service_name, starts_at, ends_at, reminder_anchor_at)
values (:'k'::uuid, 'Cliente K', 'Corte', '2026-11-10T14:00-03', '2026-11-10T15:00-03', '2026-11-10T10:00-03')
returning id as kp \gset
update public.appointments set status = 'cancelado', canceled_at = '2026-11-10T13:00-03' where id = :'kp'::uuid;
select is(public.claim_reminder(:'kp'::uuid, '2026-11-10T14:00-03'), false, 'claim após cancelar: false');
update public.appointments set status = 'agendado', canceled_at = null,
  starts_at = '2026-11-10T16:00-03', ends_at = '2026-11-10T17:00-03' where id = :'kp'::uuid;
select is(public.claim_reminder(:'kp'::uuid, '2026-11-10T14:00-03'), false, 'claim com horário antigo após remarcar: false');

-- Privilégios
select tests.authenticate_as(:'a'::uuid);
select throws_ok($$select * from public.due_reminders()$$, '42501', null, 'authenticated sem due_reminders');
select throws_ok($$select public.claim_reminder(gen_random_uuid(), now())$$, '42501', null, 'authenticated sem claim_reminder');
select throws_ok($$select public.release_reminder(gen_random_uuid(), now())$$, '42501', null, 'authenticated sem release_reminder');
select throws_ok(
  $$insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/x', 'p', 'a')$$,
  '42501', null, 'insert direto em push_subscriptions negado');

-- Claim da assinatura: A registra, B registra o mesmo endpoint
select public.register_push_subscription('https://push.example/abc', 'p-a', 'a-a', 'Celular A');
select tests.authenticate_as(:'b'::uuid);
select public.register_push_subscription('https://push.example/abc', 'p-b', 'a-b', 'Celular B');
select is((select owner_id || '|' || p256dh || '|' || auth from public.push_subscriptions where endpoint = 'https://push.example/abc'),
  :'b' || '|p-b|a-b', 'claim: linha passa a ser de B com chaves novas');
select tests.authenticate_as(:'a'::uuid);
select is((select count(*)::int from public.push_subscriptions where endpoint = 'https://push.example/abc'), 0,
  'A não vê mais a assinatura');

-- Validação e autenticação
select throws_ok($$select public.register_push_subscription('http://push.example/z', 'p', 'a')$$,
  '23514', null, 'endpoint http rejeitado');
select tests.reset_role();
select throws_ok($$select public.register_push_subscription('https://push.example/z', 'p', 'a')$$,
  '42501', null, 'sem auth.uid(): 42501');

select * from finish();
rollback;
