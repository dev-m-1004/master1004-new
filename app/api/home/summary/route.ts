import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

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

type TopItemInput = {
  region_name: string
  apartment_name: string
  area_m2: number
  price_krw?: number
  complex_id?: string | null
  count: number
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
  { code: '51', queryPrefix: '42', name: '강원특별자치도' },
  { code: '43', queryPrefix: '43', name: '충청북도' },
  { code: '44', queryPrefix: '44', name: '충청남도' },
  { code: '45', queryPrefix: '52', name: '전북특별자치도' },
  { code: '46', queryPrefix: '46', name: '전라남도' },
  { code: '47', queryPrefix: '47', name: '경상북도' },
  { code: '48', queryPrefix: '48', name: '경상남도' },
  { code: '50', queryPrefix: '50', name: '제주특별자치도' },
]

const TREND_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026]
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

function toPyeong(value?: number | null) {
  const area = Number(value || 0)
  if (!area) return '-'
  return `${Math.round(area / 3.3058)}평`
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

function toDateKey(item: TxItem) {
  const y = Number(item.deal_year || 0)
  const m = Number(item.deal_month || 0)
  const d = Number(item.deal_day || 0)
  if (!y || !m || !d) return ''
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function subtractDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
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

function formatTopItem(item: TopItemInput) {
  return {
    region_name: item.region_name,
    apartment_name: item.apartment_name,
    pyeong: toPyeong(item.area_m2),
    price_krw: Number(item.price_krw || 0),
    complex_id: item.complex_id || null,
    count: item.count,
  }
}

async function getLatestDealDate() {
  const { data, error } = await supabaseAdmin
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

    if (!apartmentName || !area || !regionName) continue

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

async function buildTrendFast() {
  const results = []

  for (const year of TREND_YEARS) {
    const { count, error } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'planned', head: true })
      .eq('deal_year', year)

    if (error) throw error

    results.push({
      year: String(year),
      count: count || 0,
    })
  }

  return results
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

async function buildSummary() {
  const latestDealDate = await getLatestDealDate()
  const startWeekDate = subtractDays(latestDealDate, 6)

  const [trend, regionCounts, weekRowsRes] = await Promise.all([
    buildTrendFast(),
    buildRegionCountsFast(),
    supabaseAdmin
      .from('transactions')
      .select(
        'id, complex_id, apartment_name, area_m2, price_krw, lawd_code, deal_year, deal_month, deal_day'
      )
      .gte('deal_year', startWeekDate.getFullYear())
      .not('deal_month', 'is', null)
      .not('deal_day', 'is', null)
      .order('deal_year', { ascending: false })
      .order('deal_month', { ascending: false })
      .order('deal_day', { ascending: false })
      .order('price_krw', { ascending: false, nullsFirst: false })
      .limit(5000),
  ])

  if (weekRowsRes.error) throw weekRowsRes.error

  const weekRows = ((weekRowsRes.data || []) as TxItem[]).filter((item) => {
    const date = toDate(item)
    return date ? date >= startWeekDate && date <= latestDealDate : false
  })

  const groupedWeekRows = aggregateWeekGroups(weekRows)

  const topPriceWeek = groupedWeekRows
    .slice()
    .sort((a, b) => {
      if (b.top_price_krw !== a.top_price_krw) return b.top_price_krw - a.top_price_krw
      if (b.count !== a.count) return b.count - a.count
      return b.latest_date_key.localeCompare(a.latest_date_key)
    })
    .slice(0, 5)
    .map((item) =>
      formatTopItem({
        region_name: item.region_name,
        apartment_name: item.apartment_name,
        area_m2: item.area_m2,
        price_krw: item.top_price_krw,
        complex_id: item.complex_id || null,
        count: item.count,
      })
    )

  const topVolumeWeek = groupedWeekRows
    .slice()
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      if (b.top_price_krw !== a.top_price_krw) return b.top_price_krw - a.top_price_krw
      return b.latest_date_key.localeCompare(a.latest_date_key)
    })
    .slice(0, 5)
    .map((item) =>
      formatTopItem({
        region_name: item.region_name,
        apartment_name: item.apartment_name,
        area_m2: item.area_m2,
        price_krw: item.top_price_krw,
        complex_id: item.complex_id || null,
        count: item.count,
      })
    )

  return {
    ok: true,
    latestDealDate: latestDealDate.toISOString(),
    regionCounts,
    trend,
    topPriceWeek,
    topVolumeWeek,
    summarySource: 'transactions-fast',
  }
}

export async function GET() {
  try {
    const summary = await buildSummary()
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