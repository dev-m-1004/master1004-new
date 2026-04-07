'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type OpsStatus = {
  ok: boolean
  checkedAt: string
  latestDealDate: string | null
  todayTransactionCount: number
  totalUnmatchedCount: number
  latestDealUnmatchedCount: number
  complexListingCount: number
  complexListingLatestDealDate: string | null
  homeSummaryLatestDealDate: string | null
  homeSummaryRegionCount: number
  health: {
    collect: 'healthy' | 'warning' | 'danger'
    mapping: 'healthy' | 'warning' | 'danger'
    listing: 'healthy' | 'warning' | 'danger'
    summary: 'healthy' | 'warning' | 'danger'
  }
}

type ActionResult = {
  ok: boolean
  mode: 'collect' | 'postprocess' | 'all'
  startedAt: string
  finishedAt: string
  durationMs: number
  collect?: {
    ok: boolean
    months: string[]
    groups: Array<{
      group: string
      lawdCodeCount: number
      resultCount: number
      errorCount: number
    }>
  }
  postprocess?: {
    ok: boolean
    steps: Array<{
      key: string
      ok: boolean
      message: string
    }>
  }
  error?: string
}

type LogItem = {
  id: string
  level: 'info' | 'success' | 'error'
  title: string
  body?: string
  time: string
}

const SECRET_KEY = 'master1004-admin-secret'

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(value))
  } catch {
    return value
  }
}

function formatDuration(ms?: number) {
  const value = Number(ms || 0)
  if (!value) return '0초'
  if (value < 1000) return `${value}ms`
  const seconds = Math.round(value / 100) / 10
  if (seconds < 60) return `${seconds}초`
  const minutes = Math.floor(seconds / 60)
  const remain = Math.round((seconds % 60) * 10) / 10
  return `${minutes}분 ${remain}초`
}

function toneByHealth(value: 'healthy' | 'warning' | 'danger') {
  if (value === 'healthy') return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (value === 'warning') return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-rose-50 text-rose-700 ring-rose-200'
}

function labelByHealth(value: 'healthy' | 'warning' | 'danger') {
  if (value === 'healthy') return '정상'
  if (value === 'warning') return '확인 필요'
  return '장애'
}

function toneByLog(level: LogItem['level']) {
  if (level === 'success') return 'border-emerald-200 bg-emerald-50/70'
  if (level === 'error') return 'border-rose-200 bg-rose-50/70'
  return 'border-slate-200 bg-white'
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(text || '응답을 해석하지 못했습니다.')
  }
}

export default function AdminOpsClient() {
  const [secret, setSecret] = useState('')
  const [status, setStatus] = useState<OpsStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [runningMode, setRunningMode] = useState<ActionResult['mode'] | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [result, setResult] = useState<ActionResult | null>(null)
  const [logs, setLogs] = useState<LogItem[]>([])

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem(SECRET_KEY) : null
    if (saved) setSecret(saved)
  }, [])

  const pushLog = useCallback((level: LogItem['level'], title: string, body?: string) => {
    const item: LogItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      level,
      title,
      body,
      time: new Date().toISOString(),
    }
    setLogs((prev) => [item, ...prev].slice(0, 30))
  }, [])

  const saveSecret = useCallback(() => {
    sessionStorage.setItem(SECRET_KEY, secret)
    pushLog('success', '관리자 키를 저장했습니다.', '이 브라우저 탭에서만 유지됩니다.')
  }, [pushLog, secret])

  const loadStatus = useCallback(async () => {
    if (!secret.trim()) {
      pushLog('error', '관리자 키가 필요합니다.', '먼저 관리자 키를 입력하고 저장해 주세요.')
      return
    }

    setLoadingStatus(true)
    try {
      const res = await fetch('/api/admin/ops/status', {
        method: 'GET',
        headers: {
          'x-admin-secret': secret.trim(),
        },
        cache: 'no-store',
      })

      const json = await readJson<OpsStatus & { message?: string }>(res)
      if (!res.ok || !json.ok) {
        throw new Error((json as any).message || '상태 조회에 실패했습니다.')
      }

      setStatus(json)
      pushLog('success', '상태를 새로고침했습니다.', `최근 거래일: ${json.latestDealDate ?? '-'}`)
    } catch (error: any) {
      pushLog('error', '상태 조회 실패', error?.message || '알 수 없는 오류')
    } finally {
      setLoadingStatus(false)
    }
  }, [pushLog, secret])

  useEffect(() => {
    if (!secret.trim() || !autoRefresh) return
    loadStatus()
    const timer = window.setInterval(loadStatus, 60000)
    return () => window.clearInterval(timer)
  }, [autoRefresh, loadStatus, secret])

  const runAction = useCallback(
    async (mode: ActionResult['mode']) => {
      if (!secret.trim()) {
        pushLog('error', '관리자 키가 필요합니다.', '먼저 관리자 키를 입력하고 저장해 주세요.')
        return
      }

      setRunningMode(mode)
      try {
        const res = await fetch('/api/admin/ops/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-secret': secret.trim(),
          },
          body: JSON.stringify({ mode }),
        })

        const json = await readJson<ActionResult & { message?: string }>(res)
        if (!res.ok || !json.ok) {
          throw new Error((json as any).error || (json as any).message || '실행에 실패했습니다.')
        }

        setResult(json)
        pushLog('success', `${modeLabelMap[mode]} 완료`, `소요 시간: ${formatDuration(json.durationMs)}`)
        await loadStatus()
      } catch (error: any) {
        pushLog('error', `${modeLabelMap[mode]} 실패`, error?.message || '알 수 없는 오류')
      } finally {
        setRunningMode(null)
      }
    },
    [loadStatus, pushLog, secret]
  )

  const statusCards = useMemo(() => {
    if (!status) return []
    return [
      {
        title: '최근 거래일',
        value: status.latestDealDate ?? '-',
        hint: 'transactions 기준',
      },
      {
        title: '오늘 수집 건수',
        value: `${status.todayTransactionCount.toLocaleString()}건`,
        hint: '오늘 거래 적재 수',
      },
      {
        title: '미연결 거래',
        value: `${status.totalUnmatchedCount.toLocaleString()}건`,
        hint: 'complex_id is null',
      },
      {
        title: '메인 최신 거래일',
        value: status.complexListingLatestDealDate ?? '-',
        hint: 'complex_listing_mv 기준',
      },
    ]
  }, [status])

  const operationSummary = useMemo(() => {
    if (!result) return []
    const rows: Array<{ label: string; value: string }> = [
      { label: '실행 모드', value: modeLabelMap[result.mode] },
      { label: '시작 시각', value: formatDateTime(result.startedAt) },
      { label: '종료 시각', value: formatDateTime(result.finishedAt) },
      { label: '총 소요 시간', value: formatDuration(result.durationMs) },
    ]

    if (result.collect) {
      rows.push({ label: '수집 대상 월', value: result.collect.months.join(', ') })
      rows.push({
        label: '수집 그룹 결과',
        value: result.collect.groups
          .map((group) => `G${group.group}: ${group.resultCount}건 / 오류 ${group.errorCount}`)
          .join(' · '),
      })
    }

    if (result.postprocess) {
      rows.push({
        label: '후처리 단계',
        value: result.postprocess.steps
          .map((step) => `${step.key}:${step.ok ? '완료' : '실패'}`)
          .join(' · '),
      })
    }

    return rows
  }, [result])

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
            <div>
              <div className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-slate-100 ring-1 ring-white/15">
                MASTER1004 운영실
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                자료수집 · 후처리 · 상태확인을 한 화면에서 관리하세요
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
                매일 운영자는 세 가지만 보면 됩니다. 오늘 데이터가 들어왔는지, 미연결 거래가 0인지,
                메인 최신 거래일이 밀리지 않았는지. 이상이 있으면 후처리 한 번으로 대부분 복구됩니다.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-200">
                <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">수집 전용</span>
                <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">후처리 분리</span>
                <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">1분 자동 새로고침</span>
              </div>
            </div>

            <div className="rounded-[24px] bg-white/10 p-4 backdrop-blur">
              <label className="text-sm font-medium text-white">관리자 키</label>
              <div className="mt-2 flex gap-2">
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="x-admin-secret 값을 입력하세요"
                  className="flex-1 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-300 outline-none ring-0 transition focus:border-white/35"
                />
                <button
                  onClick={saveSecret}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
                >
                  저장
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-sm text-slate-100 ring-1 ring-white/15">
                <span>상태 자동 새로고침</span>
                <button
                  type="button"
                  onClick={() => setAutoRefresh((prev) => !prev)}
                  className={cn(
                    'relative h-7 w-12 rounded-full transition',
                    autoRefresh ? 'bg-emerald-400' : 'bg-slate-500'
                  )}
                  aria-pressed={autoRefresh}
                >
                  <span
                    className={cn(
                      'absolute top-1 h-5 w-5 rounded-full bg-white transition',
                      autoRefresh ? 'left-6' : 'left-1'
                    )}
                  />
                </button>
              </div>
              <button
                onClick={loadStatus}
                disabled={loadingStatus}
                className="mt-3 w-full rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-300"
              >
                {loadingStatus ? '상태 확인 중...' : '지금 상태 확인'}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statusCards.map((card) => (
            <div key={card.title} className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm font-medium text-slate-500">{card.title}</div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{card.value}</div>
              <div className="mt-1 text-xs text-slate-500">{card.hint}</div>
            </div>
          ))}
          {!status &&
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                <div className="mt-4 h-8 w-28 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-3 w-20 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">운영 실행 패널</h2>
                <p className="mt-1 text-sm text-slate-500">
                  자료수집, 후처리, 전체실행 중 필요한 작업을 버튼 한 번으로 처리합니다.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <ActionCard
                title="자료수집 실행"
                description="등록된 group 1~4를 순서대로 돌려 오늘과 전월 데이터를 가져옵니다."
                buttonLabel={runningMode === 'collect' ? '수집 실행 중...' : '자료수집'}
                buttonTone="slate"
                onClick={() => runAction('collect')}
                disabled={!!runningMode}
              />
              <ActionCard
                title="후처리 실행"
                description="complex_id 매핑, 메인 리스트 MV, 홈 요약 MV를 순서대로 새로고침합니다."
                buttonLabel={runningMode === 'postprocess' ? '후처리 실행 중...' : '후처리'}
                buttonTone="emerald"
                onClick={() => runAction('postprocess')}
                disabled={!!runningMode}
              />
              <ActionCard
                title="전체 실행"
                description="자료수집부터 후처리까지 한 번에 실행합니다. 야간 배치 점검용으로 적합합니다."
                buttonLabel={runningMode === 'all' ? '전체 실행 중...' : '전체 실행'}
                buttonTone="sky"
                onClick={() => runAction('all')}
                disabled={!!runningMode}
              />
            </div>

            <div className="mt-5 rounded-[24px] bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">실행 결과 요약</h3>
                {result ? (
                  <span className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium ring-1',
                    result.ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'
                  )}>
                    {result.ok ? '완료' : '실패'}
                  </span>
                ) : null}
              </div>
              {operationSummary.length > 0 ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {operationSummary.map((row) => (
                    <div key={row.label} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
                      <div className="text-xs font-medium text-slate-500">{row.label}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{row.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                  아직 실행 기록이 없습니다. 먼저 상태를 확인하고 필요한 버튼을 눌러 보세요.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">운영 건강 상태</h2>
              <div className="mt-4 grid gap-3">
                <HealthRow label="수집 상태" value={status?.health.collect ?? 'warning'} detail={`최근 거래일: ${status?.latestDealDate ?? '-'}`} />
                <HealthRow label="매핑 상태" value={status?.health.mapping ?? 'warning'} detail={`미연결 거래: ${status?.totalUnmatchedCount ?? '-'}건`} />
                <HealthRow label="메인 리스트" value={status?.health.listing ?? 'warning'} detail={`메인 최신 거래일: ${status?.complexListingLatestDealDate ?? '-'}`} />
                <HealthRow label="홈 요약" value={status?.health.summary ?? 'warning'} detail={`요약 최신 거래일: ${status?.homeSummaryLatestDealDate ?? '-'}`} />
              </div>
            </div>

            <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">운영 콘솔</h2>
              <div className="mt-4 space-y-3">
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <div key={log.id} className={cn('rounded-2xl border px-4 py-3', toneByLog(log.level))}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{log.title}</div>
                          {log.body ? <div className="mt-1 text-sm text-slate-600">{log.body}</div> : null}
                        </div>
                        <div className="shrink-0 text-xs text-slate-400">{formatDateTime(log.time)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                    아직 로그가 없습니다. 상태 확인 또는 실행 버튼을 눌러 보세요.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">운영 가이드</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <GuideCard
              title="평소 운영"
              items={['상태 확인을 눌러 최근 거래일을 봅니다.', '미연결 거래가 0이면 정상입니다.', '메인 최신 거래일이 최근 거래일과 같으면 정상입니다.']}
            />
            <GuideCard
              title="이상 징후"
              items={['publish만 최신이면 후처리를 실행합니다.', '상세 링크가 안 보이면 후처리를 먼저 실행합니다.', '메인 리스트가 비면 후처리를 먼저 실행합니다.']}
            />
            <GuideCard
              title="권장 순서"
              items={['아침 자동 수집 후 후처리를 분리 실행합니다.', '문제 시에는 전체 실행보다 후처리를 먼저 시도합니다.', '야간 장애 복구는 전체 실행 1회 후 상태를 다시 확인합니다.']}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

const modeLabelMap: Record<ActionResult['mode'], string> = {
  collect: '자료수집',
  postprocess: '후처리',
  all: '전체 실행',
}

function ActionCard({
  title,
  description,
  buttonLabel,
  buttonTone,
  onClick,
  disabled,
}: {
  title: string
  description: string
  buttonLabel: string
  buttonTone: 'slate' | 'emerald' | 'sky'
  onClick: () => void
  disabled?: boolean
}) {
  const buttonClass =
    buttonTone === 'emerald'
      ? 'bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300'
      : buttonTone === 'sky'
        ? 'bg-sky-500 hover:bg-sky-400 disabled:bg-sky-300'
        : 'bg-slate-900 hover:bg-slate-700 disabled:bg-slate-400'

  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <div className="text-base font-semibold text-slate-900">{title}</div>
      <div className="mt-2 min-h-[66px] text-sm leading-6 text-slate-600">{description}</div>
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed',
          buttonClass
        )}
      >
        {buttonLabel}
      </button>
    </div>
  )
}

function HealthRow({
  label,
  value,
  detail,
}: {
  label: string
  value: 'healthy' | 'warning' | 'danger'
  detail: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="mt-1 text-xs text-slate-500">{detail}</div>
      </div>
      <span className={cn('rounded-full px-3 py-1 text-xs font-medium ring-1', toneByHealth(value))}>
        {labelByHealth(value)}
      </span>
    </div>
  )
}

function GuideCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[24px] bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="text-base font-semibold text-slate-900">{title}</div>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
