import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PAGE_SIZE_DEFAULT = 30
const PAGE_SIZE_MAX = 100
const FETCH_LIMIT = 4000

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

  // 전북특별자치도 보정
  if (sidoCode === '45') {
    return ['52']
  }

  return [sidoCode]
}

function getDateKey(row: any) {
  const y = Number(row.deal_year || 0)
  const m = Number(row.deal_month || 0)
  const d = Number(row.deal_day || 0)
  return y * 10000 + m * 100 + d
}

function getCreatedAtValue(row: any) {
  const created = row.created_at ? new Date(row.created_at).getTime() : 0
  return Number.isFinite(created) ? created : 0
}

function getGroupKey(row: any) {
  const complexId = row.complex_id ? String(row.complex_id) : ''
  if (complexId) return `complex:${complexId}`

  return [
    String(row.lawd_code || '').trim(),
    String(row.apartment_name || '').trim(),
    String(row.umd_name || '').trim(),
    String(row.road_name || '').trim(),
  ].join('__')
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

    let query = supabase
      .from('transactions')
      .select(`
        id,
        complex_id,
        apartment_name,
        price_krw,
        area_m2,
        floor,
        deal_year,
        deal_month,
        deal_day,
        lawd_code,
        umd_name,
        road_name,
        road_bonbun,
        road_bubun,
        build_year,
        created_at
      `)
      .order('created_at', { ascending: false })
      .order('deal_year', { ascending: false })
      .order('deal_month', { ascending: false })
      .order('deal_day', { ascending: false })
      .order('price_krw', { ascending: false, nullsFirst: false })
      .limit(FETCH_LIMIT)

    const prefixes = resolvePrefixes({
      sidoCode: sidoCodeRaw,
      sigunguCode,
      lawdCode,
    })

    if (prefixes.length === 1) {
      query = query.like('lawd_code', `${prefixes[0]}%`)
    }

    if (dong) {
      query = query.eq('umd_name', dong)
    }

    if (q) {
      query = query.ilike('apartment_name', `%${q}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('transactions list query error:', error)

      return NextResponse.json(
        {
          ok: false,
          message: error.message || '목록 조회 오류',
          error: error.message,
          items: [],
          pagination: {
            page,
            pageSize,
            hasMore: false,
          },
        },
        { status: 500 }
      )
    }

    const grouped = new Map<string, any>()

    for (const row of data || []) {
      const key = getGroupKey(row)
      const current = grouped.get(key)

      if (!current) {
        grouped.set(key, {
          id: row.complex_id || row.id,
          complex_id: row.complex_id || row.id,
          apartment_name: row.apartment_name,
          price_krw: row.price_krw,
          area_m2: row.area_m2,
          floor: row.floor,
          deal_year: row.deal_year,
          deal_month: row.deal_month,
          deal_day: row.deal_day,
          lawd_code: row.lawd_code,
          dong: row.umd_name,
          umd_name: row.umd_name,
          road_name: row.road_name,
          road_bonbun: row.road_bonbun,
          road_bubun: row.road_bubun,
          build_year: row.build_year,
          deal_count: 1,
          max_price_krw: Number(row.price_krw || 0),
          min_price_krw: Number(row.price_krw || 0),
          _created_at: getCreatedAtValue(row),
          _date_key: getDateKey(row),
        })
        continue
      }

      current.deal_count += 1
      current.max_price_krw = Math.max(
        Number(current.max_price_krw || 0),
        Number(row.price_krw || 0)
      )
      current.min_price_krw =
        current.min_price_krw === 0
          ? Number(row.price_krw || 0)
          : Math.min(Number(current.min_price_krw || 0), Number(row.price_krw || 0))

      const rowCreatedAt = getCreatedAtValue(row)
      const rowDateKey = getDateKey(row)
      const currentCreatedAt = Number(current._created_at || 0)
      const currentDateKey = Number(current._date_key || 0)

      const shouldReplaceLatest =
        rowCreatedAt > currentCreatedAt ||
        (rowCreatedAt === currentCreatedAt && rowDateKey > currentDateKey) ||
        (rowCreatedAt === currentCreatedAt &&
          rowDateKey === currentDateKey &&
          Number(row.price_krw || 0) > Number(current.price_krw || 0))

      if (shouldReplaceLatest) {
        current.id = row.complex_id || row.id
        current.complex_id = row.complex_id || row.id
        current.apartment_name = row.apartment_name
        current.price_krw = row.price_krw
        current.area_m2 = row.area_m2
        current.floor = row.floor
        current.deal_year = row.deal_year
        current.deal_month = row.deal_month
        current.deal_day = row.deal_day
        current.lawd_code = row.lawd_code
        current.dong = row.umd_name
        current.umd_name = row.umd_name
        current.road_name = row.road_name
        current.road_bonbun = row.road_bonbun
        current.road_bubun = row.road_bubun
        current.build_year = row.build_year
        current._created_at = rowCreatedAt
        current._date_key = rowDateKey
      }
    }

    let items = Array.from(grouped.values())

    if (sort === 'price_desc') {
      items.sort((a, b) => {
        if (Number(b.price_krw || 0) !== Number(a.price_krw || 0)) {
          return Number(b.price_krw || 0) - Number(a.price_krw || 0)
        }
        if (Number(b._date_key || 0) !== Number(a._date_key || 0)) {
          return Number(b._date_key || 0) - Number(a._date_key || 0)
        }
        return Number(b._created_at || 0) - Number(a._created_at || 0)
      })
    } else if (sort === 'price_asc') {
      items.sort((a, b) => {
        if (Number(a.price_krw || 0) !== Number(b.price_krw || 0)) {
          return Number(a.price_krw || 0) - Number(b.price_krw || 0)
        }
        if (Number(b._date_key || 0) !== Number(a._date_key || 0)) {
          return Number(b._date_key || 0) - Number(a._date_key || 0)
        }
        return Number(b._created_at || 0) - Number(a._created_at || 0)
      })
    } else {
      items.sort((a, b) => {
        if (Number(b._created_at || 0) !== Number(a._created_at || 0)) {
          return Number(b._created_at || 0) - Number(a._created_at || 0)
        }
        if (Number(b._date_key || 0) !== Number(a._date_key || 0)) {
          return Number(b._date_key || 0) - Number(a._date_key || 0)
        }
        return Number(b.price_krw || 0) - Number(a.price_krw || 0)
      })
    }

    const total = items.length
    const from = (page - 1) * pageSize
    const to = from + pageSize
    const paged = items.slice(from, to).map(({ _created_at, _date_key, ...rest }) => rest)

    return NextResponse.json({
      ok: true,
      items: paged,
      pagination: {
        page,
        pageSize,
        hasMore: to < total,
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