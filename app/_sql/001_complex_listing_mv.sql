-- 목록 조회 최적화용 머티리얼라이즈드 뷰 + 인덱스
-- 적용 순서:
-- 1) 이 SQL 실행
-- 2) /api/admin/backfill/refresh-complexes POST 1회 실행
-- 3) 이후 백필 후에도 같은 refresh-complexes 호출

create extension if not exists pg_trgm;

create index if not exists idx_transactions_lawd_code_pattern
on public.transactions (lawd_code text_pattern_ops);

create index if not exists idx_transactions_complex_id
on public.transactions (complex_id);

create index if not exists idx_transactions_complex_deal_order
on public.transactions (
  complex_id,
  deal_year desc,
  deal_month desc,
  deal_day desc,
  id desc
);

create index if not exists idx_transactions_lawd_latest_order
on public.transactions (
  lawd_code text_pattern_ops,
  deal_year desc,
  deal_month desc,
  deal_day desc,
  id desc
);

create index if not exists idx_transactions_lawd_price_desc
on public.transactions (
  lawd_code text_pattern_ops,
  price_krw desc,
  deal_year desc,
  deal_month desc,
  deal_day desc,
  id desc
);

create index if not exists idx_transactions_lawd_price_asc
on public.transactions (
  lawd_code text_pattern_ops,
  price_krw asc,
  deal_year desc,
  deal_month desc,
  deal_day desc,
  id desc
);

create index if not exists idx_transactions_apartment_name_trgm
on public.transactions
using gin (apartment_name gin_trgm_ops);

create index if not exists idx_complexes_lawd_code_pattern
on public.complexes (lawd_code text_pattern_ops);

create index if not exists idx_complexes_official_name_trgm
on public.complexes
using gin (official_name gin_trgm_ops);

drop materialized view if exists public.complex_listing_mv;

create materialized view public.complex_listing_mv as
with latest_tx as (
  select distinct on (t.complex_id)
    t.complex_id,
    t.apartment_name,
    t.price_krw as latest_price_krw,
    t.area_m2 as latest_area_m2,
    t.floor as latest_floor,
    t.deal_year as latest_deal_year,
    t.deal_month as latest_deal_month,
    t.deal_day as latest_deal_day,
    t.lawd_code,
    t.umd_name,
    t.road_name,
    t.road_bonbun,
    t.road_bubun
  from public.transactions t
  where t.complex_id is not null
  order by
    t.complex_id,
    t.deal_year desc,
    t.deal_month desc,
    t.deal_day desc,
    t.id desc
),
stats as (
  select
    t.complex_id,
    count(*)::int as deal_count,
    max(t.price_krw) as max_price_krw,
    min(t.price_krw) as min_price_krw
  from public.transactions t
  where t.complex_id is not null
  group by t.complex_id
)
select
  c.id,
  c.official_name,
  coalesce(c.lawd_code, lt.lawd_code) as lawd_code,
  coalesce(c.umd_name, lt.umd_name) as umd_name,
  coalesce(c.road_name, lt.road_name) as road_name,
  coalesce(c.road_bonbun, lt.road_bonbun) as road_bonbun,
  coalesce(c.road_bubun, lt.road_bubun) as road_bubun,
  c.build_year,
  lt.latest_price_krw,
  lt.latest_area_m2,
  lt.latest_floor,
  lt.latest_deal_year,
  lt.latest_deal_month,
  lt.latest_deal_day,
  coalesce(s.deal_count, 0) as deal_count,
  s.max_price_krw,
  s.min_price_krw
from public.complexes c
left join latest_tx lt on lt.complex_id = c.id
left join stats s on s.complex_id = c.id;

create unique index if not exists idx_complex_listing_mv_id
on public.complex_listing_mv (id);

create index if not exists idx_complex_listing_mv_lawd_code_pattern
on public.complex_listing_mv (lawd_code text_pattern_ops);

create index if not exists idx_complex_listing_mv_umd_name
on public.complex_listing_mv (umd_name);

create index if not exists idx_complex_listing_mv_latest_order
on public.complex_listing_mv (
  latest_deal_year desc,
  latest_deal_month desc,
  latest_deal_day desc,
  latest_price_krw desc,
  id desc
);

create index if not exists idx_complex_listing_mv_latest_price_desc
on public.complex_listing_mv (
  latest_price_krw desc,
  latest_deal_year desc,
  latest_deal_month desc,
  latest_deal_day desc,
  id desc
);

create index if not exists idx_complex_listing_mv_latest_price_asc
on public.complex_listing_mv (
  latest_price_krw asc,
  latest_deal_year desc,
  latest_deal_month desc,
  latest_deal_day desc,
  id desc
);

create index if not exists idx_complex_listing_mv_official_name_trgm
on public.complex_listing_mv
using gin (official_name gin_trgm_ops);

create or replace function public.refresh_complex_listing_mv()
returns json
language plpgsql
security definer
as $$
declare
  refreshed_at timestamptz := now();
begin
  refresh materialized view public.complex_listing_mv;

  return json_build_object(
    'ok', true,
    'refreshed_at', refreshed_at
  );
end;
$$;
