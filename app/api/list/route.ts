import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

type SortType = 'latest' | 'price_desc' | 'price_asc'

function normalizeKeyword(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()\-_.·]/g, '')
    .trim()
}

function toNumber(value: string | null, fallback: number) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams

    const q = (searchParams.get('q') || '').trim()
    const dong = (searchParams.get('dong') || '').trim()
    const sidoCode = (searchParams.get('sidoCode') || '').trim()
    const sigunguCode = (searchParams.get('sigunguCode') || '').trim()
    const lawdCode = (searchParams.get('lawdCode') || '').trim()

    const page = toNumber(searchParams.get('page'), 1)
    const pageSize = Math.min(toNumber(searchParams.get('pageSize'), 30), 100)
    const sort = (searchParams.get('sort') || 'latest') as SortType

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let complexIds: string[] | null = null

    if (q) {
      const normalizedQ = normalizeKeyword(q)

      const { data: aliasMatches, error: aliasError } = await supabaseAdmin
        .from('complex_aliases')
        .select('complex_id')
        .ilike('alias_normalized', `%${normalizedQ}%`)
        .limit(200)

      if (aliasError) {
        return NextResponse.json(
          {
            ok: false,
            message: '별칭 검색 실패',
            error: aliasError.message,
          },
          { status: 500 }
        )
      }

      complexIds = [...new Set((aliasMatches || []).map((row) => row.complex_id))]
    }

    let query = supabaseAdmin
      .from('transactions')
      .select(
        `
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
        dong,
        umd_name,
        created_at
      `,
        { count: 'exact' }
      )

    if (complexIds && complexIds.length > 0) {
      query = query.in('complex_id', complexIds)
    } else if (q) {
      query = query.ilike('apartment_name', `%${q}%`)
    }

    if (dong) {
      query = query.or(`dong.ilike.%${dong}%,umd_name.ilike.%${dong}%`)
    }

    if (lawdCode) {
      query = query.eq('lawd_code', lawdCode)
    } else if (sigunguCode) {
      query = query.like('lawd_code', `${sigunguCode}%`)
    } else if (sidoCode) {
      query = query.like('lawd_code', `${sidoCode}%`)
    }

    switch (sort) {
      case 'price_desc':
        query = query
          .order('price_krw', { ascending: false })
          .order('deal_year', { ascending: false })
          .order('deal_month', { ascending: false })
          .order('deal_day', { ascending: false })
        break

      case 'price_asc':
        query = query
          .order('price_krw', { ascending: true })
          .order('deal_year', { ascending: false })
          .order('deal_month', { ascending: false })
          .order('deal_day', { ascending: false })
        break

      case 'latest':
      default:
        query = query
          .order('deal_year', { ascending: false })
          .order('deal_month', { ascending: false })
          .order('deal_day', { ascending: false })
          .order('created_at', { ascending: false })
        break
    }

    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          message: '조회 실패',
          error: error.message,
        },
        { status: 500 }
      )
    }

    const total = count ?? 0
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

   return NextResponse.json({
  ok: true,
  message: '조회 성공',
  data: data ?? [],     // 🔥 이 줄 추가
  items: data ?? [],
  pagination: {
    page,
    pageSize,
    total,
    totalPages,
    hasMore: page < totalPages,
  },
})
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || '서버 오류',
      },
      { status: 500 }
    )
  }
}