-- Serviços favoritos: atalhos (nome + duração sugerida + cor opcional) usados ao preencher um atendimento.
-- Gravados direto pelo navegador via RLS; grants por coluna impedem alterar owner_id.

create table public.favorite_services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  duration_minutes int not null check (duration_minutes between 5 and 480),
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.favorite_services is 'Atalhos de serviço (nome, duração sugerida, cor) por usuário.';

create unique index favorite_services_owner_name_key
  on public.favorite_services (owner_id, lower(btrim(name)));

create trigger favorite_services_set_updated_at
  before update on public.favorite_services
  for each row execute function app_private.set_updated_at();

alter table public.favorite_services enable row level security;

grant select, delete on public.favorite_services to authenticated;
grant insert (name, duration_minutes, color, is_active) on public.favorite_services to authenticated;
grant update (name, duration_minutes, color, is_active) on public.favorite_services to authenticated;

create policy favorite_services_select_own on public.favorite_services
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy favorite_services_insert_own on public.favorite_services
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy favorite_services_update_own on public.favorite_services
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy favorite_services_delete_own on public.favorite_services
  for delete to authenticated
  using (owner_id = (select auth.uid()));
