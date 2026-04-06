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

async function syncComplexMappings() {
  const insertResult = await supabaseAdmin.rpc('insert_missing_complexes')
  if (insertResult.error) {
    throw insertResult.error
  }

  const updateResult = await supabaseAdmin.rpc(
    'update_transaction_complex_mapping'
  )
  if (updateResult.error) {
    throw updateResult.error
  }
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
  const rawItems = await fetchMolitApartmentTrades({ lawdCode, dealYmd })

  const mappedRows = rawItems.map((item: any) =>
    mapMolitItemToTransactionRow(item, lawdCode)
  )

  const { start, end } = getRecent7DayWindow()

  const rows = mappedRows.filter((row: any) => {
    const dealDate = parseDealDate(row)
    return dealDate >= start && dealDate <= end
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

  if (rows.length > 0) {
    const { error } = await supabaseAdmin
      .from('transactions')
      .upsert(rows, {
        onConflict:
          'lawd_code,apartment_name,deal_year,deal_month,deal_day,area_m2,floor,price_krw',
      })

    if (error) {
      throw error
    }

    await syncComplexMappings()
  }

  return {
    lawdCode,
    dealYmd,
    fetchedCount: mappedRows.length,
    filteredCount: rows.length,
    insertedCount: rows.length,
    skippedCount: mappedRows.length - rows.length,
    dryRun: false,
  }
}