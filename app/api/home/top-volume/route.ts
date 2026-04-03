import { NextResponse } from 'next/server'
import { getHomeTopVolume } from '@/lib/home-data'

export const revalidate = 300
export const runtime = 'nodejs'

export async function GET() {
  try {
    const topVolume = await getHomeTopVolume()

    return NextResponse.json({
      ok: true,
      topVolume,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'top volume fetch failed',
      },
      { status: 500 }
    )
  }
}