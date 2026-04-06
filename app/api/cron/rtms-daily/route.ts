import { NextRequest, NextResponse } from 'next/server'
import { backfillSingleMonth } from '@/lib/molit/backfill'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const maxDuration = 300

function getKstNow() {
  const now = new Date()
  return new Date(now.getTime() + 9 * 60 * 60 * 1000)
}

function getTargetMonths() {
  const kst = getKstNow()

  const current = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1))
  const previous = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() - 1, 1))

  const format = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`

  return Array.from(new Set([format(current), format(previous)]))
}

async function refreshAfterImport() {
  const results: Record<string, any> = {}

  const refreshComplexes = await supabaseAdmin.rpc('refresh_complexes_from_transactions')
  results.refresh_complexes_from_transactions = {
    ok: !refreshComplexes.error,
    error: refreshComplexes.error?.message ?? null,
  }

  const refreshListing = await supabaseAdmin.rpc('refresh_complex_listing_mv')
  results.refresh_complex_listing_mv = {
    ok: !refreshListing.error,
    error: refreshListing.error?.message ?? null,
  }

  const refreshHomeSummary = await supabaseAdmin.rpc('refresh_home_summary_mvs')
  results.refresh_home_summary_mvs = {
    ok: !refreshHomeSummary.error,
    error: refreshHomeSummary.error?.message ?? null,
  }

  return results
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401 }
      )
    }

    if (!process.env.CRON_SECRET) {
      return NextResponse.json(
        { ok: false, error: 'CRON_SECRET is missing' },
        { status: 500 }
      )
    }

    if (!process.env.RTMS_LAWD_CODES) {
      return NextResponse.json(
        { ok: false, error: 'RTMS_LAWD_CODES is missing' },
        { status: 500 }
      )
    }

    if (!process.env.MOLIT_API_KEY) {
      return NextResponse.json(
        { ok: false, error: 'MOLIT_API_KEY is missing' },
        { status: 500 }
      )
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is missing' },
        { status: 500 }
      )
    }

    const lawdCodes = process.env.RTMS_LAWD_CODES
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)

    if (lawdCodes.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'RTMS_LAWD_CODES is empty' },
        { status: 500 }
      )
    }

    const months = getTargetMonths()
    const result: any[] = []
    const errors: any[] = []

    for (const lawd of lawdCodes) {
      for (const m of months) {
        try {
          const r = await backfillSingleMonth({
            lawdCode: lawd,
            dealYmd: m,
          })

          result.push({
  lawd,
  ok: true,
  ...r,
})
        } catch (error: any) {
          console.error('backfill error', { lawd, dealYmd: m, error })

          errors.push({
            lawd,
            dealYmd: m,
            ok: false,
            error: error?.message || 'unknown error',
          })
        }
      }
    }

    const refreshResults = await refreshAfterImport()

    return NextResponse.json({
      ok: errors.length === 0,
      months,
      lawdCodeCount: lawdCodes.length,
      result,
      errors,
      refreshResults,
    })
  } catch (error: any) {
    console.error('rtms-daily route error', error)

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'unknown error',
      },
      { status: 500 }
    )
  }
}