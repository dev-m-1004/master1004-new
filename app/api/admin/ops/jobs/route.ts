import { NextRequest, NextResponse } from 'next/server'
import { getCurrentStage, listRecentAdminOpsJobs, toPositiveInt } from '@/lib/admin-ops/jobs'

function unauthorized() {
  return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 })
}

export async function GET(req: NextRequest) {
  try {
    const adminSecret = req.headers.get('x-admin-secret')
    if (!adminSecret || adminSecret !== process.env.ADMIN_BACKFILL_SECRET) {
      return unauthorized()
    }

    const limit = toPositiveInt(req.nextUrl.searchParams.get('limit'), 10)
    const jobs = await listRecentAdminOpsJobs(limit)

    return NextResponse.json({
      ok: true,
      items: jobs.map((job) => ({
        id: job.id,
        jobType: job.jobType,
        status: job.status,
        currentStage: job.status === 'completed' ? null : getCurrentStage(job),
        targetGroup: job.payload.group || null,
        recentDays: job.payload.recentDays,
        batchLimit: job.payload.batchLimit,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        errorMessage: job.errorMessage,
        stepResults: job.stepResults,
      })),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'jobs route error'
    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    )
  }
}
