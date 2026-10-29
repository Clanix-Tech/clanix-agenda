-- Expediente: turnos de trabalho por dia da semana (0 = domingo ... 6 = sábado).
-- O almoço é o intervalo entre dois turnos do mesmo dia.

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time),
  -- precisão de minuto (segundos e frações = 0); date_trunc não aceita time
  check (extract(second from start_time) = 0 and extract(second from end_time) = 0),
  exclude using gist (
    owner_id with =,
    weekday with =,
    public.timerange(start_time, end_time, '[)') with &&
  )
);

comment on table public.business_hours is 'Turnos de expediente por dia da semana (0 = domingo); almoço = intervalo entre turnos.';

create index business_hours_owner_weekday_idx on public.business_hours (owner_id, weekday);

alter table public.business_hours enable row level security;

grant select on public.business_hours to authenticated;

create policy business_hours_select_own on public.business_hours
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- Substitui todo o expediente do usuário de forma atômica.
-- p_shifts: [{"weekday": 0-6, "start_time": "HH:MM", "end_time": "HH:MM"}, ...]
create function public.set_business_hours(p_shifts jsonb)
returns setof public.business_hours
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception using errcode = '42501', message = 'nao_autenticado';
  end if;

  if p_shifts is null
     or pg_catalog.jsonb_typeof(p_shifts) <> 'array'
     or pg_catalog.jsonb_array_length(p_shifts) > 21 then
    raise exception using errcode = '22023', message = 'expediente_invalido';
  end if;

  begin
    delete from public.business_hours where owner_id = v_owner;

    insert into public.business_hours (owner_id, weekday, start_time, end_time)
    select
      v_owner,
      (s ->> 'weekday')::smallint,
      (s ->> 'start_time')::time,
      (s ->> 'end_time')::time
    from pg_catalog.jsonb_array_elements(p_shifts) as s;
  exception
    when exclusion_violation
      or check_violation
      or not_null_violation
      or invalid_text_representation
      or invalid_datetime_format
      or datetime_field_overflow
      or numeric_value_out_of_range
      or invalid_parameter_value then
      raise exception using errcode = '22023', message = 'expediente_invalido';
  end;

  return query
    select b.*
    from public.business_hours b
    where b.owner_id = v_owner
    order by b.weekday, b.start_time;
end;
$$;

grant execute on function public.set_business_hours(jsonb) to authenticated;
