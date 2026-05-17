create extension if not exists pg_cron;

create or replace function public.expire_stale_responses()
returns void
language sql
security definer
set search_path = public
as $$
  update public.responses
  set
    status = 'expired',
    updated_at = now()
  where status = 'in_progress'
    and started_at < now() - interval '30 days';
$$;

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'expire-stale-responses'
  ) then
    perform cron.schedule(
      'expire-stale-responses',
      '0 3 * * *',
      'select public.expire_stale_responses();'
    );
  end if;
end;
$$;
