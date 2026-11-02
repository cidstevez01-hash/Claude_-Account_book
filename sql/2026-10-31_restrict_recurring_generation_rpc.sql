-- B-87: prevent direct calls to the global SECURITY DEFINER generator through the Data API.
-- The existing pg_cron job runs as postgres, so retain EXECUTE for postgres only.
begin;
revoke execute on function public.generate_recurring_entries() from public, anon, authenticated;
grant execute on function public.generate_recurring_entries() to postgres;
alter function public.generate_recurring_entries() set search_path = '';
commit;

-- Expected result after applying: public_execute=false, anon_execute=false,
-- authenticated_execute=false, postgres_execute=true.
select
  p.oid::regprocedure::text as function_name,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('postgres', p.oid, 'EXECUTE') as postgres_execute,
  p.proconfig as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'generate_recurring_entries'
  and pg_get_function_identity_arguments(p.oid) = '';
