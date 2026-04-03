import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const adminSecret = req.headers.get('x-admin-secret')

    if (!adminSecret || adminSecret !== process.env.ADMIN_BACKFILL_SECRET) {
      return NextResponse.json(
        { ok: false, message: 'unauthorized' },
        { status: 401 }
      )
    }

    const refreshComplexes = await supabaseAdmin.rpc(
      'refresh_complexes_from_transactions'
    )

    if (refreshComplexes.error) {
      return NextResponse.json(
        {
          ok: false,
          message: refreshComplexes.error.message || 'complex refresh failed',
        },
        { status: 500 }
      )
    }

    const refreshListingCache = await supabaseAdmin.rpc('refresh_complex_listing_mv')

    if (refreshListingCache.error) {
      return NextResponse.json(
        {
          ok: false,
          message:
            refreshListingCache.error.message || 'complex listing cache refresh failed',
          result: {
            complexes: refreshComplexes.data,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: 'complex refresh completed',
      result: {
        complexes: refreshComplexes.data,
        listingCache: refreshListingCache.data,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'server error',
      },
      { status: 500 }
    )
  }
}
