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

async function createImportJob(params: {
  jobType: 'backfill' | 'daily_sync'
  lawdCode: string
  dealYmd: string
}) {
  const { data, error } = await supabaseAdmin
    .from('import_jobs')
    .insert({
      job_type: params.jobType,
      lawd_code: params.lawdCode,
      deal_ymd: params.dealYmd,
      status: 'pending',
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

async function finishImportJob(params: {
  id: number
  status: 'success' | 'failed'
  fetchedCount?: number
  insertedCount?: number
  updatedCount?: number
  skippedCount?: number
  errorMessage?: string | null
}) {
  const { error } = await supabaseAdmin
    .from('import_jobs')
    .update({
      status: params.status,
      fetched_count: params.fetchedCount ?? 0,
      inserted_count: params.insertedCount ?? 0,
      updated_count: params.updatedCount ?? 0,
      skipped_count: params.skippedCount ?? 0,
      error_message: params.errorMessage ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  if (error) {
    throw error
  }
}

async function syncComplexMappings() {
  const { error: insertComplexesError } = await supabaseAdmin.rpc(
    'insert_missing_complexes'
  )

  if (insertComplexesError) {
    throw insertComplexesError
  }

  const { error: updateMappingsError } = await supabaseAdmin.rpc(
    'update_transaction_complex_mapping'
  )

  if (updateMappingsError) {
    throw updateMappingsError
  }
}

export async function backfillSingleMonth(params: {
  lawdCode: string
  dealYmd: string
  dryRun?: boolean
}) {
  const { lawdCode, dealYmd, dryRun = false } = params

  const job = await createImportJob({
    jobType: 'backfill',
    lawdCode,
    dealYmd,
  })

  try {
    const rawItems = await fetchMolitApartmentTrades({ lawdCode, dealYmd })
    const rows = rawItems.map((item) =>
      mapMolitItemToTransactionRow(item, lawdCode)
    )

    if (dryRun) {
      await finishImportJob({
        id: job.id,
        status: 'success',
        fetchedCount: rows.length,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: rows.length,
      })

      return {
        lawdCode,
        dealYmd,
        fetchedCount: rows.length,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: rows.length,
        dryRun: true,
      }
    }

    const { error } = await supabaseAdmin
      .from('transactions')
      .upsert(rows, {
        onConflict:
          'lawd_code,apartment_name,deal_year,deal_month,deal_day,area_m2,floor,price_krw',
        ignoreDuplicates: true,
      })

    if (error) {
      throw error
    }

    await syncComplexMappings()

    await finishImportJob({
      id: job.id,
      status: 'success',
      fetchedCount: rows.length,
      insertedCount: rows.length,
      updatedCount: 0,
      skippedCount: 0,
    })

    return {
      lawdCode,
      dealYmd,
      fetchedCount: rows.length,
      insertedCount: rows.length,
      updatedCount: 0,
      skippedCount: 0,
      dryRun: false,
    }
  } catch (error: any) {
    await finishImportJob({
      id: job.id,
      status: 'failed',
      errorMessage: error?.message || 'unknown error',
    })

    throw error
  }
}