-- Migração base: extensões, schema privado, tipos e utilitários.

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Schema privado: sem acesso para anon/authenticated.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create type public.appointment_status as enum ('agendado', 'concluido', 'cancelado', 'nao_compareceu');
create type public.history_action as enum ('criado', 'editado', 'remarcado', 'status_alterado', 'cancelado', 'reativado');
create type public.timerange as range (subtype = time);

create function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function app_private.set_updated_at() from public;

-- Nenhuma permissão implícita: tudo é concedido explicitamente nas migrações seguintes.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- O EXECUTE para PUBLIC vem do default global do Postgres; só o revoke sem IN SCHEMA o remove.
alter default privileges for role postgres revoke execute on functions from public;
