import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const runtime = 'nodejs'

type TxItem = {
  id?: string | number
  complex_id?: string | null
  apartment_name?: string | null
  price_krw?: number | null
  area_m2?: number | null
  lawd_code?: string | null
  deal_year?: number | null
  deal_month?: number | null
  deal_day?: number | null
}

type RegionInfo = {
  code: string
  queryPrefix: string
  name: string
}

const REGIONS: RegionInfo[] = [
  { code: '11', queryPrefix: '11', name: '서울특별시' },
  { code: '26', queryPrefix: '26', name: '부산광역시' },
  { code: '27', queryPrefix: '27', name: '대구광역시' },
  { code: '28', queryPrefix: '28', name: '인천광역시' },
  { code: '29', queryPrefix: '29', name: '광주광역시' },
  { code: '30', queryPrefix: '30', name: '대전광역시' },
  { code: '31', queryPrefix: '31', name: '울산광역시' },
  { code: '36', queryPrefix: '36110', name: '세종특별자치시' },
  { code: '41', queryPrefix: '41', name: '경기도' },
  { code: '51', queryPrefix: '51', name: '강원특별자치도' },
  { code: '43', queryPrefix: '43', name: '충청북도' },
  { code: '44', queryPrefix: '44', name: '충청남도' },
  { code: '45', queryPrefix: '52', name: '전북특별자치도' },
  { code: '46', queryPrefix: '46', name: '전라남도' },
  { code: '47', queryPrefix: '47', name: '경상북도' },
  { code: '48', queryPrefix: '48', name: '경상남도' },
  { code: '50', queryPrefix: '50', name: '제주특별자치도' },
]

const TREND_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026]
const SUMMARY_CACHE_HEADER = 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800'

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

function toPyeong(value?: number | null) {
  const area = Number(value || 0)
  if (!area) return '-'
  return `${Math.round(area / 3.3058)}평`
}

function toDateKey(item: TxItem) {
  const y = Number(item.deal_year || 0)
  const m = Number(item.deal_month || 0)
  const d = Number(item.deal_day || 0)
  if (!y || !m || !d) return ''
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function toDate(item: TxItem) {
  const y = Number(item.deal_year || 0)
  const m = Number(item.deal_month || 0)
  const d = Number(item.deal_day || 0)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  date.setHours(0, 0, 0, 0)
  return date
}

function subtractDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

function dateToYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getRegionCodeByLawdCode(lawdCode?: string | null) {
  const code = String(lawdCode || '').trim()
  if (!code) return ''

  const matched = REGIONS.find((region) => code.startsWith(region.queryPrefix))
  if (!matched) return ''

  return matched.code
}

function getRegionNameByLawdCode(lawdCode?: string | null) {
  const regionCode = getRegionCodeByLawdCode(lawdCode)
  return REGIONS.find((region) => region.code === regionCode)?.name || ''
}

function formatTopItem(item: {
  region_name: string
  apartment_name: string
  area_m2: number
  price_krw: number
  complex_id?: string | null
  count: number
}) {
  return {
    region_name: item.region_name,
    apartment_name: item.apartment_name,
    pyeong: toPyeong(item.area_m2),
    price_krw: item.price_krw,
    complex_id: item.complex_id || null,
    count: item.count,
  }
}

async function getLatestDealDate() {
  const { data, error } = await supabase
    .from('transactions')
    .select('deal_year, deal_month, deal_day')
    .not('deal_year', 'is', null)
    .not('deal_month', 'is', null)
    .not('deal_day', 'is', null)
    .order('deal_year', { ascending: false })
    .order('deal_month', { ascending: false })
    .order('deal_day', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  if (data?.deal_year && data?.deal_month && data?.deal_day) {
    const date = new Date(data.deal_year, data.deal_month - 1, data.deal_day)
    date.setHours(0, 0, 0, 0)
    return date
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

async function getTrendCountsFast() {
  const { data, error } = await supabase
    .from('home_tx_year_counts_mv')
    .select('deal_year, tx_count')
    .gte('deal_year', 2020)
    .lte('deal_year', 2026)
    .order('deal_year', { ascending: true })

  if (error) throw error

  const countMap = new Map<number, number>()
  for (const row of data || []) {
    countMap.set(Number((row as any).deal_year || 0), Number((row as any).tx_count || 0))
  }

  return TREND_YEARS.map((year) => ({
    year: String(year),
    count: countMap.get(year) || 0,
  }))
}

async function getRegionCountsFast(baseYear: number) {
  const { data, error } = await supabase
    .from('home_tx_region_year_counts_mv')
    .select('region_code, deal_year, tx_count')
    .gte('deal_year', baseYear)

  if (error) throw error

  const countMap = new Map<string, number>()
  for (const region of REGIONS) countMap.set(region.code, 0)

  for (const row of data || []) {
    const regionCode = String((row as any).region_code || '').trim()
    const txCount = Number((row as any).tx_count || 0)
    if (!regionCode || !countMap.has(regionCode)) continue
    countMap.set(regionCode, (countMap.get(regionCode) || 0) + txCount)
  }

  return REGIONS.map((region) => ({
    code: region.code,
    name: region.name,
    count: countMap.get(region.code) || 0,
  }))
}

function aggregateWeekGroups(items: TxItem[]) {
  const map = new Map<
    string,
    {
      region_name: string
      apartment_name: string
      area_m2: number
      top_price_krw: number
      latest_date_key: string
      complex_id?: string | null
      count: number
    }
  >()

  for (const item of items) {
    const apartmentName = String(item.apartment_name || '').trim()
    const area = Number(item.area_m2 || 0)
    const regionName = getRegionNameByLawdCode(item.lawd_code)
    if (!apartmentName || !area) continue

    const key = `${regionName}__${apartmentName}__${area.toFixed(2)}`
    const dateKey = toDateKey(item)
    const price = Number(item.price_krw || 0)

    if (!map.has(key)) {
      map.set(key, {
        region_name: regionName,
        apartment_name: apartmentName,
        area_m2: area,
        top_price_krw: price,
        latest_date_key: dateKey,
        complex_id: item.complex_id || null,
        count: 1,
      })
      continue
    }

    const current = map.get(key)!
    current.count += 1

    if (price > current.top_price_krw) {
      current.top_price_krw = price
      current.complex_id = item.complex_id || current.complex_id || null
    }

    if (dateKey > current.latest_date_key) {
      current.latest_date_key = dateKey
      current.complex_id = item.complex_id || current.complex_id || null
    }
  }

  return Array.from(map.values())
}

async function getWeekRowsFallback(latestDealDate: Date) {
  const startWeekDate = subtractDays(latestDealDate, 6)
  const yearsToQuery = Array.from(new Set([startWeekDate.getFullYear(), latestDealDate.getFullYear()]))

  const responses = await Promise.all(
    yearsToQuery.map((year) =>
      supabase
        .from('transactions')
        .select('id, complex_id, apartment_name, area_m2, price_krw, lawd_code, deal_year, deal_month, deal_day')
        .eq('deal_year', year)
        .not('deal_month', 'is', null)
        .not('deal_day', 'is', null)
        .order('deal_month', { ascending: false })
        .order('deal_day', { ascending: false })
        .order('price_krw', { ascending: false, nullsFirst: false })
        .limit(20000)
    )
  )

  const rows: TxItem[] = []
  for (const res of responses) {
    if (res.error) throw res.error
    rows.push(...(((res.data || []) as TxItem[])))
  }

  return rows.filter((item) => {
    const date = toDate(item)
    return date ? date >= startWeekDate && date <= latestDealDate : false
  })
}

async function getWeekRowsFast(latestDealDate: Date) {
  const startWeekDate = subtractDays(latestDealDate, 6)
  const startDateStr = dateToYmd(startWeekDate)
  const endDateStr = dateToYmd(latestDealDate)

  const { data, error } = await supabase
    .from('home_tx_week_complex_mv')
    .select('deal_date, region_code, complex_id, apartment_name, area_m2, top_price_krw, tx_count')
    .gte('deal_date', startDateStr)
    .lte('deal_date', endDateStr)
    .order('deal_date', { ascending: false })
    .limit(10000)

  if (error) throw error

  const expanded: TxItem[] = []
  for (const row of data || []) {
    const date = new Date(`${(row as any).deal_date}T00:00:00`)
    const y = date.getFullYear()
    const m = date.getMonth() + 1
    const d = date.getDate()
    const regionCode = String((row as any).region_code || '').trim()
    const lawdCode = REGIONS.find((region) => region.code === regionCode)?.queryPrefix || regionCode
    const repeatCount = Math.max(1, Number((row as any).tx_count || 0))

    for (let i = 0; i < repeatCount; i += 1) {
      expanded.push({
        complex_id: (row as any).complex_id || null,
        apartment_name: (row as any).apartment_name || null,
        area_m2: Number((row as any).area_m2 || 0),
        price_krw: Number((row as any).top_price_krw || 0),
        lawd_code: lawdCode,
        deal_year: y,
        deal_month: m,
        deal_day: d,
      })
    }
  }

  return expanded
}

async function buildFastSummary() {
  const latestDealDate = await getLatestDealDate()
  const recentFiveYearsBase = latestDealDate.getFullYear() - 4

  const [regionCounts, trend, weekRows] = await Promise.all([
    getRegionCountsFast(recentFiveYearsBase),
    getTrendCountsFast(),
    getWeekRowsFast(latestDealDate),
  ])

  const groupedWeekRows = aggregateWeekGroups(weekRows)

  const topPriceWeek = groupedWeekRows
    .slice()
    .sort((a, b) => {
      if (b.top_price_krw !== a.top_price_krw) return b.top_price_krw - a.top_price_krw
      if (b.count !== a.count) return b.count - a.count
      return b.latest_date_key.localeCompare(a.latest_date_key)
    })
    .slice(0, 5)
    .map(formatTopItem)

  const topVolumeWeek = groupedWeekRows
    .slice()
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      if (b.top_price_krw !== a.top_price_krw) return b.top_price_krw - a.top_price_krw
      return b.latest_date_key.localeCompare(a.latest_date_key)
    })
    .slice(0, 5)
    .map(formatTopItem)

  return {
    ok: true,
    latestDealDate: latestDealDate.toISOString(),
    regionCounts,
    trend,
    topPriceWeek,
    topVolumeWeek,
    summarySource: 'materialized_views',
  }
}

async function buildFallbackSummary() {
  const latestDealDate = await getLatestDealDate()
  const recentFiveYearsBase = latestDealDate.getFullYear() - 4
  const startWeekDate = subtractDays(latestDealDate, 6)

  const [trendRowsRes, regionRowsRes, weekRows] = await Promise.all([
    supabase
      .from('transactions')
      .select('deal_year')
      .gte('deal_year', 2020)
      .lte('deal_year', 2026)
      .limit(200000),
    supabase
      .from('transactions')
      .select('deal_year, lawd_code')
      .gte('deal_year', recentFiveYearsBase)
      .not('lawd_code', 'is', null)
      .limit(200000),
    getWeekRowsFallback(latestDealDate),
  ])

  if (trendRowsRes.error) throw trendRowsRes.error
  if (regionRowsRes.error) throw regionRowsRes.error

  const trendCountMap = new Map<number, number>()
  for (const year of TREND_YEARS) trendCountMap.set(year, 0)
  for (const row of trendRowsRes.data || []) {
    const year = Number((row as any).deal_year || 0)
    if (trendCountMap.has(year)) {
      trendCountMap.set(year, (trendCountMap.get(year) || 0) + 1)
    }
  }

  const trend = TREND_YEARS.map((year) => ({
    year: String(year),
    count: trendCountMap.get(year) || 0,
  }))

  const regionCountMap = new Map<string, number>()
  for (const region of REGIONS) regionCountMap.set(region.code, 0)
  for (const row of regionRowsRes.data || []) {
    const regionCode = getRegionCodeByLawdCode((row as any).lawd_code)
    if (!regionCode) continue
    regionCountMap.set(regionCode, (regionCountMap.get(regionCode) || 0) + 1)
  }

  const regionCounts = REGIONS.map((region) => ({
    code: region.code,
    name: region.name,
    count: regionCountMap.get(region.code) || 0,
  }))

  const groupedWeekRows = aggregateWeekGroups(
    weekRows.filter((item) => {
      const date = toDate(item)
      return date ? date >= startWeekDate && date <= latestDealDate : false
    })
  )

  const topPriceWeek = groupedWeekRows
    .slice()
    .sort((a, b) => {
      if (b.top_price_krw !== a.top_price_krw) return b.top_price_krw - a.top_price_krw
      if (b.count !== a.count) return b.count - a.count
      return b.latest_date_key.localeCompare(a.latest_date_key)
    })
    .slice(0, 5)
    .map(formatTopItem)

  const topVolumeWeek = groupedWeekRows
    .slice()
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      if (b.top_price_krw !== a.top_price_krw) return b.top_price_krw - a.top_price_krw
      return b.latest_date_key.localeCompare(a.latest_date_key)
    })
    .slice(0, 5)
    .map(formatTopItem)

  return {
    ok: true,
    latestDealDate: latestDealDate.toISOString(),
    regionCounts,
    trend,
    topPriceWeek,
    topVolumeWeek,
    summarySource: 'fallback_queries',
  }
}

export async function GET() {
  try {
    try {
      const fast = await buildFastSummary()
      return jsonOk(fast)
    } catch (fastError: any) {
      console.warn('api/home/summary fast path failed, fallback used:', fastError?.message || fastError)
      const fallback = await buildFallbackSummary()
      return jsonOk(fallback)
    }
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
