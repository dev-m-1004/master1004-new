create or replace function public.refresh_complexes_from_transactions_recent(
  p_days integer default 3,
  p_batch_limit integer default 5000
)
returns jsonb
language plpgsql
as $$
declare
  v_target_count integer := 0;
  v_matched_count integer := 0;
  v_updated_count integer := 0;
begin
  with target_tx as (
    select
      t.id,
      t.lawd_code,
      trim(coalesce(t.apartment_name, '')) as apartment_name,
      t.deal_date
    from public.transactions t
    where t.complex_id is null
      and t.deal_date >= current_date - greatest(p_days, 1)
    order by t.deal_date desc, t.id desc
    limit greatest(p_batch_limit, 1)
  ),
  matched as (
    select distinct on (tx.id)
      tx.id,
      c.id as complex_id
    from target_tx tx
    join public.complexes c
      on c.lawd_code = tx.lawd_code
     and trim(coalesce(c.official_name, '')) = tx.apartment_name
    order by tx.id, c.id
  ),
  updated as (
    update public.transactions t
       set complex_id = m.complex_id
      from matched m
     where t.id = m.id
       and t.complex_id is null
    returning t.id
  )
  select
    (select count(*) from target_tx),
    (select count(*) from matched),
    (select count(*) from updated)
  into v_target_count, v_matched_count, v_updated_count;

  return jsonb_build_object(
    'ok', true,
    'target_count', v_target_count,
    'matched_count', v_matched_count,
    'updated_count', v_updated_count,
    'days', p_days,
    'batch_limit', p_batch_limit
  );
end;
$$;

-- Run the indexes below one line at a time in Supabase SQL Editor.
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block.

create index concurrently if not exists idx_transactions_unmatched_recent
on public.transactions (deal_date desc, id desc)
where complex_id is null;

create index concurrently if not exists idx_complexes_match_basic
on public.complexes (lawd_code, official_name);
