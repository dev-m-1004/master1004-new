-- 메인 홈 요약(연도별 거래량 / 지역별 5년 거래량 / 최근 일주일 TOP5) 성능 개선용
-- 적용 순서
-- 1) 이 SQL 실행
-- 2) 아래 refresh 함수 1회 실행
--    select public.refresh_home_summary_mvs();
-- 3) 백필 작업 후에도 refresh_home_summary_mvs()를 같이 실행

create materialized view if not exists public.home_tx_year_counts_mv as
select
  deal_year::int as deal_year,
  count(*)::int as tx_count
from public.transactions
where deal_year between 2020 and 2026
group by deal_year;

create unique index if not exists idx_home_tx_year_counts_mv_year
on public.home_tx_year_counts_mv (deal_year);

create materialized view if not exists public.home_tx_region_year_counts_mv as
select
  case
    when lawd_code like '36110%' then '36'
    when lawd_code like '52%' then '45'
    else left(lawd_code, 2)
  end as region_code,
  deal_year::int as deal_year,
  count(*)::int as tx_count
from public.transactions
where lawd_code is not null
  and deal_year is not null
group by 1, 2;

create unique index if not exists idx_home_tx_region_year_counts_mv_key
on public.home_tx_region_year_counts_mv (region_code, deal_year);

create materialized view if not exists public.home_tx_week_complex_mv as
select
  make_date(deal_year::int, deal_month::int, deal_day::int) as deal_date,
  case
    when lawd_code like '36110%' then '36'
    when lawd_code like '52%' then '45'
    else left(lawd_code, 2)
  end as region_code,
  complex_id,
  apartment_name,
  area_m2,
  max(price_krw)::bigint as top_price_krw,
  count(*)::int as tx_count
from public.transactions
where deal_year is not null
  and deal_month between 1 and 12
  and deal_day between 1 and 31
  and apartment_name is not null
  and area_m2 is not null
group by 1, 2, 3, 4, 5;

create index if not exists idx_home_tx_week_complex_mv_date
on public.home_tx_week_complex_mv (deal_date desc);

create index if not exists idx_home_tx_week_complex_mv_price
on public.home_tx_week_complex_mv (deal_date desc, top_price_krw desc);

create index if not exists idx_home_tx_week_complex_mv_count
on public.home_tx_week_complex_mv (deal_date desc, tx_count desc);

create or replace function public.refresh_home_summary_mvs()
returns json
language plpgsql
security definer
as $$
declare
  refreshed_at timestamptz := now();
begin
  refresh materialized view public.home_tx_year_counts_mv;
  refresh materialized view public.home_tx_region_year_counts_mv;
  refresh materialized view public.home_tx_week_complex_mv;

  return json_build_object(
    'ok', true,
    'refreshed_at', refreshed_at
  );
end;
$$;
