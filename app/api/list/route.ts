import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PAGE_SIZE_DEFAULT = 30
const PAGE_SIZE_MAX = 100
const LISTING_VIEW = 'complex_listing_mv'

function toPositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}

function normalizePrefix(value: string) {
  return value.replace(/\s+/g, '').trim()
}

/**
 * 🔥 핵심: 전북 코드 보정
 * 45(전북특별자치도) → 실제 DB는 52 사용 중
 */
function resolvePrefixes({
  sidoCode,
  sigunguCode,
  lawdCode,
}: {
  sidoCode: string
  sigunguCode: string
  lawdCode: string
}) {
  if (lawdCode) return [lawdCode]
  if (sigunguCode) return [sigunguCode]

  if (!sidoCode) return []

  // ✅ 전북 예외 처리
  if (sidoCode === '45') {
    return ['52']
  }

  return [sidoCode]
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const q = (searchParams.get('q') || '').trim()
    const sidoCodeRaw = normalizePrefix(searchParams.get('sidoCode') || '')
    const sigunguCode = normalizePrefix(searchParams.get('sigunguCode') || '')
    const lawdCode = normalizePrefix(searchParams.get('lawdCode') || '')
    const dong = (searchParams.get('dong') || '').trim()
    const sort = (searchParams.get('sort') || 'latest').trim()

    const page = toPositiveInt(searchParams.get('page'), 1)
    const requestedPageSize = toPositiveInt(
      searchParams.get('pageSize'),
      PAGE_SIZE_DEFAULT
    )

    const pageSize = Math.min(requestedPageSize, PAGE_SIZE_MAX)
    const from = (page - 1) * pageSize
    const to = from + pageSize

    let query = supabase.from(LISTING_VIEW).select(`
        id,
        official_name,
        lawd_code,
        umd_name,
        road_name,
        road_bonbun,
        road_bubun,
        build_year,
        latest_price_krw,
        latest_area_m2,
        latest_floor,
        latest_deal_year,
        latest_deal_month,
        latest_deal_day,
        deal_count,
        max_price_krw,
        min_price_krw
      `)

    /**
     * ✅ 지역 필터 (전북 포함 보정 적용)
     */
    const prefixes = resolvePrefixes({
      sidoCode: sidoCodeRaw,
      sigunguCode,
      lawdCode,
    })

    if (prefixes.length === 1) {
      query = query.like('lawd_code', `${prefixes[0]}%`)
    }

    /**
     * 동 필터
     */
    if (dong) {
      query = query.eq('umd_name', dong)
    }

    /**
     * 검색어
     */
    if (q) {
      query = query.ilike('official_name', `%${q}%`)
    }

    /**
     * 정렬
     */
    if (sort === 'price_desc') {
      query = query
        .order('latest_price_krw', { ascending: false, nullsFirst: false })
        .order('latest_deal_year', { ascending: false })
        .order('latest_deal_month', { ascending: false })
        .order('latest_deal_day', { ascending: false })
        .order('id', { ascending: false })
    } else if (sort === 'price_asc') {
      query = query
        .order('latest_price_krw', { ascending: true, nullsFirst: false })
        .order('latest_deal_year', { ascending: false })
        .order('latest_deal_month', { ascending: false })
        .order('latest_deal_day', { ascending: false })
        .order('id', { ascending: false })
    } else {
      query = query
        .order('latest_deal_year', { ascending: false })
        .order('latest_deal_month', { ascending: false })
        .order('latest_deal_day', { ascending: false })
        .order('latest_price_krw', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
    }

    /**
     * 페이지네이션
     */
    query = query.range(from, to)

    const { data, error } = await query

    if (error) {
      const isTimeout = error.code === '57014'

      console.error('complex list query error:', error)

      return NextResponse.json(
        {
          ok: false,
          message: isTimeout
            ? '목록 조회 시간 초과 (MV refresh 필요)'
            : error.message || '목록 조회 오류',
          error: error.message,
          items: [],
          pagination: {
            page,
            pageSize,
            hasMore: false,
          },
        },
        { status: isTimeout ? 503 : 500 }
      )
    }

    const rows = data || []
    const hasMore = rows.length > pageSize

    const items = (hasMore ? rows.slice(0, pageSize) : rows).map((row: any) => ({
      id: row.id,
      complex_id: row.id,
      apartment_name: row.official_name,
      price_krw: row.latest_price_krw,
      area_m2: row.latest_area_m2,
      floor: row.latest_floor,
      deal_year: row.latest_deal_year,
      deal_month: row.latest_deal_month,
      deal_day: row.latest_deal_day,
      lawd_code: row.lawd_code,
      dong: row.umd_name,
      umd_name: row.umd_name,
      road_name: row.road_name,
      road_bonbun: row.road_bonbun,
      road_bubun: row.road_bubun,
      build_year: row.build_year,
      deal_count: row.deal_count,
      max_price_krw: row.max_price_krw,
      min_price_krw: row.min_price_krw,
    }))

    return NextResponse.json({
      ok: true,
      items,
      pagination: {
        page,
        pageSize,
        hasMore,
      },
    })
  } catch (error: any) {
    console.error('api/list unexpected error:', error)

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'unexpected error',
        error: error?.message,
        items: [],
        pagination: {
          page: 1,
          pageSize: PAGE_SIZE_DEFAULT,
          hasMore: false,
        },
      },
      { status: 500 }
    )
  }
}