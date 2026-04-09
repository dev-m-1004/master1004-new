import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import {
  claimNextQueuedAdminOpsJob,
  getCurrentStage,
  markAdminOpsJobFailed,
  processClaimedAdminOpsJob,
} from '@/lib/admin-ops/jobs'

export const maxDuration = 300

function isAuthorized(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true
  }

  const adminSecret = req.headers.get('x-admin-secret')
  return Boolean(adminSecret && adminSecret === process.env.ADMIN_BACKFILL_SECRET)
}

function getRevalidateTargetsForStepResults(stepResults: Array<{ key: string }>) {
  const keys = new Set(stepResults.map((step) => step.key))
  const targets = ['/admin/ops']

  if (keys.has('listing') || keys.has('summary')) {
    targets.push('/', '/publish')
  }

  return targets
}

export async function GET(req: NextRequest) {
  let claimedJob: Awaited<ReturnType<typeof claimNextQueuedAdminOpsJob>> = null

  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    claimedJob = await claimNextQueuedAdminOpsJob()
    if (!claimedJob) {
      return NextResponse.json({
        ok: true,
        message: 'no queued job',
      })
    }

    const processed = await processClaimedAdminOpsJob(claimedJob)
    for (const target of getRevalidateTargetsForStepResults(processed.stepResults)) {
      revalidatePath(target)
    }

    return NextResponse.json({
      ok: true,
      jobId: processed.id,
      jobType: processed.jobType,
      status: processed.status,
      currentStage: processed.status === 'completed' ? null : getCurrentStage(processed),
      finishedAt: processed.finishedAt,
      errorMessage: processed.errorMessage,
      stepResults: processed.stepResults,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'worker error'
    if (claimedJob) {
      try {
        await markAdminOpsJobFailed(claimedJob.id, message)
      } catch (markError) {
        console.error('admin-ops-worker mark failed error', markError)
      }
    }

    console.error('admin-ops-worker error', error)
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    )
  }
}

export const POST = GET
