import { NextRequest, NextResponse } from 'next/server'
import { backfillSingleMonth } from '@/lib/molit/backfill'

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

  return [format(current), format(previous)]
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const lawdCodes = (process.env.RTMS_LAWD_CODES || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)

  const months = getTargetMonths()

  const result = []

  for (const lawd of lawdCodes) {
    for (const m of months) {
      const r = await backfillSingleMonth({ lawdCode: lawd, dealYmd: m })
      result.push({ lawd, m, ...r })
    }
  }

  return NextResponse.json({ ok: true, result })
}
