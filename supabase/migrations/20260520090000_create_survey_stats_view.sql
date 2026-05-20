create index if not exists responses_stats_filter_idx
on public.responses (survey_slug, language, status, started_at);

create or replace view public.survey_stats as
select
  survey_slug,
  language,
  status,
  (date_trunc('day', started_at at time zone 'UTC'))::date as day,
  count(*)::bigint as n,
  count(*) filter (where status = 'completed')::bigint as completed,
  count(*) filter (where status = 'in_progress')::bigint as in_progress,
  coalesce(
    sum(
      case
        when completed_at is not null
          and started_at is not null
          and completed_at > started_at
          and completed_at - started_at < interval '6 hours'
        then floor(extract(epoch from (completed_at - started_at)) * 1000)::bigint
        else 0
      end
    ),
    0
  )::bigint as duration_ms_sum,
  count(*) filter (
    where completed_at is not null
      and started_at is not null
      and completed_at > started_at
      and completed_at - started_at < interval '6 hours'
  )::bigint as duration_count
from public.responses
group by survey_slug, language, status, (date_trunc('day', started_at at time zone 'UTC'))::date;
