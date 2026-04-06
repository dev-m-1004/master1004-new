import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const PAGE_SIZE_DEFAULT = 30
const PAGE_SIZE_MAX = 60
const RECENT_FETCH_LIMIT = 200

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
  if (sidoCode === '51') return ['42'] // 강원특별자치도

  return [sidoCode]
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

function getDateValue(row: any) {
  const y = Number(row.deal_year || 0)
  const m = Number(row.deal_month || 0)
  const d = Number(row.deal_day || 0)
  return y * 10000 + m * 100 + d
}

function getCreatedAtValue(row: any) {
  const value = row.created_at ? new Date(row.created_at).getTime() : 0
  return Number.isFinite(value) ? value : 0
}

function buildRoadAddress(row: any) {
  const road = String(row.road_name || '').trim()
  const bon = String(row.road_bonbun || '').trim()
  const bub = String(row.road_bubun || '').trim()

  if (!road) return ''
  if (!bon && !bub) return road
  if (bub && bub !== '0') return `${road} ${bon}-${bub}`
  return `${road} ${bon}`
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

    const prefixes = resolvePrefixes({
      sidoCode: sidoCodeRaw,
      sigunguCode,
      lawdCode,
    })

    let query = supabaseAdmin
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
      .limit(RECENT_FETCH_LIMIT)

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
      console.error('api/list query error:', error)
      return NextResponse.json(
        {
          ok: false,
          message: error.message || '목록 조회 오류',
          error: error.message,
          items: [],
          pagination: { page, pageSize, hasMore: false },
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
          road_name: buildRoadAddress(row),
          build_year: row.build_year,
          deal_count: 1,
          _date: getDateValue(row),
          _created: getCreatedAtValue(row),
        })
        continue
      }

      current.deal_count += 1

      const newDate = getDateValue(row)
      const curDate = Number(current._date || 0)
      const newCreated = getCreatedAtValue(row)
      const curCreated = Number(current._created || 0)

      if (
        newCreated > curCreated ||
        (newCreated === curCreated && newDate > curDate) ||
        (newCreated === curCreated &&
          newDate === curDate &&
          Number(row.price_krw || 0) > Number(current.price_krw || 0))
      ) {
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
        current.road_name = buildRoadAddress(row)
        current.build_year = row.build_year
        current._date = newDate
        current._created = newCreated
      }
    }

    let items = Array.from(grouped.values())

    if (sort === 'price_desc') {
      items.sort((a, b) => Number(b.price_krw || 0) - Number(a.price_krw || 0))
    } else if (sort === 'price_asc') {
      items.sort((a, b) => Number(a.price_krw || 0) - Number(b.price_krw || 0))
    } else {
      items.sort((a, b) => {
        if (Number(b._created || 0) !== Number(a._created || 0)) {
          return Number(b._created || 0) - Number(a._created || 0)
        }
        return Number(b._date || 0) - Number(a._date || 0)
      })
    }

    const total = items.length
    const from = (page - 1) * pageSize
    const to = from + pageSize

    const paged = items
      .slice(from, to)
      .map(({ _date, _created, ...rest }) => rest)

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
        pagination: { page: 1, pageSize: PAGE_SIZE_DEFAULT, hasMore: false },
      },
      { status: 500 }
    )
  }
}