import { NextRequest, NextResponse } from 'next/server'
import {
  buildJobPayload,
  enqueueAdminOpsJob,
  parseRunJobRequest,
} from '@/lib/admin-ops/jobs'

export const maxDuration = 30

function unauthorized() {
  return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 })
}

export async function POST(req: NextRequest) {
  try {
    const adminSecret = req.headers.get('x-admin-secret')
    if (!adminSecret || adminSecret !== process.env.ADMIN_BACKFILL_SECRET) {
      return unauthorized()
    }

    const body = (await req.json().catch(() => ({}))) as {
      mode?: unknown
      group?: unknown
      recentDays?: unknown
      batchLimit?: unknown
    }

    const { mode, targetGroup, invalidGroup, options } = parseRunJobRequest(body)

    if (!mode) {
      return NextResponse.json(
        {
          ok: false,
          targetGroup: null,
          options,
          error: 'invalid mode',
        },
        { status: 400 }
      )
    }

    if (invalidGroup) {
      return NextResponse.json(
        {
          ok: false,
          mode,
          targetGroup: null,
          options,
          error: `invalid group: ${invalidGroup}`,
        },
        { status: 400 }
      )
    }

    const payload = buildJobPayload({
      mode,
      targetGroup,
      recentDays: options.recentDays,
      batchLimit: options.batchLimit,
    })

    const job = await enqueueAdminOpsJob(payload)

    return NextResponse.json({
      ok: true,
      mode,
      jobId: job.id,
      status: job.status,
      targetGroup: job.payload.group || null,
      options: {
        recentDays: job.payload.recentDays,
        batchLimit: job.payload.batchLimit,
      },
      queuedAt: job.createdAt,
      message: 'job queued',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'server error'
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
