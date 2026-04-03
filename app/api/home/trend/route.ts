import { NextResponse } from 'next/server'
import { getHomeTrend } from '@/lib/home-data'

export const revalidate = 300
export const runtime = 'nodejs'

export async function GET() {
  try {
    const trend = await getHomeTrend()

    return NextResponse.json({
      ok: true,
      trend,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'trend fetch failed',
      },
      { status: 500 }
    )
  }
}