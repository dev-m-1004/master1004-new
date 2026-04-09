import { NextRequest, NextResponse } from 'next/server'
import {
  getCurrentStage,
  getLightweightHomeSummaryDate,
  listRecentAdminOpsJobs,
} from '@/lib/admin-ops/jobs'
import { supabaseAdmin } from '@/lib/supabase/admin'

function unauthorized() {
  return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 })
}

function sameDay(a?: string | null, b?: string | null) {
  if (!a || !b) return false
  return String(a).slice(0, 10) === String(b).slice(0, 10)
}

async function getCount(query: PromiseLike<{ count: number | null; error: unknown }>) {
  const { count, error } = await query
  if (error) throw error
  return Number(count || 0)
}

export async function GET(req: NextRequest) {
  try {
    const adminSecret = req.headers.get('x-admin-secret')
    if (!adminSecret || adminSecret !== process.env.ADMIN_BACKFILL_SECRET) {
      return unauthorized()
    }

    const [latestTx, listingLatest, recentJobs] = await Promise.all([
      supabaseAdmin
        .from('transactions')
        .select('deal_date')
        .not('deal_date', 'is', null)
        .order('deal_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('complex_listing_mv')
        .select('latest_deal_year, latest_deal_month, latest_deal_day')
        .order('latest_deal_year', { ascending: false, nullsFirst: false })
        .order('latest_deal_month', { ascending: false, nullsFirst: false })
        .order('latest_deal_day', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
      listRecentAdminOpsJobs(8),
    ])

    if (latestTx.error) throw latestTx.error
    if (listingLatest.error) throw listingLatest.error

    const latestDealDate = latestTx.data?.deal_date ? String(latestTx.data.deal_date) : null
    const homeSummaryLatestDealDate = await getLightweightHomeSummaryDate()

    const [todayTransactionCount, latestDealUnmatchedCount] = latestDealDate
      ? await Promise.all([
          getCount(
            supabaseAdmin
              .from('transactions')
              .select('*', { count: 'exact', head: true })
              .eq('deal_date', latestDealDate)
          ),
          getCount(
            supabaseAdmin
              .from('transactions')
              .select('*', { count: 'exact', head: true })
              .eq('deal_date', latestDealDate)
              .is('complex_id', null)
          ),
        ])
      : [0, 0]

    const listingDate =
      listingLatest.data?.latest_deal_year &&
      listingLatest.data?.latest_deal_month &&
      listingLatest.data?.latest_deal_day
        ? `${listingLatest.data.latest_deal_year}-${String(listingLatest.data.latest_deal_month).padStart(2, '0')}-${String(listingLatest.data.latest_deal_day).padStart(2, '0')}`
        : null

    const latestSuccessJob = recentJobs.find((job) => job.status === 'completed') || null
    const latestFailedJob = recentJobs.find((job) => job.status === 'failed') || null

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      latestDealDate,
      todayTransactionCount,
      latestDealUnmatchedCount,
      complexListingLatestDealDate: listingDate,
      homeSummaryLatestDealDate,
      latestSuccessAt: latestSuccessJob?.finishedAt || null,
      latestFailureMessage: latestFailedJob?.errorMessage || null,
      recentJobs: recentJobs.map((job) => ({
        id: job.id,
        jobType: job.jobType,
        status: job.status,
        currentStage: job.status === 'completed' ? null : getCurrentStage(job),
        targetGroup: job.payload.group || null,
        recentDays: job.payload.recentDays,
        batchLimit: job.payload.batchLimit,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        errorMessage: job.errorMessage,
        stepResults: job.stepResults,
      })),
      health: {
        collect: latestDealDate ? 'healthy' : 'danger',
        mapping: latestDealUnmatchedCount === 0 ? 'healthy' : latestDealUnmatchedCount < 100 ? 'warning' : 'danger',
        listing: sameDay(latestDealDate, listingDate) ? 'healthy' : listingDate ? 'warning' : 'danger',
        summary: sameDay(latestDealDate, homeSummaryLatestDealDate)
          ? 'healthy'
          : homeSummaryLatestDealDate
            ? 'warning'
            : 'danger',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'status route error'
    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    )
  }
}
