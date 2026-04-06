import { createClient } from '@supabase/supabase-js'
import type { PublishRange, PublishTransactionItem } from './publish-utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function normalizeSidoName(input: string) {
  const value = String(input || '').trim()

  const aliasMap: Record<string, string> = {
    서울: '서울특별시',
    서울시: '서울특별시',
    부산: '부산광역시',
    부산시: '부산광역시',
    대구: '대구광역시',
    대구시: '대구광역시',
    인천: '인천광역시',
    인천시: '인천광역시',
    광주: '광주광역시',
    광주시: '광주광역시',
    대전: '대전광역시',
    대전시: '대전광역시',
    울산: '울산광역시',
    울산시: '울산광역시',
    세종: '세종특별자치시',
    세종시: '세종특별자치시',
    경기: '경기도',
    강원: '강원특별자치도',
    충북: '충청북도',
    충남: '충청남도',
    전북: '전북특별자치도',
    전남: '전라남도',
    경북: '경상북도',
    경남: '경상남도',
    제주: '제주특별자치도',
    제주도: '제주특별자치도',
  }

  return aliasMap[value] || value
}

function resolveSidoPrefix(code: string) {
  return code === '45' ? '52' : code
}

async function getSidoCodeByName(sido: string) {
  const normalizedSido = normalizeSidoName(sido)

  const { data, error } = await supabase
    .from('regions')
    .select('lawd_code, sido_name')
    .eq('sido_name', normalizedSido)
    .not('lawd_code', 'is', null)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)

  return resolveSidoPrefix(String(data?.lawd_code || '').trim().slice(0, 2))
}

async function getSigunguCodeByName(sido: string, sigungu: string) {
  const normalizedSido = normalizeSidoName(sido)

  const { data, error } = await supabase
    .from('regions')
    .select('lawd_code')
    .eq('sido_name', normalizedSido)
    .eq('sigungu_name', sigungu)
    .not('lawd_code', 'is', null)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const code = String(data?.lawd_code || '').trim().slice(0, 5)
  if (code.startsWith('45')) return `52${code.slice(2)}`
  return code
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function subtractDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() - days)
  return d
}

function getRangeStart(baseDate: Date, range: PublishRange) {
  const baseStart = startOfDay(baseDate)
  if (range === 'today') return baseStart
  if (range === 'week') return startOfDay(subtractDays(baseStart, 6))
  return startOfDay(subtractDays(baseStart, 29))
}

function makeDateParts(date: Date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  }
}

function buildDateFilter(rangeStart: Date, baseDate: Date) {
  const clauses: string[] = []
  const cursor = startOfDay(rangeStart)
  const end = startOfDay(baseDate)

  while (cursor.getTime() <= end.getTime()) {
    const { year, month, day } = makeDateParts(cursor)
    clauses.push(`and(deal_year.eq.${year},deal_month.eq.${month},deal_day.eq.${day})`)
    cursor.setDate(cursor.getDate() + 1)
  }

  return clauses.join(',')
}

function getLimitByRange(range: PublishRange) {
  if (range === 'today') return 300
  if (range === 'week') return 1000
  return 3000
}

export async function getPublishTransactions(params: {
  scope: 'sido' | 'sigungu'
  sido: string
  sigungu?: string
  range: PublishRange
}) {
  const { scope, sido, sigungu, range } = params
  const normalizedSido = normalizeSidoName(sido)

  let prefix = ''
  if (scope === 'sido') {
    prefix = await getSidoCodeByName(normalizedSido)
  } else {
    prefix = await getSigunguCodeByName(normalizedSido, sigungu || '')
  }

  const regionName =
    scope === 'sido' ? normalizedSido : `${normalizedSido} ${sigungu}`.trim()

  if (!prefix) {
    return {
      items: [] as PublishTransactionItem[],
      regionName,
      baseDate: new Date(),
    }
  }

  const { data: latestRow, error: latestError } = await supabase
    .from('transactions')
    .select('deal_year, deal_month, deal_day')
    .like('lawd_code', `${prefix}%`)
    .not('deal_year', 'is', null)
    .not('deal_month', 'is', null)
    .not('deal_day', 'is', null)
    .order('deal_year', { ascending: false })
    .order('deal_month', { ascending: false })
    .order('deal_day', { ascending: false })
    .order('price_krw', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (latestError) throw new Error(latestError.message)

  const baseDate =
    latestRow?.deal_year && latestRow?.deal_month && latestRow?.deal_day
      ? new Date(
          Number(latestRow.deal_year),
          Number(latestRow.deal_month) - 1,
          Number(latestRow.deal_day)
        )
      : new Date()

  const startDate = getRangeStart(baseDate, range)
  const dateFilter = buildDateFilter(startDate, baseDate)

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
      umd_name,
      road_name,
      road_bonbun,
      road_bubun,
      lawd_code,
      created_at
    `)
    .like('lawd_code', `${prefix}%`)

  if (dateFilter) {
    query = query.or(dateFilter)
  }

  const { data, error } = await query
    .order('deal_year', { ascending: false })
    .order('deal_month', { ascending: false })
    .order('deal_day', { ascending: false })
    .order('price_krw', { ascending: false, nullsFirst: false })
    .limit(getLimitByRange(range))

  if (error) throw new Error(error.message)

  return {
    items: (data || []) as PublishTransactionItem[],
    regionName,
    baseDate,
  }
}