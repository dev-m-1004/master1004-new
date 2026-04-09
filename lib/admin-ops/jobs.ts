import { backfillSingleMonth } from '@/lib/molit/backfill'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type AdminOpsMode =
  | 'collect'
  | 'map'
  | 'listing'
  | 'summary'
  | 'postprocess'
  | 'all'

export type CollectGroup = '1' | '2' | '3' | '4'
export type AdminOpsStage = 'collect' | 'map' | 'listing' | 'summary'
export type AdminOpsJobStatus = 'queued' | 'running' | 'completed' | 'failed'

export type AdminOpsJobPayload = {
  mode: AdminOpsMode
  group?: CollectGroup | null
  recentDays: number
  batchLimit: number
  stageIndex?: number
}

export type AdminOpsStepResult = {
  key: AdminOpsStage
  ok: boolean
  message: string
  startedAt: string
  finishedAt: string
  durationMs: number
}

export type AdminOpsJobRecord = {
  id: string
  jobType: AdminOpsMode
  status: AdminOpsJobStatus
  payload: AdminOpsJobPayload
  stepResults: AdminOpsStepResult[]
  resultJson: Record<string, unknown> | null
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

type RawJobRow = {
  id?: string
  job_type?: string
  payload?: unknown
  status?: string
  step_results?: unknown
  result_json?: unknown
  error_message?: string | null
  started_at?: string | null
  finished_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

const JOB_TABLE = 'admin_ops_jobs'
const STALE_RUNNING_MINUTES = 20

export function toPositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}

export function isValidMode(mode: string): mode is AdminOpsMode {
  return ['collect', 'map', 'listing', 'summary', 'postprocess', 'all'].includes(mode)
}

export function isValidGroup(group: string): group is CollectGroup {
  return ['1', '2', '3', '4'].includes(group)
}

function logJobEvent(event: string, payload: Record<string, unknown>) {
  console.log(`[admin-ops-job] ${event}`, payload)
}

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

function getAllGroups(targetGroup?: CollectGroup) {
  const allowed = targetGroup ? [targetGroup] : ['1', '2', '3', '4']
  const groups: Array<{ group: string; envKey: string; lawdCodes: string[] }> = []

  for (const group of allowed) {
    const envKey = `RTMS_LAWD_CODES_GROUP_${group}`
    const raw = process.env[envKey]
    if (!raw) continue

    const lawdCodes = raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    groups.push({ group, envKey, lawdCodes })
  }

  if (groups.length === 0) {
    throw new Error(
      targetGroup
        ? `RTMS_LAWD_CODES_GROUP_${targetGroup} 환경변수가 비어 있습니다.`
        : 'RTMS_LAWD_CODES_GROUP_1~4 환경변수가 비어 있습니다.'
    )
  }

  return groups
}

export function getStageSequence(mode: AdminOpsMode): AdminOpsStage[] {
  if (mode === 'collect') return ['collect']
  if (mode === 'map') return ['map']
  if (mode === 'listing') return ['listing']
  if (mode === 'summary') return ['summary']
  if (mode === 'postprocess') return ['map', 'listing', 'summary']
  return ['collect', 'map', 'listing', 'summary']
}

function normalizePayload(value: unknown): AdminOpsJobPayload {
  const payload = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  const rawMode = String(payload.mode || 'all')
  const rawGroup = payload.group == null ? '' : String(payload.group).trim()
  const mode = isValidMode(rawMode) ? rawMode : 'all'
  const group = isValidGroup(rawGroup) ? rawGroup : null

  return {
    mode,
    group,
    recentDays: toPositiveInt(payload.recentDays, 3),
    batchLimit: toPositiveInt(payload.batchLimit, 5000),
    stageIndex: Math.max(0, Number(payload.stageIndex || 0) || 0),
  }
}

function normalizeStepResults(value: unknown): AdminOpsStepResult[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const key = String(row.key || '') as AdminOpsStage
      if (!['collect', 'map', 'listing', 'summary'].includes(key)) return null

      return {
        key,
        ok: Boolean(row.ok),
        message: String(row.message || ''),
        startedAt: String(row.startedAt || ''),
        finishedAt: String(row.finishedAt || ''),
        durationMs: Number(row.durationMs || 0),
      }
    })
    .filter((item): item is AdminOpsStepResult => Boolean(item))
}

function normalizeResultJson(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function normalizeStatus(value: string | undefined): AdminOpsJobStatus {
  if (value === 'queued' || value === 'running' || value === 'completed' || value === 'failed') {
    return value
  }
  return 'queued'
}

function normalizeJobRow(row: RawJobRow): AdminOpsJobRecord {
  return {
    id: String(row.id || ''),
    jobType: (isValidMode(String(row.job_type || '')) ? String(row.job_type) : 'all') as AdminOpsMode,
    status: normalizeStatus(row.status),
    payload: normalizePayload(row.payload),
    stepResults: normalizeStepResults(row.step_results),
    resultJson: normalizeResultJson(row.result_json),
    errorMessage: row.error_message || null,
    startedAt: row.started_at || null,
    finishedAt: row.finished_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

export function getCurrentStage(job: AdminOpsJobRecord): AdminOpsStage | null {
  const stages = getStageSequence(job.payload.mode)
  return stages[job.payload.stageIndex || 0] || null
}

export async function enqueueAdminOpsJob(payload: AdminOpsJobPayload) {
  const row = {
    job_type: payload.mode,
    payload,
    status: 'queued',
    step_results: [],
    result_json: null,
    error_message: null,
  }

  const { data, error } = await supabaseAdmin
    .from(JOB_TABLE)
    .insert(row)
    .select('*')
    .single()

  if (error) throw error

  const job = normalizeJobRow((data || {}) as RawJobRow)
  logJobEvent('enqueued', {
    jobId: job.id,
    mode: job.jobType,
    group: job.payload.group,
    recentDays: job.payload.recentDays,
    batchLimit: job.payload.batchLimit,
  })

  return job
}

export async function enqueueAdminOpsPipeline(payloads: AdminOpsJobPayload[]) {
  const jobs: AdminOpsJobRecord[] = []

  for (const payload of payloads) {
    const job = await enqueueAdminOpsJob(payload)
    jobs.push(job)
  }

  return jobs
}

export async function listRecentAdminOpsJobs(limit = 10) {
  const safeLimit = Math.min(Math.max(limit, 1), 30)
  const { data, error } = await supabaseAdmin
    .from(JOB_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error) throw error
  return (data || []).map((row) => normalizeJobRow(row as RawJobRow))
}

export async function claimNextQueuedAdminOpsJob() {
  const staleCutoff = new Date(Date.now() - STALE_RUNNING_MINUTES * 60 * 1000).toISOString()
  const { error: requeueError } = await supabaseAdmin
    .from(JOB_TABLE)
    .update({
      status: 'queued',
      updated_at: new Date().toISOString(),
      error_message: `worker lease expired after ${STALE_RUNNING_MINUTES} minutes; requeued`,
    })
    .eq('status', 'running')
    .is('finished_at', null)
    .lt('updated_at', staleCutoff)

  if (requeueError) throw requeueError

  const { data, error } = await supabaseAdmin
    .from(JOB_TABLE)
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const candidate = normalizeJobRow(data as RawJobRow)
  const now = new Date().toISOString()

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from(JOB_TABLE)
    .update({
      status: 'running',
      started_at: candidate.startedAt || now,
      updated_at: now,
      error_message: null,
    })
    .eq('id', candidate.id)
    .eq('status', 'queued')
    .select('*')
    .maybeSingle()

  if (claimError) throw claimError
  if (!claimed) return null

  return normalizeJobRow(claimed as RawJobRow)
}

export async function markAdminOpsJobFailed(id: string, errorMessage: string) {
  return updateJobRow(id, {
    status: 'failed',
    finished_at: new Date().toISOString(),
    error_message: errorMessage,
  })
}

async function updateJobRow(id: string, patch: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from(JOB_TABLE)
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return normalizeJobRow((data || {}) as RawJobRow)
}

async function runCollectStage(group?: CollectGroup | null): Promise<AdminOpsStepResult> {
  if (!process.env.MOLIT_API_KEY) {
    throw new Error('MOLIT_API_KEY is missing')
  }

  const startedAt = new Date()
  logJobEvent('stage.start', {
    stage: 'collect',
    startedAt: startedAt.toISOString(),
    group: group || 'all',
  })

  const months = getTargetMonths()
  const groups = getAllGroups(group || undefined)
  let errorCount = 0

  for (const groupItem of groups) {
    for (const lawdCode of groupItem.lawdCodes) {
      for (const dealYmd of months) {
        try {
          await backfillSingleMonth({ lawdCode, dealYmd })
        } catch (error) {
          console.error('admin ops collect job error', {
            group: groupItem.group,
            lawdCode,
            dealYmd,
            error,
          })
          errorCount += 1
        }
      }
    }
  }

  const finishedAt = new Date()
  const durationMs = finishedAt.getTime() - startedAt.getTime()
  const ok = errorCount === 0
  const message = ok ? '자료수집 완료' : `자료수집 중 오류 ${errorCount}건 발생`

  logJobEvent('stage.finish', {
    stage: 'collect',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    ok,
    errorMessage: ok ? null : message,
  })

  return {
    key: 'collect',
    ok,
    message,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
  }
}

async function runMapStage(payload: AdminOpsJobPayload): Promise<AdminOpsStepResult> {
  const startedAt = new Date()
  logJobEvent('stage.start', {
    stage: 'map',
    startedAt: startedAt.toISOString(),
    recentDays: payload.recentDays,
    batchLimit: payload.batchLimit,
  })

  const refreshComplexes = await supabaseAdmin.rpc(
    'refresh_complexes_from_transactions_recent',
    {
      p_days: payload.recentDays,
      p_batch_limit: payload.batchLimit,
    }
  )

  const finishedAt = new Date()
  const durationMs = finishedAt.getTime() - startedAt.getTime()

  if (refreshComplexes.error) {
    const rawMessage = refreshComplexes.error.message || 'complex mapping failed'
    const missingRecentRpc =
      /refresh_complexes_from_transactions_recent/i.test(rawMessage) &&
      /(not exist|does not exist|Could not find the function)/i.test(rawMessage)
    const message = missingRecentRpc
      ? 'TODO: Supabase에 refresh_complexes_from_transactions_recent(p_days, p_batch_limit) RPC를 추가해야 합니다.'
      : rawMessage

    logJobEvent('stage.finish', {
      stage: 'map',
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      ok: false,
      errorMessage: message,
    })

    return {
      key: 'map',
      ok: false,
      message,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
    }
  }

  logJobEvent('stage.finish', {
    stage: 'map',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    ok: true,
    errorMessage: null,
  })

  return {
    key: 'map',
    ok: true,
    message: `최근 ${payload.recentDays}일 complex_id 매핑 완료 (batchLimit=${payload.batchLimit})`,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
  }
}

async function runListingStage(): Promise<AdminOpsStepResult> {
  const startedAt = new Date()
  logJobEvent('stage.start', {
    stage: 'listing',
    startedAt: startedAt.toISOString(),
  })

  const refreshListing = await supabaseAdmin.rpc('refresh_complex_listing_mv')
  const finishedAt = new Date()
  const durationMs = finishedAt.getTime() - startedAt.getTime()

  if (refreshListing.error) {
    const message = refreshListing.error.message || 'listing refresh failed'
    logJobEvent('stage.finish', {
      stage: 'listing',
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      ok: false,
      errorMessage: message,
    })

    return {
      key: 'listing',
      ok: false,
      message,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
    }
  }

  logJobEvent('stage.finish', {
    stage: 'listing',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    ok: true,
    errorMessage: null,
  })

  return {
    key: 'listing',
    ok: true,
    message: '메인 리스트 MV 새로고침 완료',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
  }
}

async function runSummaryStage(): Promise<AdminOpsStepResult> {
  const startedAt = new Date()
  logJobEvent('stage.start', {
    stage: 'summary',
    startedAt: startedAt.toISOString(),
  })

  const refreshHome = await supabaseAdmin.rpc('refresh_home_summary_mvs')
  const finishedAt = new Date()
  const durationMs = finishedAt.getTime() - startedAt.getTime()

  if (refreshHome.error) {
    const message = refreshHome.error.message || 'home summary refresh failed'
    logJobEvent('stage.finish', {
      stage: 'summary',
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      ok: false,
      errorMessage: message,
    })

    return {
      key: 'summary',
      ok: false,
      message,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
    }
  }

  logJobEvent('stage.finish', {
    stage: 'summary',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    ok: true,
    errorMessage: null,
  })

  return {
    key: 'summary',
    ok: true,
    message: '홈 요약 MV 새로고침 완료',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
  }
}

async function executeStage(stage: AdminOpsStage, payload: AdminOpsJobPayload) {
  if (stage === 'collect') return runCollectStage(payload.group || undefined)
  if (stage === 'map') return runMapStage(payload)
  if (stage === 'listing') return runListingStage()
  return runSummaryStage()
}

export async function processClaimedAdminOpsJob(job: AdminOpsJobRecord) {
  const payload = normalizePayload(job.payload)
  const stages = getStageSequence(payload.mode)
  const stageIndex = Math.max(0, Number(payload.stageIndex || 0))
  const currentStage = stages[stageIndex]

  if (!currentStage) {
    return updateJobRow(job.id, {
      status: 'completed',
      finished_at: new Date().toISOString(),
      result_json: {
        message: 'No remaining stages',
        steps: job.stepResults,
      },
    })
  }

  const stepResult = await executeStage(currentStage, payload)
  const nextStepResults = [...job.stepResults, stepResult]

  if (!stepResult.ok) {
    return updateJobRow(job.id, {
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_message: stepResult.message,
      step_results: nextStepResults,
      result_json: {
        mode: payload.mode,
        lastStage: currentStage,
        steps: nextStepResults,
      },
    })
  }

  const nextStageIndex = stageIndex + 1
  const nextStage = stages[nextStageIndex] || null

  if (nextStage) {
    return updateJobRow(job.id, {
      status: 'queued',
      payload: {
        ...payload,
        stageIndex: nextStageIndex,
      },
      step_results: nextStepResults,
      result_json: {
        mode: payload.mode,
        lastCompletedStage: currentStage,
        nextStage,
        steps: nextStepResults,
      },
      error_message: null,
    })
  }

  return updateJobRow(job.id, {
    status: 'completed',
    finished_at: new Date().toISOString(),
    step_results: nextStepResults,
    result_json: {
      mode: payload.mode,
      lastCompletedStage: currentStage,
      steps: nextStepResults,
    },
    error_message: null,
  })
}

export async function getLightweightHomeSummaryDate() {
  const { data, error } = await supabaseAdmin
    .from('home_tx_week_complex_mv')
    .select('deal_date')
    .order('deal_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data?.deal_date ? String(data.deal_date) : null
}

export function parseRunJobRequest(body: {
  mode?: unknown
  group?: unknown
  recentDays?: unknown
  batchLimit?: unknown
}) {
  const rawMode = String(body?.mode || 'all')
  const rawGroup = body?.group == null ? '' : String(body.group).trim()

  return {
    mode: isValidMode(rawMode) ? rawMode : null,
    targetGroup: isValidGroup(rawGroup) ? rawGroup : null,
    invalidGroup: rawGroup && !isValidGroup(rawGroup) ? rawGroup : null,
    options: {
      recentDays: toPositiveInt(body?.recentDays ?? process.env.ADMIN_OPS_RECENT_DAYS, 3),
      batchLimit: toPositiveInt(body?.batchLimit ?? process.env.ADMIN_OPS_BATCH_LIMIT, 5000),
    },
  }
}

export function buildJobPayload(params: {
  mode: AdminOpsMode
  targetGroup?: CollectGroup | null
  recentDays: number
  batchLimit: number
}): AdminOpsJobPayload {
  return {
    mode: params.mode,
    group: params.targetGroup || null,
    recentDays: params.recentDays,
    batchLimit: params.batchLimit,
    stageIndex: 0,
  }
}
