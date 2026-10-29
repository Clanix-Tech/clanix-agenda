-- Perfis dos usuários (um por usuário de auth.users), criados automaticamente.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 80),
  business_name text
    check (business_name is null or char_length(btrim(business_name)) between 1 and 80),
  timezone text not null default 'America/Sao_Paulo',
  default_duration_minutes int not null default 60
    check (default_duration_minutes between 5 and 480),
  slot_interval_minutes int not null default 30
    check (slot_interval_minutes in (15, 30, 60)),
  week_starts_on smallint not null default 1
    check (week_starts_on between 0 and 6),
  default_view text not null default 'semana'
    check (default_view in ('dia', 'semana', 'mes', 'lista')),
  reminder_minutes int default 30
    check (reminder_minutes is null or reminder_minutes in (15, 30, 60)),
  hide_client_name_in_notifications boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil e preferências do usuário; o fuso daqui é a fonte de verdade para horários.';

-- Valida o fuso horário contra pg_timezone_names.
create function app_private.validate_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception using errcode = '22023', message = 'fuso_invalido';
  end if;
  return new;
end;
$$;

create trigger profiles_validate
  before insert or update on public.profiles
  for each row execute function app_private.validate_profile();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function app_private.set_updated_at();

-- Cria o perfil quando um usuário é criado em auth.users.
create function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Nunca pode falhar: o cadastro em auth.users depende deste trigger.
    coalesce(
      nullif(pg_catalog.btrim(pg_catalog.left(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), 80)), ''),
      nullif(pg_catalog.btrim(pg_catalog.left(pg_catalog.split_part(coalesce(new.email, ''), '@', 1), 80)), ''),
      'Usuário'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;
grant update (
  display_name, business_name, timezone, default_duration_minutes,
  slot_interval_minutes, week_starts_on, default_view, reminder_minutes,
  hide_client_name_in_notifications
) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
