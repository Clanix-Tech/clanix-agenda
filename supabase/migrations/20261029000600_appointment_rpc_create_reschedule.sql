-- RPCs de criação e remarcação de agendamentos.
-- Erros de regra: errcode AE00X + message com a chave (contrato com o frontend).

create function app_private.require_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'nao_autenticado';
  end if;
  return v_uid;
end;
$$;

create function app_private.assert_valid_slot(
  p_owner uuid, p_starts timestamptz, p_ends timestamptz, p_confirm_past boolean)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_local_start timestamp;
  v_local_end timestamp;
begin
  select p.timezone into v_tz from public.profiles p where p.id = p_owner;
  v_tz := coalesce(v_tz, 'America/Sao_Paulo');
  v_local_start := p_starts at time zone v_tz;
  v_local_end := p_ends at time zone v_tz;

  -- 1) não atravessa a meia-noite (terminar às 00:00 do dia seguinte também conta)
  if v_local_start::date <> v_local_end::date then
    raise exception using errcode = 'AE003', message = 'atravessa_meia_noite';
  end if;

  -- 2) passado exige confirmação
  if p_starts < pg_catalog.now() and not coalesce(p_confirm_past, false) then
    raise exception using errcode = 'AE004', message = 'horario_passado_sem_confirmacao';
  end if;

  -- 3) início futuro: precisa caber inteiro em um turno do dia
  if p_starts >= pg_catalog.now() then
    if not exists (
      select 1
      from public.business_hours bh
      where bh.owner_id = p_owner
        and bh.weekday = extract(dow from v_local_start)::int
        and bh.start_time <= v_local_start::time
        and bh.end_time >= v_local_end::time
    ) then
      raise exception using errcode = 'AE002', message = 'fora_do_expediente';
    end if;
  end if;
end;
$$;

create function app_private.load_own_appointment(p_id uuid, p_owner uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.appointments;
begin
  select a.* into v_row
  from public.appointments a
  where a.id = p_id and a.owner_id = p_owner
  for update;

  if not found then
    raise exception using errcode = 'AE006', message = 'agendamento_nao_encontrado';
  end if;
  return v_row;
end;
$$;

revoke all on function app_private.require_user() from public;
revoke all on function app_private.assert_valid_slot(uuid, timestamptz, timestamptz, boolean) from public;
revoke all on function app_private.load_own_appointment(uuid, uuid) from public;

create function public.create_appointment(
  p_client_name text,
  p_service_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_client_phone text default null,
  p_notes text default null,
  p_confirm_past boolean default false)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := app_private.require_user();
  v_row public.appointments;
  v_constraint text;
begin
  perform app_private.assert_valid_slot(v_owner, p_starts_at, p_ends_at, p_confirm_past);

  begin
    insert into public.appointments (owner_id, client_name, client_phone, service_name, starts_at, ends_at, notes)
    values (
      v_owner,
      pg_catalog.btrim(p_client_name),
      nullif(pg_catalog.btrim(p_client_phone), ''),
      pg_catalog.btrim(p_service_name),
      p_starts_at,
      p_ends_at,
      nullif(pg_catalog.btrim(p_notes), ''))
    returning * into v_row;
  exception when exclusion_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'appointments_no_overlap' then
      raise exception using errcode = 'AE001', message = 'horario_indisponivel';
    end if;
    raise;
  end;

  return v_row;
end;
$$;

create function public.reschedule_appointment(
  p_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_confirm_past boolean default false)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := app_private.require_user();
  v_row public.appointments;
  v_constraint text;
begin
  v_row := app_private.load_own_appointment(p_id, v_owner);

  if v_row.status <> 'agendado' then
    raise exception using errcode = 'AE005', message = 'transicao_invalida';
  end if;

  perform app_private.assert_valid_slot(v_owner, p_starts_at, p_ends_at, p_confirm_past);

  begin
    update public.appointments
       set starts_at = p_starts_at, ends_at = p_ends_at
     where id = p_id and owner_id = v_owner
    returning * into v_row;
  exception when exclusion_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'appointments_no_overlap' then
      raise exception using errcode = 'AE001', message = 'horario_indisponivel';
    end if;
    raise;
  end;

  return v_row;
end;
$$;

revoke all on function public.create_appointment(text, text, timestamptz, timestamptz, text, text, boolean) from public;
revoke all on function public.reschedule_appointment(uuid, timestamptz, timestamptz, boolean) from public;
grant execute on function public.create_appointment(text, text, timestamptz, timestamptz, text, text, boolean) to authenticated;
grant execute on function public.reschedule_appointment(uuid, timestamptz, timestamptz, boolean) to authenticated;
