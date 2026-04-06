import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const PAGE_SIZE_DEFAULT = 30
const PAGE_SIZE_MAX = 60

function toPositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}

function normalizePrefix(value: string) {
  return value.replace(/\s+/g, '').trim()
}

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

  if (sidoCode === '45') return ['52'] // 전북특별자치도
  if (sidoCode === '51') return ['42', '51'] // 강원도 / 강원특별자치도 혼재 대응

  return [sidoCode]
}

function applySort(query: any, sort: string) {
  if (sort === 'price_desc') {
    return query
      .order('latest_price_krw', { ascending: false, nullsFirst: false })
      .order('latest_deal_year', { ascending: false, nullsFirst: false })
      .order('latest_deal_month', { ascending: false, nullsFirst: false })
      .order('latest_deal_day', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
  }

  if (sort === 'price_asc') {
    return query
      .order('latest_price_krw', { ascending: true, nullsFirst: false })
      .order('latest_deal_year', { ascending: false, nullsFirst: false })
      .order('latest_deal_month', { ascending: false, nullsFirst: false })
      .order('latest_deal_day', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
  }

  return query
    .order('latest_deal_year', { ascending: false, nullsFirst: false })
    .order('latest_deal_month', { ascending: false, nullsFirst: false })
    .order('latest_deal_day', { ascending: false, nullsFirst: false })
    .order('latest_price_krw', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
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
    const requestedPageSize = toPositiveInt(searchParams.get('pageSize'), PAGE_SIZE_DEFAULT)
    const pageSize = Math.min(requestedPageSize, PAGE_SIZE_MAX)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const prefixes = resolvePrefixes({
      sidoCode: sidoCodeRaw,
      sigunguCode,
      lawdCode,
    })

    let query = supabaseAdmin
      .from('complex_listing_mv')
      .select(
        `
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
          deal_count
        `,
        { count: 'exact' }
      )
      .not('latest_deal_year', 'is', null)
      .not('latest_deal_month', 'is', null)
      .not('latest_deal_day', 'is', null)
      .not('latest_price_krw', 'is', null)
      .gt('latest_price_krw', 0)

    if (prefixes.length === 1) {
      query = query.like('lawd_code', `${prefixes[0]}%`)
    } else if (prefixes.length > 1) {
      query = query.or(prefixes.map((prefix) => `lawd_code.like.${prefix}%`).join(','))
    }

    if (dong) {
      query = query.eq('umd_name', dong)
    }

    if (q) {
      const safeKeyword = q.replace(/,/g, ' ').trim()
      query = query.or(
        `official_name.ilike.%${safeKeyword}%,umd_name.ilike.%${safeKeyword}%,road_name.ilike.%${safeKeyword}%`
      )
    }

    query = applySort(query, sort).range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('api/list query error:', error)
      return NextResponse.json(
        {
          ok: false,
          message: error.message || '목록 조회 오류',
          error: error.message,
          items: [],
          pagination: { page, pageSize, hasMore: false, total: 0 },
        },
        { status: 500 }
      )
    }

    const items = (data || []).map((row: any) => ({
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
      umd_name: row.umd_name,
      road_name: row.road_name,
      road_bonbun: row.road_bonbun,
      road_bubun: row.road_bubun,
      build_year: row.build_year,
      deal_count: row.deal_count,
    }))

    const total = Number(count || 0)
    const hasMore = from + items.length < total

    return NextResponse.json({
      ok: true,
      items,
      pagination: {
        page,
        pageSize,
        total,
        hasMore,
      },
      source: 'complex_listing_mv',
    })
  } catch (error: any) {
    console.error('api/list unexpected error:', error)
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'unexpected error',
        error: error?.message,
        items: [],
        pagination: { page: 1, pageSize: PAGE_SIZE_DEFAULT, hasMore: false, total: 0 },
      },
      { status: 500 }
    )
  }
}