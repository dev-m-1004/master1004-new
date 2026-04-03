import { NextRequest, NextResponse } from 'next/server'
import { backfillSingleMonth, buildYearMonthList } from '@/lib/molit/backfill'

type BackfillBody = {
  lawdCodes: string[]
  startYmd: string
  endYmd: string
  dryRun?: boolean
  stopOnError?: boolean
  limitMonths?: number
}

function isValidYmd(value: string) {
  return /^\d{6}$/.test(value)
}

function parseBody(body: any): BackfillBody {
  return {
    lawdCodes: Array.isArray(body?.lawdCodes) ? body.lawdCodes : [],
    startYmd: String(body?.startYmd ?? ''),
    endYmd: String(body?.endYmd ?? ''),
    dryRun: Boolean(body?.dryRun),
    stopOnError: Boolean(body?.stopOnError),
    limitMonths: Number(body?.limitMonths ?? 0),
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminSecret = req.headers.get('x-admin-secret')

    if (!adminSecret || adminSecret !== process.env.ADMIN_BACKFILL_SECRET) {
      return NextResponse.json(
        { ok: false, message: 'unauthorized' },
        { status: 401 }
      )
    }

    const body = parseBody(await req.json())

    if (!body.lawdCodes.length) {
      return NextResponse.json(
        { ok: false, message: 'lawdCodes is required' },
        { status: 400 }
      )
    }

    if (!isValidYmd(body.startYmd) || !isValidYmd(body.endYmd)) {
      return NextResponse.json(
        { ok: false, message: 'startYmd/endYmd must be YYYYMM' },
        { status: 400 }
      )
    }

    let months = buildYearMonthList(body.startYmd, body.endYmd)

    if (body.limitMonths && body.limitMonths > 0) {
      months = months.slice(0, body.limitMonths)
    }

    const results: any[] = []
    const errors: any[] = []

    for (const lawdCode of body.lawdCodes) {
      for (const dealYmd of months) {
        try {
          const result = await backfillSingleMonth({
            lawdCode,
            dealYmd,
            dryRun: body.dryRun,
          })

          results.push(result)

          await new Promise((resolve) => setTimeout(resolve, 250))
        } catch (error: any) {
          const item = {
            lawdCode,
            dealYmd,
            error: error?.message || 'unknown error',
          }

          errors.push(item)

          if (body.stopOnError) {
            return NextResponse.json(
              {
                ok: false,
                message: 'backfill stopped on error',
                results,
                errors,
              },
              { status: 500 }
            )
          }
        }
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      message:
        errors.length === 0
          ? 'backfill completed'
          : 'backfill completed with errors',
      summary: {
        requestedLawdCodes: body.lawdCodes.length,
        requestedMonths: months.length,
        totalTasks: body.lawdCodes.length * months.length,
        successCount: results.length,
        errorCount: errors.length,
        dryRun: body.dryRun,
      },
      results,
      errors,
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