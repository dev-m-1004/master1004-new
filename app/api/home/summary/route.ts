import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const SUMMARY_CACHE_HEADER =
  'public, max-age=60, s-maxage=120, stale-while-revalidate=300'

const REGIONS = [
  { code: '11', queryPrefix: '11', name: '서울특별시' },
  { code: '26', queryPrefix: '26', name: '부산광역시' },
  { code: '27', queryPrefix: '27', name: '대구광역시' },
  { code: '28', queryPrefix: '28', name: '인천광역시' },
  { code: '29', queryPrefix: '29', name: '광주광역시' },
  { code: '30', queryPrefix: '30', name: '대전광역시' },
  { code: '31', queryPrefix: '31', name: '울산광역시' },
  { code: '36', queryPrefix: '36110', name: '세종특별자치시' },
  { code: '41', queryPrefix: '41', name: '경기도' },
  { code: '51', queryPrefix: '42', name: '강원특별자치도' },
  { code: '43', queryPrefix: '43', name: '충청북도' },
  { code: '44', queryPrefix: '44', name: '충청남도' },
  { code: '45', queryPrefix: '52', name: '전북특별자치도' },
  { code: '46', queryPrefix: '46', name: '전라남도' },
  { code: '47', queryPrefix: '47', name: '경상북도' },
  { code: '48', queryPrefix: '48', name: '경상남도' },
  { code: '50', queryPrefix: '50', name: '제주특별자치도' },
]

function jsonOk(body: any) {
  return NextResponse.json(body, {
    headers: {
      'Cache-Control': SUMMARY_CACHE_HEADER,
    },
  })
}

function jsonError(body: any, status = 500) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

async function getLatestDealDate() {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('deal_year, deal_month, deal_day')
    .order('deal_year', { ascending: false })
    .order('deal_month', { ascending: false })
    .order('deal_day', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  if (data?.deal_year && data?.deal_month && data?.deal_day) {
    return `${data.deal_year}-${String(data.deal_month).padStart(2, '0')}-${String(data.deal_day).padStart(2, '0')}`
  }

  return null
}

async function buildRegionCountsFast() {
  const results = []

  for (const region of REGIONS) {
    const { count, error } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'planned', head: true })
      .like('lawd_code', `${region.queryPrefix}%`)

    if (error) throw error

    results.push({
      code: region.code,
      name: region.name,
      count: count || 0,
    })
  }

  return results
}

export async function GET() {
  try {
    const [latestDealDate, regionCounts] = await Promise.all([
      getLatestDealDate(),
      buildRegionCountsFast(),
    ])

    return jsonOk({
      ok: true,
      latestDealDate,
      regionCounts,
      trend: [],
      topPriceWeek: [],
      topVolumeWeek: [],
      summarySource: 'transactions-light',
    })
  } catch (error: any) {
    console.error('api/home/summary error:', error)

    return jsonError(
      {
        ok: false,
        message: error?.message || '메인 요약 데이터 조회 실패',
        regionCounts: [],
        trend: [],
        topPriceWeek: [],
        topVolumeWeek: [],
      },
      500
    )
  }
}