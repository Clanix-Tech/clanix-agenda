-- Lembretes por notificação: âncora de aviso, lembretes devidos (texto no fuso do
-- perfil), reserva at-most-once e registro de assinatura Web Push com "claim".

-- Momento a partir do qual um aviso ainda faz sentido: um aviso cujo momento já tinha
-- passado quando o horário foi marcado não deve ser enviado.
alter table public.appointments
  add column reminder_anchor_at timestamptz not null default now();

comment on column public.appointments.reminder_anchor_at is
  'Quando o horário atual foi marcado (ou o atendimento reativado); avisos anteriores a isso não são enviados.';

-- Linhas existentes: o horário foi marcado na criação.
alter table public.appointments disable trigger user;
update public.appointments set reminder_anchor_at = created_at;
alter table public.appointments enable trigger user;

create function app_private.set_reminder_anchor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.starts_at is distinct from old.starts_at
     or (old.status = 'cancelado' and new.status = 'agendado') then
    new.reminder_anchor_at := now();
  end if;
  return new;
end;
$$;
revoke all on function app_private.set_reminder_anchor() from public;

create trigger appointments_set_reminder_anchor
  before update on public.appointments
  for each row execute function app_private.set_reminder_anchor();

create index push_subscriptions_owner_idx on public.push_subscriptions (owner_id);

-- O navegador deixa de inserir direto: grava só por register_push_subscription.
revoke insert (endpoint, p256dh, auth, device_label) on public.push_subscriptions from authenticated;
revoke insert on public.push_subscriptions from authenticated;
drop policy push_subscriptions_insert_own on public.push_subscriptions;

create function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_device_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_id uuid;
begin
  if v_owner is null then
    raise exception using errcode = '42501', message = 'nao_autenticado';
  end if;

  -- "Claim": o mesmo navegador/endpoint passa a pertencer a quem registrou por último.
  insert into public.push_subscriptions (owner_id, endpoint, p256dh, auth, device_label)
  values (v_owner, p_endpoint, p_p256dh, p_auth, p_device_label)
  on conflict (endpoint) do update
    set owner_id = v_owner,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        device_label = excluded.device_label,
        last_used_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create function public.due_reminders(p_now timestamptz default now())
returns table (
  appointment_id uuid,
  owner_id uuid,
  starts_at timestamptz,
  title text,
  body text,
  url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.owner_id,
    a.starts_at,
    'Lembrete de atendimento'::text,
    case
      when p.hide_client_name_in_notifications then
        'Atendimento às ' || to_char(a.starts_at at time zone p.timezone, 'HH24:MI')
      else
        to_char(a.starts_at at time zone p.timezone, 'HH24:MI') || ' · '
        || case when char_length(a.client_name) > 60 then left(a.client_name, 60) || '…' else a.client_name end
        || ' — ' || a.service_name
    end
    || ' · '
    || case
         when ceil(extract(epoch from (a.starts_at - p_now)) / 60) = 60 then 'em 1 hora'
         else 'em ' || ceil(extract(epoch from (a.starts_at - p_now)) / 60)::int || ' min'
       end,
    '/?atendimento=' || a.id
  from public.appointments a
  join public.profiles p on p.id = a.owner_id
  where a.status = 'agendado'
    and p.reminder_minutes is not null
    and a.starts_at > p_now
    and a.starts_at <= p_now + interval '60 minutes' -- 60 é o maior reminder_minutes permitido
    and a.starts_at - p.reminder_minutes * interval '1 minute' <= p_now
    and a.starts_at - p.reminder_minutes * interval '1 minute' >= a.reminder_anchor_at
    and not exists (
      select 1 from public.appointment_reminders r
       where r.appointment_id = a.id and r.starts_at = a.starts_at)
    and exists (
      select 1 from public.push_subscriptions s where s.owner_id = a.owner_id);
$$;

create function public.claim_reminder(p_appointment_id uuid, p_starts_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  -- Só reserva se o atendimento ainda está agendado nesse horário (evita aviso velho
  -- se foi cancelado ou remarcado entre due_reminders e claim_reminder).
  insert into public.appointment_reminders (appointment_id, starts_at)
  select a.id, a.starts_at
    from public.appointments a
   where a.id = p_appointment_id
     and a.status = 'agendado'
     and a.starts_at = p_starts_at
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create function public.release_reminder(p_appointment_id uuid, p_starts_at timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.appointment_reminders
   where appointment_id = p_appointment_id and starts_at = p_starts_at;
$$;

revoke all on function public.register_push_subscription(text, text, text, text) from public;
revoke all on function public.due_reminders(timestamptz) from public;
revoke all on function public.claim_reminder(uuid, timestamptz) from public;
revoke all on function public.release_reminder(uuid, timestamptz) from public;
revoke execute on function public.due_reminders(timestamptz) from anon, authenticated;
revoke execute on function public.claim_reminder(uuid, timestamptz) from anon, authenticated;
revoke execute on function public.release_reminder(uuid, timestamptz) from anon, authenticated;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.due_reminders(timestamptz) to service_role;
grant execute on function public.claim_reminder(uuid, timestamptz) to service_role;
grant execute on function public.release_reminder(uuid, timestamptz) to service_role;
