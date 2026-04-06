import { supabaseAdmin } from '@/lib/supabase/admin'

export type TrendPoint = {
  year: string
  count: number
}

export type RegionCount = {
  code: string
  name: string
  count: number
}

export type SummaryItem = {
  region_name: string
  apartment_name: string
  pyeong: string
  price_krw: number
  complex_id?: string | null
  count: number
}

type RegionInfo = {
  code: string
  queryPrefix: string
  name: string
}

type WeekRow = {
  deal_date: string
  region_code: string | null
  complex_id: string | null
  apartment_name: string | null
  area_m2: number | null
  top_price_krw: number | null
  tx_count: number | null
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
  { code: '51', queryPrefix: '42', name: '강원특별자치도' },
  { code: '43', queryPrefix: '43', name: '충청북도' },
  { code: '44', queryPrefix: '44', name: '충청남도' },
  { code: '45', queryPrefix: '52', name: '전북특별자치도' },
  { code: '46', queryPrefix: '46', name: '전라남도' },
  { code: '47', queryPrefix: '47', name: '경상북도' },
  { code: '48', queryPrefix: '48', name: '경상남도' },
  { code: '50', queryPrefix: '50', name: '제주특별자치도' },
]

export const TREND_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026]

function toPyeong(value?: number | null) {
  const area = Number(value || 0)
  if (!area) return '-'
  return `${Math.round(area / 3.3058)}평`
}

function mapRegionName(regionCode?: string | null) {
  const code = String(regionCode || '').trim()
  return REGIONS.find((region) => region.code === code)?.name || '전국'
}

async function getLatestDealDate() {
  const { data: mvData, error: mvError } = await supabaseAdmin
    .from('home_tx_week_complex_mv')
    .select('deal_date')
    .order('deal_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!mvError && mvData?.deal_date) {
    return String(mvData.deal_date)
  }

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
  if (!data?.deal_year || !data?.deal_month || !data?.deal_day) return null

  return `${data.deal_year}-${String(data.deal_month).padStart(2, '0')}-${String(data.deal_day).padStart(2, '0')}`
}

export async function getHomeTrend(): Promise<TrendPoint[]> {
  const { data, error } = await supabaseAdmin
    .from('home_tx_year_counts_mv')
    .select('deal_year, tx_count')
    .gte('deal_year', TREND_YEARS[0])
    .lte('deal_year', TREND_YEARS[TREND_YEARS.length - 1])
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

export async function getHomeRegions(): Promise<RegionCount[]> {
  const latestDealDate = await getLatestDealDate()
  const latestYear = latestDealDate ? Number(String(latestDealDate).slice(0, 4)) : new Date().getFullYear()
  const baseYear = latestYear - 4

  const { data, error } = await supabaseAdmin
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

async function getWeekRows(): Promise<WeekRow[]> {
  const latestDealDate = await getLatestDealDate()
  if (!latestDealDate) return []

  const end = new Date(`${latestDealDate}T00:00:00`)
  end.setHours(0, 0, 0, 0)

  const start = new Date(end)
  start.setDate(start.getDate() - 6)

  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`

  const { data, error } = await supabaseAdmin
    .from('home_tx_week_complex_mv')
    .select('deal_date, region_code, complex_id, apartment_name, area_m2, top_price_krw, tx_count')
    .gte('deal_date', startStr)
    .lte('deal_date', latestDealDate)
    .order('deal_date', { ascending: false })
    .limit(5000)

  if (error) throw error
  return (data || []) as WeekRow[]
}

function groupWeekRows(rows: WeekRow[]) {
  const grouped = new Map<string, {
    region_code: string
    complex_id: string | null
    apartment_name: string
    area_m2: number
    top_price_krw: number
    tx_count: number
    latest_deal_date: string
  }>()

  for (const row of rows) {
    const regionCode = String(row.region_code || '').trim()
    const apartmentName = String(row.apartment_name || '').trim()
    const area = Number(row.area_m2 || 0)

    if (!regionCode || !apartmentName || !area) continue

    const key = `${regionCode}__${row.complex_id || ''}__${apartmentName}__${area.toFixed(2)}`
    const current = grouped.get(key)

    if (!current) {
      grouped.set(key, {
        region_code: regionCode,
        complex_id: row.complex_id || null,
        apartment_name: apartmentName,
        area_m2: area,
        top_price_krw: Number(row.top_price_krw || 0),
        tx_count: Number(row.tx_count || 0),
        latest_deal_date: row.deal_date,
      })
      continue
    }

    current.top_price_krw = Math.max(current.top_price_krw, Number(row.top_price_krw || 0))
    current.tx_count += Number(row.tx_count || 0)
    if (row.deal_date > current.latest_deal_date) {
      current.latest_deal_date = row.deal_date
      current.complex_id = row.complex_id || current.complex_id || null
    }
  }

  return Array.from(grouped.values())
}

function formatTopRows(rows: Array<{
  region_code: string
  complex_id: string | null
  apartment_name: string
  area_m2: number
  top_price_krw: number
  tx_count: number
}>) {
  return rows.map((item) => ({
    region_name: mapRegionName(item.region_code),
    apartment_name: item.apartment_name,
    pyeong: toPyeong(item.area_m2),
    price_krw: Number(item.top_price_krw || 0),
    complex_id: item.complex_id || null,
    count: Number(item.tx_count || 0),
  }))
}

export async function getHomeTopPrice(): Promise<SummaryItem[]> {
  const grouped = groupWeekRows(await getWeekRows())

  const rows = grouped
    .sort((a, b) => {
      if (b.top_price_krw !== a.top_price_krw) return b.top_price_krw - a.top_price_krw
      if (b.tx_count !== a.tx_count) return b.tx_count - a.tx_count
      return b.latest_deal_date.localeCompare(a.latest_deal_date)
    })
    .slice(0, 5)

  return formatTopRows(rows)
}

export async function getHomeTopVolume(): Promise<SummaryItem[]> {
  const grouped = groupWeekRows(await getWeekRows())

  const rows = grouped
    .sort((a, b) => {
      if (b.tx_count !== a.tx_count) return b.tx_count - a.tx_count
      if (b.top_price_krw !== a.top_price_krw) return b.top_price_krw - a.top_price_krw
      return b.latest_deal_date.localeCompare(a.latest_deal_date)
    })
    .slice(0, 5)

  return formatTopRows(rows)
}

export async function getHomeSummary() {
  const [trend, regionCounts, topPriceWeek, topVolumeWeek, latestDealDate] = await Promise.all([
    getHomeTrend(),
    getHomeRegions(),
    getHomeTopPrice(),
    getHomeTopVolume(),
    getLatestDealDate(),
  ])

  return {
    ok: true,
    latestDealDate,
    regionCounts,
    trend,
    topPriceWeek,
    topVolumeWeek,
    summarySource: 'home_summary_mvs',
  }
}
