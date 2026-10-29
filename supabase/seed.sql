-- SOMENTE helpers de teste (schema `tests`). Nunca coloque dados fictícios aqui.
create schema if not exists tests;

create or replace function tests.create_user(p_email text, p_display_name text default null)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_email, extensions.crypt('senha-de-teste', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    case when p_display_name is null then '{}'::jsonb
         else jsonb_build_object('display_name', p_display_name) end,
    now(), now()
  );
  return v_id;
end;
$$;

create or replace function tests.authenticate_as(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end;
$$;

create or replace function tests.authenticate_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end;
$$;

create or replace function tests.reset_role()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- plpgsql: public.business_hours só existe a partir da Task 4; resolvida na chamada.
create or replace function tests.set_default_hours(p_user uuid)
returns void
language plpgsql
as $$
begin
  insert into public.business_hours (owner_id, weekday, start_time, end_time)
  select p_user, d::smallint, t.s, t.e
  from generate_series(1, 5) as d,
       (values ('09:00'::time, '12:00'::time), ('13:00'::time, '18:00'::time)) as t(s, e);
end;
$$;

-- Segunda-feira da PRÓXIMA semana no fuso p_tz, + dias, + hora.
create or replace function tests.local_ts(
  p_days_from_next_monday int, p_time time, p_tz text default 'America/Sao_Paulo')
returns timestamptz
language plpgsql
stable
as $$
declare
  v_today date := (now() at time zone p_tz)::date;
  v_monday date := v_today + (8 - extract(isodow from v_today)::int);
begin
  return ((v_monday + p_days_from_next_monday) + p_time) at time zone p_tz;
end;
$$;

grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;
