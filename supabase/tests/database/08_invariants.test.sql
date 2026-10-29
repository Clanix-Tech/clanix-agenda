begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- Guardas de catálogo: valem para qualquer tabela/função criada em planos futuros.

select is(
  (select coalesce(string_agg(c.relname, ', '), '')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  '', 'toda tabela de public tem RLS habilitado');

select is(
  (select coalesce(string_agg(c.relname, ', '), '')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and (has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger')
           or has_any_column_privilege('anon', c.oid, 'select,insert,update,references'))),
  '', 'anon não tem privilégio em nenhuma tabela de public');

select is(
  (select coalesce(string_agg(p.oid::regprocedure::text, ', '), '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private')
      and pg_get_userbyid(p.proowner) = 'postgres'
      and has_function_privilege('anon', p.oid, 'execute')),
  '', 'nenhuma função de public/app_private (dono postgres) executável por anon');

select is(
  (select coalesce(string_agg(p.oid::regprocedure::text, ', '), '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private'
      and has_function_privilege('authenticated', p.oid, 'execute')),
  '', 'nenhuma função de app_private executável por authenticated');

select * from finish();
rollback;
