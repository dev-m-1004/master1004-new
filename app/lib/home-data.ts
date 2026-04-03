import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export type SummaryItem = {
  region_name: string
  apartment_name: string
  pyeong: string
  price_krw: number
  complex_id?: string | null
  count: number
}

export type RegionCount = {
  code: string
  name: string
  count: number
}

export type TrendPoint = {
  year: string
  count: number
}

export type RegionInfo = {
  code: string
  queryPrefix: string
  name: string
}

export const REGIONS: RegionInfo[] = [
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

export const TREND_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026]
export const HOME_CACHE_HEADER = 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function jsonOk(body: any) {
  return NextResponse.json(body, {
    headers: {
      'Cache-Control': HOME_CACHE_HEADER,
    },
  })
}

export function jsonError(body: any, status = 500) {
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

function mapRegionName(regionCode?: string | null) {
  return REGIONS.find((region) => region.code === String(regionCode || '').trim())?.name || '전국'
}

function formatTopRows(rows: any[] | null | undefined): SummaryItem[] {
  return (rows || []).map((item) => ({
    region_name: mapRegionName(item.region_code),
    apartment_name: String(item.apartment_name || '-'),
    pyeong: toPyeong(Number(item.area_m2 || 0)),
    price_krw: Number(item.top_price_krw || 0),
    complex_id: item.complex_id || null,
    count: Number(item.tx_count || 0),
  }))
}

async function getLatestDealDate() {
  try {
    const { data, error } = await supabase
      .from('home_latest_deal_date_mv')
      .select('latest_deal_date')
      .limit(1)
      .maybeSingle()

    if (!error && data?.latest_deal_date) {
      return String(data.latest_deal_date)
    }
  } catch {}

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
  if (!data?.deal_year || !data?.deal_month || !data?.deal_day) return null
  return `${data.deal_year}-${String(data.deal_month).padStart(2, '0')}-${String(data.deal_day).padStart(2, '0')}`
}

export async function getTrendData(): Promise<TrendPoint[]> {
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

export async function getRegionCounts(): Promise<{ latestDealDate: string | null; regionCounts: RegionCount[] }> {
  const latestDealDate = await getLatestDealDate()
  const latestYear = latestDealDate ? Number(String(latestDealDate).slice(0, 4)) : new Date().getFullYear()
  const baseYear = latestYear - 4

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

  return {
    latestDealDate,
    regionCounts: REGIONS.map((region) => ({
      code: region.code,
      name: region.name,
      count: countMap.get(region.code) || 0,
    })),
  }
}

async function getTopRowsFromMv(viewName: 'home_top_price_week_mv' | 'home_top_volume_week_mv') {
  const { data, error } = await supabase
    .from(viewName)
    .select('region_code, complex_id, apartment_name, area_m2, top_price_krw, tx_count')
    .limit(5)

  if (error) throw error
  return formatTopRows(data as any[])
}

async function getTopRowsFallback(sortBy: 'price' | 'volume') {
  const { data, error } = await supabase
    .from('home_tx_week_complex_mv')
    .select('region_code, complex_id, apartment_name, area_m2, top_price_krw, tx_count, deal_date')
    .order('deal_date', { ascending: false })
    .limit(3000)

  if (error) throw error

  const latestDate = (data?.[0] as any)?.deal_date
  if (!latestDate) return []

  const start = new Date(`${latestDate}T00:00:00`)
  start.setDate(start.getDate() - 6)
  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`

  const filtered = (data || []).filter((row: any) => row.deal_date >= startStr && row.deal_date <= latestDate)
  const grouped = new Map<string, any>()

  for (const row of filtered) {
    const key = `${row.region_code}__${row.complex_id || ''}__${row.apartment_name || ''}__${Number(row.area_m2 || 0).toFixed(2)}`
    const current = grouped.get(key)
    if (!current) {
      grouped.set(key, {
        region_code: row.region_code,
        complex_id: row.complex_id,
        apartment_name: row.apartment_name,
        area_m2: row.area_m2,
        top_price_krw: Number(row.top_price_krw || 0),
        tx_count: Number(row.tx_count || 0),
      })
      continue
    }
    current.top_price_krw = Math.max(current.top_price_krw, Number(row.top_price_krw || 0))
    current.tx_count += Number(row.tx_count || 0)
  }

  const rows = Array.from(grouped.values()).sort((a, b) => {
    if (sortBy === 'price') {
      if (b.top_price_krw !== a.top_price_krw) return b.top_price_krw - a.top_price_krw
      return b.tx_count - a.tx_count
    }
    if (b.tx_count !== a.tx_count) return b.tx_count - a.tx_count
    return b.top_price_krw - a.top_price_krw
  })

  return formatTopRows(rows.slice(0, 5))
}

export async function getTopPriceWeek() {
  try {
    return await getTopRowsFromMv('home_top_price_week_mv')
  } catch {
    return getTopRowsFallback('price')
  }
}

export async function getTopVolumeWeek() {
  try {
    return await getTopRowsFromMv('home_top_volume_week_mv')
  } catch {
    return getTopRowsFallback('volume')
  }
}
