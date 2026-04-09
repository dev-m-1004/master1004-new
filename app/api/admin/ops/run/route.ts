import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { backfillSingleMonth } from '@/lib/molit/backfill'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const maxDuration = 300

type Mode = 'collect' | 'map' | 'listing' | 'summary' | 'postprocess' | 'all'
type CollectGroup = '1' | '2' | '3' | '4'
type PostprocessStepKey =
  | 'refresh_complexes_from_transactions_recent'
  | 'refresh_complex_listing_mv'
  | 'refresh_home_summary_mvs'

type RunBody = {
  mode?: unknown
  group?: unknown
  recentDays?: unknown
  batchLimit?: unknown
}

type PostprocessOptions = {
  recentDays: number
  batchLimit: number
}

type PostprocessStepResult = {
  key: PostprocessStepKey
  ok: boolean
  message: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
}

type CollectSummary = {
  group: string
  lawdCodeCount: number
  resultCount: number
  errorCount: number
}

type CollectResult = {
  ok: boolean
  months: string[]
  groups: CollectSummary[]
  startedAt: string
  finishedAt: string
  durationMs: number
  steps: Array<{
    key: string
    ok: boolean
    message: string
    startedAt: string
    finishedAt: string
    durationMs: number
  }>
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function unauthorized() {
  return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 })
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
      .map((v) => v.trim())
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

function toPositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}

function isValidMode(mode: string): mode is Mode {
  return ['collect', 'map', 'listing', 'summary', 'postprocess', 'all'].includes(mode)
}

function isValidGroup(group: string): group is CollectGroup {
  return ['1', '2', '3', '4'].includes(group)
}

function logStageEvent(phase: 'start' | 'finish', payload: Record<string, unknown>) {
  const label = phase === 'start' ? '[admin-ops] stage started' : '[admin-ops] stage finished'
  console.log(label, payload)
}

function parseBody(body: RunBody): {
  mode: Mode
  targetGroup?: CollectGroup
  invalidGroup?: string
  options: PostprocessOptions
} {
  const mode = String(body?.mode || 'postprocess') as Mode
  const rawGroup = body?.group == null ? '' : String(body.group).trim()
  const targetGroup = isValidGroup(rawGroup) ? rawGroup : undefined

  return {
    mode,
    targetGroup,
    invalidGroup: rawGroup && !targetGroup ? rawGroup : undefined,
    options: {
      recentDays: toPositiveInt(body?.recentDays ?? process.env.ADMIN_OPS_RECENT_DAYS, 3),
      batchLimit: toPositiveInt(body?.batchLimit ?? process.env.ADMIN_OPS_BATCH_LIMIT, 5000),
    },
  }
}

async function runCollect(targetGroup?: CollectGroup): Promise<CollectResult> {
  if (!process.env.MOLIT_API_KEY) {
    throw new Error('MOLIT_API_KEY is missing')
  }

  const startedAt = new Date()
  logStageEvent('start', {
    stage: 'collect',
    startedAt: startedAt.toISOString(),
    targetGroup: targetGroup || 'all',
  })

  const months = getTargetMonths()
  const groups = getAllGroups(targetGroup)
  const summaries: CollectSummary[] = []

  for (const group of groups) {
    let resultCount = 0
    let errorCount = 0

    logStageEvent('start', {
      stage: 'collect-group',
      group: group.group,
      lawdCodeCount: group.lawdCodes.length,
      months,
      startedAt: new Date().toISOString(),
    })

    for (const lawdCode of group.lawdCodes) {
      for (const dealYmd of months) {
        try {
          await backfillSingleMonth({ lawdCode, dealYmd })
          resultCount += 1
        } catch (error) {
          console.error('admin ops collect error', {
            group: group.group,
            lawdCode,
            dealYmd,
            error,
          })
          errorCount += 1
        }
      }
    }

    summaries.push({
      group: group.group,
      lawdCodeCount: group.lawdCodes.length,
      resultCount,
      errorCount,
    })

    logStageEvent('finish', {
      stage: 'collect-group',
      group: group.group,
      resultCount,
      errorCount,
      finishedAt: new Date().toISOString(),
    })
  }

  const ok = summaries.every((item) => item.errorCount === 0)
  const finishedAt = new Date()
  const durationMs = finishedAt.getTime() - startedAt.getTime()
  const message = ok ? '자료수집 완료' : '자료수집 중 일부 오류가 발생했습니다.'

  logStageEvent('finish', {
    stage: 'collect',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    ok,
    targetGroup: targetGroup || 'all',
    errorMessage: ok ? null : message,
  })

  return {
    ok,
    months,
    groups: summaries,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    steps: [
      {
        key: targetGroup ? `collect_group_${targetGroup}` : 'collect_all_groups',
        ok,
        message,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
      },
    ],
  }
}

async function runMapStep(options: PostprocessOptions): Promise<PostprocessStepResult> {
  const startedAt = new Date()
  logStageEvent('start', {
    stage: 'map',
    startedAt: startedAt.toISOString(),
    recentDays: options.recentDays,
    batchLimit: options.batchLimit,
  })

  const refreshComplexes = await supabaseAdmin.rpc(
    'refresh_complexes_from_transactions_recent',
    {
      p_days: options.recentDays,
      p_batch_limit: options.batchLimit,
    }
  )

  if (refreshComplexes.error) {
    const finishedAt = new Date()
    const durationMs = finishedAt.getTime() - startedAt.getTime()
    const rawMessage = refreshComplexes.error.message || 'complex mapping failed'
    const missingRecentRpc =
      /refresh_complexes_from_transactions_recent/i.test(rawMessage) &&
      /(not exist|does not exist|Could not find the function)/i.test(rawMessage)
    const finalMessage = missingRecentRpc
      ? 'TODO: Supabase에 refresh_complexes_from_transactions_recent(p_days, p_batch_limit) RPC를 추가해야 합니다.'
      : rawMessage

    logStageEvent('finish', {
      stage: 'map',
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      ok: false,
      errorMessage: finalMessage,
    })

    return {
      key: 'refresh_complexes_from_transactions_recent',
      ok: false,
      message: finalMessage,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
    }
  }

  const finishedAt = new Date()
  const durationMs = finishedAt.getTime() - startedAt.getTime()
  logStageEvent('finish', {
    stage: 'map',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    ok: true,
    errorMessage: null,
  })

  return {
    key: 'refresh_complexes_from_transactions_recent',
    ok: true,
    message: `최근 ${options.recentDays}일 complex_id 매핑 완료 (batchLimit=${options.batchLimit})`,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
  }
}

async function runListingStep(): Promise<PostprocessStepResult> {
  const startedAt = new Date()
  logStageEvent('start', {
    stage: 'listing',
    startedAt: startedAt.toISOString(),
  })

  const refreshListing = await supabaseAdmin.rpc('refresh_complex_listing_mv')
  if (refreshListing.error) {
    const finishedAt = new Date()
    const durationMs = finishedAt.getTime() - startedAt.getTime()
    const message = refreshListing.error.message || 'listing refresh failed'

    logStageEvent('finish', {
      stage: 'listing',
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      ok: false,
      errorMessage: message,
    })

    return {
      key: 'refresh_complex_listing_mv',
      ok: false,
      message,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
    }
  }

  const finishedAt = new Date()
  const durationMs = finishedAt.getTime() - startedAt.getTime()
  logStageEvent('finish', {
    stage: 'listing',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    ok: true,
    errorMessage: null,
  })

  return {
    key: 'refresh_complex_listing_mv',
    ok: true,
    message: '메인 리스트 MV 새로고침 완료',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
  }
}

async function runSummaryStep(): Promise<PostprocessStepResult> {
  const startedAt = new Date()
  logStageEvent('start', {
    stage: 'summary',
    startedAt: startedAt.toISOString(),
  })

  const refreshHome = await supabaseAdmin.rpc('refresh_home_summary_mvs')
  if (refreshHome.error) {
    const finishedAt = new Date()
    const durationMs = finishedAt.getTime() - startedAt.getTime()
    const message = refreshHome.error.message || 'home summary refresh failed'

    logStageEvent('finish', {
      stage: 'summary',
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      ok: false,
      errorMessage: message,
    })

    return {
      key: 'refresh_home_summary_mvs',
      ok: false,
      message,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
    }
  }

  const finishedAt = new Date()
  const durationMs = finishedAt.getTime() - startedAt.getTime()
  logStageEvent('finish', {
    stage: 'summary',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    ok: true,
    errorMessage: null,
  })

  return {
    key: 'refresh_home_summary_mvs',
    ok: true,
    message: '홈 요약 MV 새로고침 완료',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
  }
}

async function runPostprocessStep(
  mode: Exclude<Mode, 'collect' | 'all' | 'postprocess'>,
  options: PostprocessOptions
) {
  if (mode === 'map') return runMapStep(options)
  if (mode === 'listing') return runListingStep()
  return runSummaryStep()
}

async function runPostprocess(
  options: PostprocessOptions,
  modes?: Array<'map' | 'listing' | 'summary'>
) {
  const steps: PostprocessStepResult[] = []
  const targetModes = modes || ['map', 'listing', 'summary']

  for (const mode of targetModes) {
    const step = await runPostprocessStep(mode, options)
    steps.push(step)
    if (!step.ok) {
      return { ok: false, steps }
    }
  }

  if (targetModes.includes('listing') || targetModes.includes('summary')) {
    revalidatePath('/')
    revalidatePath('/publish')
  }
  revalidatePath('/admin/ops')

  return { ok: true, steps }
}

export async function POST(req: NextRequest) {
  try {
    const adminSecret = req.headers.get('x-admin-secret')
    if (!adminSecret || adminSecret !== process.env.ADMIN_BACKFILL_SECRET) {
      return unauthorized()
    }

    const body = (await req.json().catch(() => ({}))) as RunBody
    const { mode, targetGroup, invalidGroup, options } = parseBody(body)

    if (!isValidMode(mode)) {
      return NextResponse.json(
        {
          ok: false,
          mode,
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

    const startedAt = new Date()
    let collect: CollectResult | undefined
    let postprocess: Awaited<ReturnType<typeof runPostprocess>> | undefined

    if (mode === 'collect' || mode === 'all') {
      collect = await runCollect(targetGroup)
      if (!collect.ok && mode === 'collect') {
        return NextResponse.json(
          {
            ok: false,
            mode,
            startedAt: startedAt.toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt.getTime(),
            collect,
            options,
            targetGroup: targetGroup || null,
            error: '자료수집 중 일부 오류가 발생했습니다.',
          },
          { status: 500 }
        )
      }
    }

    if (mode === 'map') {
      postprocess = await runPostprocess(options, ['map'])
    } else if (mode === 'listing') {
      postprocess = await runPostprocess(options, ['listing'])
    } else if (mode === 'summary') {
      postprocess = await runPostprocess(options, ['summary'])
    } else if (mode === 'postprocess' || mode === 'all') {
      postprocess = await runPostprocess(options)
    }

    if (postprocess && !postprocess.ok) {
      return NextResponse.json(
        {
          ok: false,
          mode,
          startedAt: startedAt.toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt.getTime(),
          collect,
          postprocess,
          options,
          targetGroup: targetGroup || null,
          error: '후처리 단계에서 오류가 발생했습니다.',
        },
        { status: 500 }
      )
    }

    const finishedAt = new Date()

    return NextResponse.json({
      ok: true,
      mode,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      collect,
      postprocess,
      options,
      targetGroup: targetGroup || null,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error, 'server error'),
      },
      { status: 500 }
    )
  }
}
