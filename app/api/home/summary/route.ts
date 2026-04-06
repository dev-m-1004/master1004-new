import { NextResponse } from 'next/server'
import { TREND_YEARS, getHomeSummary } from '@/lib/home-data'

export const runtime = 'nodejs'

const SUMMARY_CACHE_HEADER =
  'public, max-age=60, s-maxage=120, stale-while-revalidate=300'

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

export async function GET() {
  try {
    const summary = await getHomeSummary()
    return jsonOk(summary)
  } catch (error: any) {
    console.error('api/home/summary error:', error)

    return jsonError(
      {
        ok: false,
        message: error?.message || '메인 요약 데이터 조회 실패',
        regionCounts: [],
        trend: TREND_YEARS.map((year) => ({
          year: String(year),
          count: 0,
        })),
        topPriceWeek: [],
        topVolumeWeek: [],
      },
      500
    )
  }
}
