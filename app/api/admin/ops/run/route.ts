import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { backfillSingleMonth } from '@/lib/molit/backfill'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const maxDuration = 300

type Mode = 'collect' | 'postprocess' | 'all'

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

function getAllGroups() {
  const groups: Array<{ group: string; envKey: string; lawdCodes: string[] }> = []

  for (const group of ['1', '2', '3', '4']) {
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
    throw new Error('RTMS_LAWD_CODES_GROUP_1~4 환경변수가 비어 있습니다.')
  }

  return groups
}

async function runCollect() {
  if (!process.env.MOLIT_API_KEY) {
    throw new Error('MOLIT_API_KEY is missing')
  }

  const months = getTargetMonths()
  const groups = getAllGroups()
  const summaries: Array<{
    group: string
    lawdCodeCount: number
    resultCount: number
    errorCount: number
  }> = []

  for (const group of groups) {
    let resultCount = 0
    let errorCount = 0

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
  }

  const ok = summaries.every((item) => item.errorCount === 0)
  return {
    ok,
    months,
    groups: summaries,
  }
}

async function runPostprocess() {
  const steps: Array<{ key: string; ok: boolean; message: string }> = []

  const refreshComplexes = await supabaseAdmin.rpc('refresh_complexes_from_transactions')
  if (refreshComplexes.error) {
    steps.push({
      key: 'refresh_complexes_from_transactions',
      ok: false,
      message: refreshComplexes.error.message || 'complex mapping failed',
    })
    return { ok: false, steps }
  }

  steps.push({
    key: 'refresh_complexes_from_transactions',
    ok: true,
    message: 'complex_id 매핑 완료',
  })

  const refreshListing = await supabaseAdmin.rpc('refresh_complex_listing_mv')
  if (refreshListing.error) {
    steps.push({
      key: 'refresh_complex_listing_mv',
      ok: false,
      message: refreshListing.error.message || 'listing refresh failed',
    })
    return { ok: false, steps }
  }

  steps.push({
    key: 'refresh_complex_listing_mv',
    ok: true,
    message: '메인 리스트 MV 새로고침 완료',
  })

  const refreshHome = await supabaseAdmin.rpc('refresh_home_summary_mvs')
  if (refreshHome.error) {
    steps.push({
      key: 'refresh_home_summary_mvs',
      ok: false,
      message: refreshHome.error.message || 'home summary refresh failed',
    })
    return { ok: false, steps }
  }

  steps.push({
    key: 'refresh_home_summary_mvs',
    ok: true,
    message: '홈 요약 MV 새로고침 완료',
  })

  revalidatePath('/')
  revalidatePath('/publish')
  revalidatePath('/admin/ops')

  return { ok: true, steps }
}

export async function POST(req: NextRequest) {
  try {
    const adminSecret = req.headers.get('x-admin-secret')
    if (!adminSecret || adminSecret !== process.env.ADMIN_BACKFILL_SECRET) {
      return unauthorized()
    }

    const body = await req.json().catch(() => ({}))
    const mode = String(body?.mode || 'postprocess') as Mode
    if (!['collect', 'postprocess', 'all'].includes(mode)) {
      return NextResponse.json({ ok: false, error: 'invalid mode' }, { status: 400 })
    }

    const startedAt = new Date()
    let collect: Awaited<ReturnType<typeof runCollect>> | undefined
    let postprocess: Awaited<ReturnType<typeof runPostprocess>> | undefined

    if (mode === 'collect' || mode === 'all') {
      collect = await runCollect()
      if (!collect.ok && mode === 'collect') {
        return NextResponse.json(
          {
            ok: false,
            mode,
            startedAt: startedAt.toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt.getTime(),
            collect,
            error: '자료수집 중 일부 오류가 발생했습니다.',
          },
          { status: 500 }
        )
      }
    }

    if (mode === 'postprocess' || mode === 'all') {
      postprocess = await runPostprocess()
      if (!postprocess.ok) {
        return NextResponse.json(
          {
            ok: false,
            mode,
            startedAt: startedAt.toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt.getTime(),
            collect,
            postprocess,
            error: '후처리 단계에서 오류가 발생했습니다.',
          },
          { status: 500 }
        )
      }
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
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'server error',
      },
      { status: 500 }
    )
  }
}
