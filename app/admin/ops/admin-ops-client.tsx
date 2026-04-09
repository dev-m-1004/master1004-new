'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

type HealthTone = 'healthy' | 'warning' | 'danger'
type ActionMode = 'collect' | 'map' | 'listing' | 'summary' | 'postprocess' | 'all'
type CollectGroup = '1' | '2' | '3' | '4'

type StepResult = {
  key: string
  ok: boolean
  message: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
}

type JobItem = {
  id: string
  jobType: ActionMode
  status: 'queued' | 'running' | 'completed' | 'failed'
  currentStage: string | null
  targetGroup?: CollectGroup | null
  recentDays: number
  batchLimit: number
  createdAt?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  errorMessage?: string | null
  stepResults: StepResult[]
}

type OpsStatus = {
  ok: boolean
  checkedAt: string
  latestDealDate: string | null
  todayTransactionCount: number
  latestDealUnmatchedCount: number
  complexListingLatestDealDate: string | null
  homeSummaryLatestDealDate: string | null
  latestSuccessAt: string | null
  latestFailureMessage: string | null
  recentJobs: JobItem[]
  health: {
    collect: HealthTone
    mapping: HealthTone
    listing: HealthTone
    summary: HealthTone
  }
}

type RunJobResponse = {
  ok: boolean
  mode: ActionMode
  jobId: string
  status: 'queued'
  targetGroup?: CollectGroup | null
  options: {
    recentDays: number
    batchLimit: number
  }
  queuedAt?: string | null
  message?: string
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
const COLLECT_GROUP_OPTIONS: Array<{ label: string; value: '' | CollectGroup }> = [
  { label: '전체 그룹', value: '' },
  { label: 'GROUP 1', value: '1' },
  { label: 'GROUP 2', value: '2' },
  { label: 'GROUP 3', value: '3' },
  { label: 'GROUP 4', value: '4' },
]

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

function toneByHealth(value: HealthTone) {
  if (value === 'healthy') return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (value === 'warning') return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-rose-50 text-rose-700 ring-rose-200'
}

function labelByHealth(value: HealthTone) {
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

const modeLabelMap: Record<ActionMode, string> = {
  collect: 'GROUP 수집 시작',
  map: '매핑만 시작',
  listing: '리스트만 시작',
  summary: '홈 요약만 시작',
  postprocess: '후처리 시작',
  all: '전체 파이프라인 시작',
}

export default function AdminOpsClient() {
  const [secret, setSecret] = useState('')
  const [status, setStatus] = useState<OpsStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [startingMode, setStartingMode] = useState<ActionMode | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [collectGroup, setCollectGroup] = useState<'' | CollectGroup>('')
  const [recentDays, setRecentDays] = useState('3')
  const [batchLimit, setBatchLimit] = useState('5000')

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
    setLogs((prev) => [item, ...prev].slice(0, 40))
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
        throw new Error(json.message || '상태 조회에 실패했습니다.')
      }

      setStatus(json)
      pushLog('success', '상태를 새로고침했습니다.', `최근 작업 수: ${json.recentJobs.length}개`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류'
      pushLog('error', '상태 조회 실패', message)
    } finally {
      setLoadingStatus(false)
    }
  }, [pushLog, secret])

  useEffect(() => {
    if (!secret.trim() || !autoRefresh) return
    loadStatus()
    const timer = window.setInterval(loadStatus, 20000)
    return () => window.clearInterval(timer)
  }, [autoRefresh, loadStatus, secret])

  const startJob = useCallback(
    async (mode: ActionMode) => {
      if (!secret.trim()) {
        pushLog('error', '관리자 키가 필요합니다.', '먼저 관리자 키를 입력하고 저장해 주세요.')
        return
      }

      const recentDaysValue = Math.max(1, Number(recentDays) || 3)
      const batchLimitValue = Math.max(1, Number(batchLimit) || 5000)

      setStartingMode(mode)
      try {
        const res = await fetch('/api/admin/ops/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-secret': secret.trim(),
          },
          body: JSON.stringify({
            mode,
            group: collectGroup || undefined,
            recentDays: recentDaysValue,
            batchLimit: batchLimitValue,
          }),
        })

        const json = await readJson<RunJobResponse & { message?: string }>(res)
        if (!res.ok || !json.ok) {
          throw new Error(json.error || json.message || '작업 시작에 실패했습니다.')
        }

        pushLog(
          'success',
          `${modeLabelMap[mode]} 완료`,
          `job_id=${json.jobId}, status=${json.status}`
        )
        await loadStatus()
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '알 수 없는 오류'
        pushLog('error', `${modeLabelMap[mode]} 실패`, message)
      } finally {
        setStartingMode(null)
      }
    },
    [batchLimit, collectGroup, loadStatus, pushLog, recentDays, secret]
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
        title: '최신 미연결 거래',
        value: `${status.latestDealUnmatchedCount.toLocaleString()}건`,
        hint: 'latest deal_date + complex_id is null',
      },
      {
        title: '메인 최신 거래일',
        value: status.complexListingLatestDealDate ?? '-',
        hint: 'complex_listing_mv 기준',
      },
      {
        title: '홈 요약 최신 거래일',
        value: status.homeSummaryLatestDealDate ?? '-',
        hint: 'home_tx_week_complex_mv 기준',
      },
    ]
  }, [status])

  const activeJobs = status?.recentJobs.filter((job) => job.status === 'queued' || job.status === 'running') || []
  const canStart = !!secret.trim() && !startingMode

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
                Admin Ops를 비동기 잡 기반 운영툴로 전환했습니다
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
                이제 브라우저는 긴 후처리를 기다리지 않습니다. 운영자는 작업 시작과 상태 확인만 담당하고,
                실제 collect / map / listing / summary는 worker가 순차 처리합니다.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-200">
                <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">비동기 job queue</span>
                <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">worker stage processing</span>
                <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">HTTP timeout 분리</span>
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

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <FieldBox label="자료수집 그룹">
                  <select
                    value={collectGroup}
                    onChange={(e) => setCollectGroup(e.target.value as '' | CollectGroup)}
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none"
                  >
                    {COLLECT_GROUP_OPTIONS.map((option) => (
                      <option key={option.label} value={option.value} className="text-slate-900">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FieldBox>
                <FieldBox label="recentDays">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={recentDays}
                    onChange={(e) => setRecentDays(e.target.value)}
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none"
                  />
                </FieldBox>
                <FieldBox label="batchLimit">
                  <input
                    type="number"
                    min={1}
                    step={100}
                    value={batchLimit}
                    onChange={(e) => setBatchLimit(e.target.value)}
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none"
                  />
                </FieldBox>
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
                {loadingStatus ? '상태 확인 중...' : '상태 새로고침'}
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
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">작업 시작 패널</h2>
                <p className="mt-1 text-sm text-slate-500">
                  운영자는 이제 긴 작업 완료를 기다리지 않습니다. 버튼을 누르면 job이 큐에 들어가고 worker가 처리합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                {showAdvanced ? '고급 작업 숨기기' : '고급 작업 보기'}
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <ActionCard
                title={collectGroup ? `GROUP ${collectGroup} 수집 시작` : '전체 그룹 수집 시작'}
                description="자료수집 job만 큐에 넣습니다. timeout이 걱정되면 GROUP 1부터 차례대로 실행하세요."
                buttonTone="slate"
                buttonLabel={startingMode === 'collect' ? 'job 생성 중...' : 'GROUP 수집 시작'}
                onClick={() => startJob('collect')}
                disabled={!canStart}
              />
              <ActionCard
                title="전체 파이프라인 시작"
                description="collect -> map -> listing -> summary를 worker가 단계별로 처리합니다. 운영 기본 경로는 이 버튼입니다."
                buttonTone="sky"
                buttonLabel={startingMode === 'all' ? 'job 생성 중...' : '전체 파이프라인 시작'}
                onClick={() => startJob('all')}
                disabled={!canStart}
              />
            </div>

            {showAdvanced ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ActionCard
                  title="매핑만 시작"
                  description="최근 거래의 complex_id 매핑 job을 큐에 넣습니다."
                  buttonTone="violet"
                  buttonLabel={startingMode === 'map' ? 'job 생성 중...' : '매핑'}
                  onClick={() => startJob('map')}
                  disabled={!canStart}
                />
                <ActionCard
                  title="리스트만 시작"
                  description="complex_listing_mv refresh job을 큐에 넣습니다."
                  buttonTone="emerald"
                  buttonLabel={startingMode === 'listing' ? 'job 생성 중...' : '리스트'}
                  onClick={() => startJob('listing')}
                  disabled={!canStart}
                />
                <ActionCard
                  title="홈 요약만 시작"
                  description="home summary refresh job을 큐에 넣습니다."
                  buttonTone="amber"
                  buttonLabel={startingMode === 'summary' ? 'job 생성 중...' : '홈 요약'}
                  onClick={() => startJob('summary')}
                  disabled={!canStart}
                />
                <ActionCard
                  title="후처리만 시작"
                  description="map -> listing -> summary 잡 체인을 큐에 넣습니다."
                  buttonTone="rose"
                  buttonLabel={startingMode === 'postprocess' ? 'job 생성 중...' : '후처리'}
                  onClick={() => startJob('postprocess')}
                  disabled={!canStart}
                />
              </div>
            ) : null}

            <div className="mt-5 rounded-[24px] bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">최근 상태</h3>
                <div className="text-xs text-slate-500">
                  최근 성공: {formatDateTime(status?.latestSuccessAt)}
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <HealthRow
                  label="수집 상태"
                  value={status?.health.collect ?? 'warning'}
                  detail={`최근 거래일: ${status?.latestDealDate ?? '-'}`}
                />
                <HealthRow
                  label="매핑 상태"
                  value={status?.health.mapping ?? 'warning'}
                  detail={`최신 미연결 거래: ${status?.latestDealUnmatchedCount ?? 0}건`}
                />
                <HealthRow
                  label="메인 리스트"
                  value={status?.health.listing ?? 'warning'}
                  detail={`메인 최신 거래일: ${status?.complexListingLatestDealDate ?? '-'}`}
                />
                <HealthRow
                  label="홈 요약"
                  value={status?.health.summary ?? 'warning'}
                  detail={`홈 최신 거래일: ${status?.homeSummaryLatestDealDate ?? '-'}`}
                />
              </div>
              {status?.latestFailureMessage ? (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  최근 실패 메시지: {status.latestFailureMessage}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">대기/실행 중 작업</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {activeJobs.length}개
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {activeJobs.length > 0 ? (
                  activeJobs.map((job) => (
                    <JobCard key={job.id} job={job} emphasize />
                  ))
                ) : (
                  <EmptyBox text="현재 대기 중이거나 실행 중인 작업이 없습니다." />
                )}
              </div>
            </div>

            <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">최근 작업 이력</h2>
              <div className="mt-4 space-y-3">
                {status?.recentJobs?.length ? (
                  status.recentJobs.map((job) => <JobCard key={job.id} job={job} />)
                ) : (
                  <EmptyBox text="아직 작업 이력이 없습니다." />
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
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
              <EmptyBox text="아직 로그가 없습니다. 작업 시작 또는 상태 새로고침을 눌러 보세요." />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function FieldBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">{label}</div>
      {children}
    </label>
  )
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
  buttonTone: 'slate' | 'violet' | 'emerald' | 'amber' | 'sky' | 'rose'
  onClick: () => void
  disabled?: boolean
}) {
  const buttonClass =
    buttonTone === 'violet'
      ? 'bg-violet-500 hover:bg-violet-400 disabled:bg-violet-300'
      : buttonTone === 'emerald'
        ? 'bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300'
        : buttonTone === 'amber'
          ? 'bg-amber-500 hover:bg-amber-400 disabled:bg-amber-300'
          : buttonTone === 'sky'
            ? 'bg-sky-500 hover:bg-sky-400 disabled:bg-sky-300'
            : buttonTone === 'rose'
              ? 'bg-rose-500 hover:bg-rose-400 disabled:bg-rose-300'
              : 'bg-slate-900 hover:bg-slate-700 disabled:bg-slate-400'

  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 min-h-[72px] text-sm leading-6 text-slate-600">{description}</p>
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'mt-6 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed',
          buttonClass
        )}
      >
        {buttonLabel}
      </button>
    </div>
  )
}

function HealthRow({ label, value, detail }: { label: string; value: HealthTone; detail: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="mt-1 text-xs text-slate-500">{detail}</div>
      </div>
      <span className={cn('rounded-full px-3 py-1 text-xs font-semibold ring-1', toneByHealth(value))}>
        {labelByHealth(value)}
      </span>
    </div>
  )
}

function JobCard({ job, emphasize = false }: { job: JobItem; emphasize?: boolean }) {
  const statusTone =
    job.status === 'completed'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : job.status === 'failed'
        ? 'bg-rose-50 text-rose-700 ring-rose-200'
        : job.status === 'running'
          ? 'bg-sky-50 text-sky-700 ring-sky-200'
          : 'bg-amber-50 text-amber-700 ring-amber-200'

  return (
    <div className={cn('rounded-[24px] border px-4 py-4', emphasize ? 'border-sky-200 bg-sky-50/40' : 'border-slate-200 bg-slate-50')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {job.jobType} · {job.id.slice(0, 8)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {job.targetGroup ? `GROUP ${job.targetGroup}` : '전체 그룹'} · recentDays={job.recentDays} · batchLimit={job.batchLimit}
          </div>
        </div>
        <span className={cn('rounded-full px-3 py-1 text-xs font-semibold ring-1', statusTone)}>
          {job.status}
        </span>
      </div>
      <div className="mt-3 text-sm text-slate-600">
        현재 단계: {job.currentStage || '-'} · 시작: {formatDateTime(job.startedAt)} · 종료: {formatDateTime(job.finishedAt)}
      </div>
      {job.errorMessage ? (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {job.errorMessage}
        </div>
      ) : null}
      {job.stepResults.length > 0 ? (
        <div className="mt-3 space-y-2">
          {job.stepResults.map((step) => (
            <div key={`${job.id}-${step.key}-${step.startedAt || ''}`} className="rounded-2xl bg-white px-3 py-2 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="font-semibold text-slate-900">{step.key}</div>
                <div className="text-slate-500">{formatDuration(step.durationMs)}</div>
              </div>
              <div className="mt-1 text-sm text-slate-600">{step.message}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
      {text}
    </div>
  )
}
