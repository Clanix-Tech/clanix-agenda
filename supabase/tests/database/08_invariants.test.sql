begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

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
      and has_function_privilege('anon', p.oid, 'execute')
      -- public.ping() é a única exceção: sonda de disponibilidade que não lê tabela.
      and p.oid <> 'public.ping()'::regprocedure),
  '', 'nenhuma função de public/app_private (dono postgres) executável por anon (exceto ping)');

select is(
  (select coalesce(string_agg(p.oid::regprocedure::text, ', '), '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private'
      and has_function_privilege('authenticated', p.oid, 'execute')),
  '', 'nenhuma função de app_private executável por authenticated');

select is(
  (select coalesce(string_agg(p.oid::regprocedure::text, ', '), '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private') and p.prosecdef
      and not coalesce('search_path=""' = any (p.proconfig), false)),
  '', 'toda função SECURITY DEFINER de public/app_private fixa search_path vazio');

select * from finish();
rollback;
