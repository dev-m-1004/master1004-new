'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import PriceChart from './price-chart'
import NaverMap from '@/components/NaverMap'

type Complex = {
  id?: string | number
  official_name?: string | null
  road_name?: string | null
  road_bonbun?: string | null
  road_bubun?: string | null
  umd_name?: string | null
  build_year?: number | null
  sido_name?: string | null
  sigungu_name?: string | null
}

type Transaction = {
  id?: string | number
  complex_id?: string | null
  apartment_name?: string | null
  price_krw?: number | null
  area_m2?: number | null
  floor?: number | null
  deal_year?: number | null
  deal_month?: number | null
  deal_day?: number | null
  lawd_code?: string | null
  dong?: string | null
  umd_name?: string | null
}

type PeriodValue = '3m' | '6m' | '1y' | 'all'

const PERIOD_OPTIONS: { label: string; value: PeriodValue; description: string }[] = [
  { label: '3개월', value: '3m', description: '최근 3개월 흐름' },
  { label: '6개월', value: '6m', description: '최근 6개월 흐름' },
  { label: '1년', value: '1y', description: '최근 1년 흐름' },
  { label: '전체', value: 'all', description: '전체 거래 이력' },
]

function formatKoreanPrice(value: number) {
  const safeValue = Math.round(Number(value) || 0)
  const eok = Math.floor(safeValue / 10000)
  const man = safeValue % 10000

  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString()}만원`
  if (eok > 0) return `${eok}억원`
  return `${man.toLocaleString()}만원`
}

function formatRoadAddress(complex: Complex) {
  const head = [complex.sido_name, complex.sigungu_name, complex.road_name]
    .filter(Boolean)
    .join(' ')

  const roadNameOnly = String(complex.road_name || '').trim()
  const bonbun = String(complex.road_bonbun || '').trim()
  const bubun = String(complex.road_bubun || '').trim()
  const base = head || roadNameOnly

  if (!base) return ''

  if (bonbun && bubun && bubun !== '0' && bubun !== '0000') {
    return `${base} ${Number(bonbun)}-${Number(bubun)}`
  }

  if (bonbun) {
    return `${base} ${Number(bonbun)}`
  }

  return base
}

function formatJibunAddress(complex: Complex) {
  return [complex.sido_name, complex.sigungu_name, complex.umd_name]
    .filter(Boolean)
    .join(' ')
}

function formatBuildText(buildYear?: number | null) {
  if (!buildYear) return ''
  const currentYear = new Date().getFullYear()
  return `${currentYear - buildYear}년차 ${buildYear}년 준공`
}

function formatDealDate(item: Transaction) {
  return `${item.deal_year}.${String(item.deal_month || '').padStart(2, '0')}.${String(
    item.deal_day || '',
  ).padStart(2, '0')}`
}

function getDealDate(item: Transaction) {
  const year = Number(item.deal_year || 0)
  const month = Number(item.deal_month || 1)
  const day = Number(item.deal_day || 1)
  return new Date(year, month - 1, day)
}

function getDealTimestamp(item: Transaction) {
  return getDealDate(item).getTime()
}

function getPeriodCutoff(period: PeriodValue) {
  if (period === 'all') return 0

  const now = new Date()
  const cutoff = new Date(now)

  if (period === '3m') cutoff.setMonth(cutoff.getMonth() - 3)
  if (period === '6m') cutoff.setMonth(cutoff.getMonth() - 6)
  if (period === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1)

  cutoff.setHours(0, 0, 0, 0)
  return cutoff.getTime()
}

export default function ComplexDetailClient({
  complex,
  transactions,
}: {
  complex: Complex
  transactions: Transaction[]
}) {
  const [selectedArea, setSelectedArea] = useState<number | null>(null)
  const [period, setPeriod] = useState<PeriodValue>('1y')

  const safeTransactions = useMemo(() => {
    return (transactions || [])
      .slice()
      .sort((a, b) => getDealTimestamp(b) - getDealTimestamp(a))
  }, [transactions])

  const areaList = useMemo(() => {
    const map = new Map<number, number>()

    for (const item of safeTransactions) {
      const area = Math.round(Number(item.area_m2 || 0))
      if (!area) continue
      map.set(area, (map.get(area) || 0) + 1)
    }

    return Array.from(map.entries())
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => a.area - b.area)
  }, [safeTransactions])

  const filteredTransactions = useMemo(() => {
    const cutoff = getPeriodCutoff(period)

    return safeTransactions.filter((item) => {
      const area = Math.round(Number(item.area_m2 || 0))
      const matchesArea = selectedArea === null || area === selectedArea
      const matchesPeriod = period === 'all' || getDealTimestamp(item) >= cutoff
      return matchesArea && matchesPeriod
    })
  }, [period, safeTransactions, selectedArea])

  const stats = useMemo(() => {
    const prices = filteredTransactions
      .map((item) => Number(item.price_krw || 0))
      .filter((price) => price > 0)

    return {
      count: filteredTransactions.length,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      minPrice: prices.length ? Math.min(...prices) : 0,
      latestPrice: filteredTransactions.length
        ? Number(filteredTransactions[0]?.price_krw || 0)
        : 0,
      latestDate: filteredTransactions.length ? formatDealDate(filteredTransactions[0]) : '',
    }
  }, [filteredTransactions])

  const chartData = useMemo(() => {
    return filteredTransactions
      .slice()
      .sort((a, b) => getDealTimestamp(a) - getDealTimestamp(b))
      .map((item) => ({
        date: formatDealDate(item),
        price: Number(item.price_krw || 0),
      }))
      .filter((item) => item.price > 0)
  }, [filteredTransactions])

  const selectedPeriodMeta = PERIOD_OPTIONS.find((item) => item.value === period)
  const selectedAreaLabel = selectedArea === null ? '전체 면적' : `${selectedArea}㎡`

  const roadAddress = formatRoadAddress(complex)
  const jibunAddress = formatJibunAddress(complex)
  const buildText = formatBuildText(complex.build_year)

  return (
    <main className="min-h-screen overflow-x-hidden bg-white px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto min-w-0 max-w-5xl">
        <Link
          href="/"
          className="inline-flex rounded-xl border px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
        >
          ← 목록으로
        </Link>

        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                아파트 실거래 상세
              </div>

              <h1 className="mt-3 break-all text-2xl font-bold text-gray-900 sm:break-words sm:text-3xl">
                {complex?.official_name || '단지 상세'}
              </h1>

              <div className="mt-4 space-y-1 text-sm text-gray-600 sm:text-base">
                {roadAddress && <div className="break-all sm:break-words">{roadAddress}</div>}
                {jibunAddress && <div className="break-all sm:break-words">{jibunAddress}</div>}
                {buildText && <div className="break-keep">{buildText}</div>}
              </div>
            </div>

            <div className="w-full shrink-0 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 lg:w-auto lg:min-w-[220px]">
              <div className="font-semibold text-gray-900">현재 보기 기준</div>
              <div className="mt-2 break-keep">기간: {selectedPeriodMeta?.label}</div>
              <div className="break-keep">면적: {selectedAreaLabel}</div>
              <div className="break-keep">거래 수: {stats.count}건</div>
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">조회 조건</h2>
              <p className="mt-1 text-sm text-gray-500">
                기간과 면적을 바꾸면 차트와 거래 내역이 함께 갱신됩니다.
              </p>
            </div>

            <div className="break-keep rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
              {selectedPeriodMeta?.description}
              {stats.latestDate ? ` · 최근 거래일 ${stats.latestDate}` : ''}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-sm font-medium text-gray-700">기간 선택</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map((option) => {
                const active = period === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeriod(option.value)}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      active
                        ? 'border-black bg-black text-white shadow-sm'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          {areaList.length > 0 && (
            <div className="mt-5">
              <div className="text-sm font-medium text-gray-700">면적 선택</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedArea(null)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    selectedArea === null
                      ? 'border-black bg-black text-white shadow-sm'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  전체 ({safeTransactions.length})
                </button>

                {areaList.map(({ area, count }) => {
                  const active = selectedArea === area
                  return (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setSelectedArea(area)}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        active
                          ? 'border-black bg-black text-white shadow-sm'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {area}㎡ ({count})
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">선택 조건 거래건수</div>
            <div className="mt-2 break-keep text-2xl font-bold text-gray-900">
              {stats.count}건
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">최고가</div>
            <div className="mt-2 break-keep text-2xl font-bold text-red-600">
              {stats.maxPrice ? formatKoreanPrice(stats.maxPrice) : '-'}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">최저가</div>
            <div className="mt-2 break-keep text-2xl font-bold text-gray-900">
              {stats.minPrice ? formatKoreanPrice(stats.minPrice) : '-'}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">최근거래가</div>
            <div className="mt-2 break-keep text-2xl font-bold text-orange-500">
              {stats.latestPrice ? formatKoreanPrice(stats.latestPrice) : '-'}
            </div>
          </div>
        </div>

        <NaverMap
          name={complex?.official_name || undefined}
          address={roadAddress || undefined}
          areaAddress={jibunAddress || undefined}
        />

        <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">가격 추이</h2>
              <p className="mt-1 text-sm text-gray-500">
                {selectedPeriodMeta?.label} · {selectedAreaLabel} 기준 실거래가 흐름입니다.
              </p>
            </div>
          </div>

          {chartData.length <= 1 ? (
            <div className="mt-4 flex h-80 items-center justify-center rounded-2xl bg-gray-50 text-center text-sm text-gray-500">
              선택한 조건의 거래 데이터가 부족해서 추이를 표시하기 어렵습니다.
            </div>
          ) : (
            <div className="mt-4 h-80 min-h-[320px] min-w-0">
              <PriceChart data={chartData} />
            </div>
          )}
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">거래 내역</h2>
              <p className="mt-1 text-sm text-gray-500">최신 거래 순으로 표시됩니다.</p>
            </div>
            <div className="text-sm text-gray-500">총 {stats.count}건</div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              선택한 기간과 면적에 해당하는 거래가 없습니다.
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {filteredTransactions.map((item, index) => (
                <div
                  key={`${item.id || index}-${item.deal_year}-${item.deal_month}-${item.deal_day}`}
                  className="overflow-hidden rounded-2xl border border-gray-200 p-4 transition hover:shadow-sm"
                >
                  <div className="flex min-w-0 items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-500">
                        거래일 {formatDealDate(item)}
                      </div>
                      <div className="mt-2 break-words text-sm text-gray-600">
                        {item.umd_name || item.dong || '-'} · {item.area_m2 ?? '-'}㎡ ·{' '}
                        {item.floor ?? '-'}층
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-sm text-gray-500">거래가</div>
                      <div className="mt-1 break-keep text-xl font-bold text-orange-500">
                        {item.price_krw
                          ? formatKoreanPrice(Number(item.price_krw))
                          : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}