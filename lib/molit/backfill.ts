import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchMolitApartmentTrades } from './client'
import { mapMolitItemToTransactionRow } from './mapper'

export function buildYearMonthList(startYmd: string, endYmd: string) {
  const result: string[] = []

  let year = Number(startYmd.slice(0, 4))
  let month = Number(startYmd.slice(4, 6))
  const endYear = Number(endYmd.slice(0, 4))
  const endMonth = Number(endYmd.slice(4, 6))

  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push(`${year}${String(month).padStart(2, '0')}`)

    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }

  return result
}

function toDateOnlyKst(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())
  )
}

function getRecent7DayWindow() {
  const todayKst = toDateOnlyKst()

  const end = new Date(todayKst)
  end.setUTCDate(end.getUTCDate() - 1) // 전일

  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 6) // 전일 포함 최근 7일

  return { start, end }
}

function parseDealDate(row: {
  deal_year: number
  deal_month: number
  deal_day: number
}) {
  return new Date(Date.UTC(row.deal_year, row.deal_month - 1, row.deal_day))
}

type BackfillSingleMonthParams = {
  lawdCode: string
  dealYmd: string
  dryRun?: boolean
}

export async function backfillSingleMonth({
  lawdCode,
  dealYmd,
  dryRun = false,
}: BackfillSingleMonthParams) {
  console.log('[backfill] start', { lawdCode, dealYmd, dryRun })

  const fetchStartedAt = Date.now()
  const rawItems = await fetchMolitApartmentTrades({ lawdCode, dealYmd })
  console.log('[backfill] fetched raw items', {
    lawdCode,
    dealYmd,
    count: rawItems.length,
    ms: Date.now() - fetchStartedAt,
  })

  const mapStartedAt = Date.now()
  const mappedRows = rawItems.map((item: any) =>
    mapMolitItemToTransactionRow(item, lawdCode)
  )
  console.log('[backfill] mapped rows', {
    lawdCode,
    dealYmd,
    count: mappedRows.length,
    ms: Date.now() - mapStartedAt,
  })

  const { start, end } = getRecent7DayWindow()

  const rows = mappedRows.filter((row: any) => {
    const dealDate = parseDealDate(row)
    return dealDate >= start && dealDate <= end
  })

  console.log('[backfill] filtered rows', {
    lawdCode,
    dealYmd,
    count: rows.length,
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  })

  if (dryRun) {
    return {
      lawdCode,
      dealYmd,
      fetchedCount: mappedRows.length,
      filteredCount: rows.length,
      insertedCount: 0,
      skippedCount: mappedRows.length - rows.length,
      dryRun: true,
    }
  }

  let insertedCount = 0

  if (rows.length > 0) {
    for (const row of rows) {
      const upsertStartedAt = Date.now()

      const { error } = await supabaseAdmin
        .from('transactions')
        .upsert([row], {
          onConflict:
            'lawd_code,apartment_name,deal_year,deal_month,deal_day,area_m2,floor,price_krw',
        })

      console.log('[backfill] single row upsert finished', {
        lawdCode,
        dealYmd,
        apartmentName: row.apartment_name,
        dealYear: row.deal_year,
        dealMonth: row.deal_month,
        dealDay: row.deal_day,
        ms: Date.now() - upsertStartedAt,
        hasError: !!error,
        error: error?.message ?? null,
      })

      if (error) {
        throw error
      }

      insertedCount += 1
    }
  }

  return {
    lawdCode,
    dealYmd,
    fetchedCount: mappedRows.length,
    filteredCount: rows.length,
    insertedCount,
    skippedCount: mappedRows.length - rows.length,
    dryRun: false,
  }
}