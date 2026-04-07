import { NextRequest, NextResponse } from 'next/server'
import { getHomeSummary } from '@/lib/home-data'
import { supabaseAdmin } from '@/lib/supabase/admin'

function unauthorized() {
  return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 })
}

function sameDay(a?: string | null, b?: string | null) {
  if (!a || !b) return false
  return String(a).slice(0, 10) === String(b).slice(0, 10)
}

async function getCount(query: PromiseLike<{ count: number | null; error: any }>) {
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

    const [latestTx, totalUnmatchedCount, todaySummary, listingLatest, listingCount, homeSummary] =
      await Promise.all([
        supabaseAdmin
          .from('transactions')
          .select('deal_date', { head: false })
          .not('deal_date', 'is', null)
          .order('deal_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        getCount(
          supabaseAdmin
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .is('complex_id', null)
        ),
        getHomeSummary(),
        supabaseAdmin
          .from('complex_listing_mv')
          .select('latest_deal_year, latest_deal_month, latest_deal_day')
          .order('latest_deal_year', { ascending: false, nullsFirst: false })
          .order('latest_deal_month', { ascending: false, nullsFirst: false })
          .order('latest_deal_day', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle(),
        getCount(
          supabaseAdmin
            .from('complex_listing_mv')
            .select('*', { count: 'exact', head: true })
        ),
        getHomeSummary(),
      ])

    if (latestTx.error) throw latestTx.error
    if (listingLatest.error) throw listingLatest.error

    const latestDealDate = latestTx.data?.deal_date ? String(latestTx.data.deal_date) : null

    const todayTransactionCount = latestDealDate
      ? await getCount(
          supabaseAdmin
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('deal_date', latestDealDate)
        )
      : 0

    const latestDealUnmatchedCount = latestDealDate
      ? await getCount(
          supabaseAdmin
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('deal_date', latestDealDate)
            .is('complex_id', null)
        )
      : 0

    const listingDate =
      listingLatest.data?.latest_deal_year &&
      listingLatest.data?.latest_deal_month &&
      listingLatest.data?.latest_deal_day
        ? `${listingLatest.data.latest_deal_year}-${String(listingLatest.data.latest_deal_month).padStart(2, '0')}-${String(listingLatest.data.latest_deal_day).padStart(2, '0')}`
        : null

    const homeSummaryLatestDealDate =
      (todaySummary as any)?.latestDealDate || (homeSummary as any)?.latestDealDate || null

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      latestDealDate,
      todayTransactionCount,
      totalUnmatchedCount,
      latestDealUnmatchedCount,
      complexListingCount: listingCount,
      complexListingLatestDealDate: listingDate,
      homeSummaryLatestDealDate,
      homeSummaryRegionCount: Array.isArray((homeSummary as any)?.regionCounts)
        ? (homeSummary as any).regionCounts.length
        : 0,
      health: {
        collect: latestDealDate ? 'healthy' : 'danger',
        mapping: totalUnmatchedCount === 0 ? 'healthy' : totalUnmatchedCount < 100 ? 'warning' : 'danger',
        listing: sameDay(latestDealDate, listingDate) ? 'healthy' : listingDate ? 'warning' : 'danger',
        summary: sameDay(latestDealDate, homeSummaryLatestDealDate)
          ? 'healthy'
          : homeSummaryLatestDealDate
            ? 'warning'
            : 'danger',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'status route error',
      },
      { status: 500 }
    )
  }
}
