import { NextResponse } from 'next/server'
import { getHomeTopPrice } from '@/lib/home-data'

export const revalidate = 300
export const runtime = 'nodejs'

export async function GET() {
  try {
    const topPrice = await getHomeTopPrice()

    return NextResponse.json({
      ok: true,
      topPrice,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'top price fetch failed',
      },
      { status: 500 }
    )
  }
}