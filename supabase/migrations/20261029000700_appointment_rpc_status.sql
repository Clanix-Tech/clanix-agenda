-- RPCs de edição, status, cancelamento e reativação de agendamentos.
-- O histórico é gravado pelo trigger de public.appointments; aqui só se altera a linha.

create function public.update_appointment_details(
  p_id uuid,
  p_client_name text,
  p_service_name text,
  p_client_phone text default null,
  p_notes text default null)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := app_private.require_user();
  v_row public.appointments;
begin
  v_row := app_private.load_own_appointment(p_id, v_owner);

  if v_row.status = 'cancelado' then
    raise exception using errcode = 'AE005', message = 'transicao_invalida';
  end if;

  update public.appointments
     set client_name = pg_catalog.btrim(p_client_name),
         service_name = pg_catalog.btrim(p_service_name),
         client_phone = nullif(pg_catalog.btrim(p_client_phone), ''),
         notes = nullif(pg_catalog.btrim(p_notes), '')
   where id = p_id and owner_id = v_owner
  returning * into v_row;

  return v_row;
end;
$$;

create function public.set_appointment_status(
  p_id uuid,
  p_status public.appointment_status)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := app_private.require_user();
  v_row public.appointments;
begin
  v_row := app_private.load_own_appointment(p_id, v_owner);

  if not (
       (v_row.status = 'agendado' and p_status in ('concluido', 'nao_compareceu'))
    or (v_row.status = 'concluido' and p_status in ('nao_compareceu', 'agendado'))
    or (v_row.status = 'nao_compareceu' and p_status in ('concluido', 'agendado'))
  ) then
    raise exception using errcode = 'AE005', message = 'transicao_invalida';
  end if;

  update public.appointments
     set status = p_status
   where id = p_id and owner_id = v_owner
  returning * into v_row;

  return v_row;
end;
$$;

create function public.cancel_appointment(
  p_id uuid,
  p_reason text default null)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := app_private.require_user();
  v_row public.appointments;
begin
  v_row := app_private.load_own_appointment(p_id, v_owner);

  if v_row.status <> 'agendado' then
    raise exception using errcode = 'AE005', message = 'transicao_invalida';
  end if;

  update public.appointments
     set status = 'cancelado',
         canceled_at = pg_catalog.now(),
         cancellation_reason = nullif(pg_catalog.btrim(p_reason), '')
   where id = p_id and owner_id = v_owner
  returning * into v_row;

  return v_row;
end;
$$;

create function public.reactivate_appointment(p_id uuid)
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

  if v_row.status <> 'cancelado' then
    raise exception using errcode = 'AE005', message = 'transicao_invalida';
  end if;

  perform app_private.assert_valid_slot(v_owner, v_row.starts_at, v_row.ends_at, p_confirm_past => true);

  begin
    update public.appointments
       set status = 'agendado',
           canceled_at = null,
           cancellation_reason = null
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

revoke all on function public.update_appointment_details(uuid, text, text, text, text) from public;
revoke all on function public.set_appointment_status(uuid, public.appointment_status) from public;
revoke all on function public.cancel_appointment(uuid, text) from public;
revoke all on function public.reactivate_appointment(uuid) from public;
grant execute on function public.update_appointment_details(uuid, text, text, text, text) to authenticated;
grant execute on function public.set_appointment_status(uuid, public.appointment_status) to authenticated;
grant execute on function public.cancel_appointment(uuid, text) to authenticated;
grant execute on function public.reactivate_appointment(uuid) to authenticated;
