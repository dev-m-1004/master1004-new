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

  return Array.from(new Set([format(current), format(previous)]))
}

function getLawdCodesByGroup(req: NextRequest) {
  const url = new URL(req.url)
  const group = url.searchParams.get('group') || '1'
  const envKey = `RTMS_LAWD_CODES_GROUP_${group}`
  const raw = process.env[envKey]

  if (!raw) {
    throw new Error(`${envKey} is missing`)
  }

  return {
    group,
    envKey,
    lawdCodes: raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!process.env.CRON_SECRET) {
      return NextResponse.json(
        { ok: false, error: 'CRON_SECRET is missing' },
        { status: 500 }
      )
    }

    const authHeader = req.headers.get('authorization')

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401 }
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

    const { group, envKey, lawdCodes } = getLawdCodesByGroup(req)

    if (lawdCodes.length === 0) {
      return NextResponse.json(
        { ok: false, error: `${envKey} is empty` },
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
          console.error('backfill error', { group, lawd, dealYmd: m, error })

          errors.push({
            group,
            lawd,
            dealYmd: m,
            ok: false,
            error: error?.message || 'unknown error',
          })
        }
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      group,
      envKey,
      months,
      lawdCodeCount: lawdCodes.length,
      result,
      errors,
      refreshResults: { skipped: true },
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