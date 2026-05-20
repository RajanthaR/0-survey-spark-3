do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'responses'
      and policyname = 'responses no client writes'
  ) then
    execute $policy$
      create policy "responses no client writes"
        on public.responses
        for all
        to authenticated
        using (false)
        with check (false)
    $policy$;
  end if;
end;
$$;
