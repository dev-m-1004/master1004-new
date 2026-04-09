import { NextRequest, NextResponse } from 'next/server'
import {
  buildJobPayload,
  enqueueAdminOpsJob,
  enqueueAdminOpsPipeline,
  parseRunJobRequest,
  type AdminOpsJobPayload,
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

    const startedAt = new Date().toISOString()

    if (mode === 'collect' || mode === 'map' || mode === 'listing' || mode === 'summary') {
      const payload = buildJobPayload({
        mode,
        targetGroup,
        recentDays: options.recentDays,
        batchLimit: options.batchLimit,
      })

      if (mode === 'collect' && !payload.group) {
        return NextResponse.json(
          {
            ok: false,
            mode,
            targetGroup: null,
            options,
            error: 'collect mode requires group',
          },
          { status: 400 }
        )
      }

      const job = await enqueueAdminOpsJob(payload)

      return NextResponse.json({
        ok: true,
        mode,
        startedAt,
        queuedCount: 1,
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
    }

    let payloads: AdminOpsJobPayload[]

    if (mode === 'postprocess') {
      payloads = [
        buildJobPayload({
          mode: 'map',
          recentDays: options.recentDays,
          batchLimit: options.batchLimit,
        }),
        buildJobPayload({
          mode: 'listing',
          recentDays: options.recentDays,
          batchLimit: options.batchLimit,
        }),
        buildJobPayload({
          mode: 'summary',
          recentDays: options.recentDays,
          batchLimit: options.batchLimit,
        }),
      ]
    } else {
      payloads = [
        buildJobPayload({
          mode: 'collect',
          targetGroup: '1',
          recentDays: options.recentDays,
          batchLimit: options.batchLimit,
        }),
        buildJobPayload({
          mode: 'collect',
          targetGroup: '2',
          recentDays: options.recentDays,
          batchLimit: options.batchLimit,
        }),
        buildJobPayload({
          mode: 'collect',
          targetGroup: '3',
          recentDays: options.recentDays,
          batchLimit: options.batchLimit,
        }),
        buildJobPayload({
          mode: 'collect',
          targetGroup: '4',
          recentDays: options.recentDays,
          batchLimit: options.batchLimit,
        }),
        buildJobPayload({
          mode: 'map',
          recentDays: options.recentDays,
          batchLimit: options.batchLimit,
        }),
        buildJobPayload({
          mode: 'listing',
          recentDays: options.recentDays,
          batchLimit: options.batchLimit,
        }),
        buildJobPayload({
          mode: 'summary',
          recentDays: options.recentDays,
          batchLimit: options.batchLimit,
        }),
      ]
    }

    const jobs = await enqueueAdminOpsPipeline(payloads)

    return NextResponse.json({
      ok: true,
      mode,
      startedAt,
      queuedCount: jobs.length,
      status: 'queued',
      targetGroup: mode === 'all' ? 'all' : null,
      options,
      queuedAt: jobs[0]?.createdAt || null,
      jobs: jobs.map((job) => ({
        id: job.id,
        jobType: job.jobType,
        status: job.status,
        targetGroup: job.payload.group || null,
        recentDays: job.payload.recentDays,
        batchLimit: job.payload.batchLimit,
        queuedAt: job.createdAt,
      })),
      message:
        mode === 'all'
          ? 'pipeline queued: collect group1~4 -> map -> listing -> summary'
          : 'pipeline queued: map -> listing -> summary',
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
