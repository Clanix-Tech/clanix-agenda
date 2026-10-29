-- Agendamentos: tabela com restrição de conflito por profissional e histórico gravado apenas por trigger.
-- O navegador só lê (select); todas as escritas passam por RPCs security definer (Tasks 7-8),
-- que traduzem a violação de `appointments_no_overlap` (SQLSTATE 23P01) em AE001.

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  client_name text not null
    check (client_name = btrim(client_name) and char_length(client_name) between 1 and 120),
  client_phone text
    check (client_phone is null
      or (char_length(client_phone) between 8 and 20 and client_phone ~ '^[0-9()+ -]+$')),
  service_name text not null
    check (service_name = btrim(service_name) and char_length(service_name) between 1 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'agendado',
  notes text check (notes is null or char_length(notes) <= 1000),
  cancellation_reason text check (cancellation_reason is null or char_length(cancellation_reason) <= 300),
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_time_order check (ends_at > starts_at),
  constraint appointments_max_duration check (ends_at - starts_at <= interval '12 hours'),
  constraint appointments_minute_precision check (
    starts_at = date_trunc('minute', starts_at, 'UTC') and ends_at = date_trunc('minute', ends_at, 'UTC')),
  constraint appointments_canceled_consistency check ((status = 'cancelado') = (canceled_at is not null)),
  constraint appointments_no_overlap exclude using gist (
    owner_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelado')
);

comment on table public.appointments is 'Atendimentos agendados. Sem sobreposição entre ativos (não cancelados) do mesmo dono.';

create index appointments_owner_starts_idx on public.appointments (owner_id, starts_at);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function app_private.set_updated_at();

create table public.appointment_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid,
  action public.history_action not null,
  previous_values jsonb,
  new_values jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.appointment_history is 'Histórico imutável de alterações; gravado só pelo trigger de appointments.';

create index appointment_history_appointment_created_idx
  on public.appointment_history (appointment_id, created_at);

-- Colunas rastreadas que mudaram entre old e new (apenas elas), em dois jsonb.
create function app_private.appointment_changes(
  p_old public.appointments,
  p_new public.appointments,
  out previous_values jsonb,
  out new_values jsonb
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_old jsonb := to_jsonb(p_old);
  v_new jsonb := to_jsonb(p_new);
  v_col text;
begin
  previous_values := '{}'::jsonb;
  new_values := '{}'::jsonb;
  foreach v_col in array array[
    'client_name', 'client_phone', 'service_name', 'notes',
    'starts_at', 'ends_at', 'status', 'cancellation_reason', 'canceled_at'
  ] loop
    if v_old -> v_col is distinct from v_new -> v_col then
      previous_values := previous_values || jsonb_build_object(v_col, v_old -> v_col);
      new_values := new_values || jsonb_build_object(v_col, v_new -> v_col);
    end if;
  end loop;
end;
$$;

create function app_private.record_appointment_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action public.history_action;
  v_prev jsonb;
  v_new jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.appointment_history (appointment_id, owner_id, actor_id, action, previous_values, new_values)
    values (new.id, new.owner_id, auth.uid(), 'criado', null, to_jsonb(new) - 'owner_id');
    return null;
  end if;

  select c.previous_values, c.new_values into v_prev, v_new
  from app_private.appointment_changes(old, new) c;

  if v_new = '{}'::jsonb then
    return null; -- nenhuma coluna rastreada mudou
  end if;

  v_action := case
    when old.status = 'cancelado' and new.status = 'agendado' then 'reativado'
    when new.status = 'cancelado' and old.status <> 'cancelado' then 'cancelado'
    when new.status <> old.status then 'status_alterado'
    when new.starts_at <> old.starts_at or new.ends_at <> old.ends_at then 'remarcado'
    else 'editado'
  end;

  insert into public.appointment_history (appointment_id, owner_id, actor_id, action, previous_values, new_values)
  values (new.id, new.owner_id, auth.uid(), v_action, v_prev, v_new);
  return null;
end;
$$;

revoke all on function app_private.appointment_changes(public.appointments, public.appointments) from public;
revoke all on function app_private.record_appointment_history() from public;

create trigger appointments_record_history
  after insert or update on public.appointments
  for each row execute function app_private.record_appointment_history();

alter table public.appointments enable row level security;
alter table public.appointment_history enable row level security;

grant select on public.appointments to authenticated;
grant select on public.appointment_history to authenticated;

create policy appointments_select_own on public.appointments
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy appointment_history_select_own on public.appointment_history
  for select to authenticated
  using (owner_id = (select auth.uid()));
