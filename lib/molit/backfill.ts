// (updated backfill.ts)
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchMolitApartmentTrades } from './client'
import { mapMolitItemToTransactionRow } from './mapper'

function toDateOnlyKst(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()))
}

function getRecent7DayWindow() {
  const todayKst = toDateOnlyKst()
  const end = new Date(todayKst)
  end.setUTCDate(end.getUTCDate() - 1)

  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 6)

  return { start, end }
}

function parseDealDate(row: any) {
  return new Date(Date.UTC(row.deal_year, row.deal_month - 1, row.deal_day))
}

export async function backfillSingleMonth({ lawdCode, dealYmd }: any) {
  const rawItems = await fetchMolitApartmentTrades({ lawdCode, dealYmd })
  const mappedRows = rawItems.map((item: any) =>
    mapMolitItemToTransactionRow(item, lawdCode)
  )

  const { start, end } = getRecent7DayWindow()

  const rows = mappedRows.filter((row: any) => {
    const dealDate = parseDealDate(row)
    return dealDate >= start && dealDate <= end
  })

  if (rows.length > 0) {
    const { error } = await supabaseAdmin
      .from('transactions')
      .upsert(rows, {
        onConflict:
          'lawd_code,apartment_name,deal_year,deal_month,deal_day,area_m2,floor,price_krw',
      })

    if (error) throw error
  }

  return {
    fetched: mappedRows.length,
    filtered: rows.length,
  }
}
