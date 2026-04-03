import { NextResponse } from 'next/server'
import { getHomeRegions } from '@/lib/home-data'

export const revalidate = 300
export const runtime = 'nodejs'

export async function GET() {
  try {
    const regions = await getHomeRegions()

    return NextResponse.json({
      ok: true,
      regions,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'regions fetch failed',
      },
      { status: 500 }
    )
  }
}