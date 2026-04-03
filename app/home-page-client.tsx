'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

function splitKoreanPrice(value: number) {
  const amount = Number(value || 0)
  if (!amount) return { amountText: '-', suffix: '' }

  const eok = Math.floor(amount / 10000)
  const man = amount % 10000

  if (eok > 0 && man > 0) {
    return {
      amountText: `${eok}억${man.toLocaleString()}`,
      suffix: '만원',
    }
  }

  if (eok > 0) {
    return {
      amountText: `${eok}억`,
      suffix: '만원',
    }
  }

  return {
    amountText: man.toLocaleString(),
    suffix: '만원',
  }
}

function formatRoadAddress(item: TransactionItem) {
  const roadName = String(item.road_name || '').trim()
  const bonbun = String(item.road_bonbun || '').trim()
  const bubun = String(item.road_bubun || '').trim()

  if (!roadName) return item.umd_name || ''

  if (bonbun && bubun && bubun !== '0' && bubun !== '0000') {
    return `${roadName} ${Number(bonbun)}-${Number(bubun)}`
  }

  if (bonbun) return `${roadName} ${Number(bonbun)}`
  return roadName
}

type SortType = 'latest' | 'price_desc' | 'price_asc'

type TransactionItem = {
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
  umd_name?: string | null
  road_name?: string | null
  road_bonbun?: string | null
  road_bubun?: string | null
  build_year?: number | null
  deal_count?: number | null
  max_price_krw?: number | null
  min_price_krw?: number | null
}

type ListApiResponse = {
  ok?: boolean
  message?: string
  items?: TransactionItem[]
  pagination?: {
    page: number
    pageSize: number
    hasMore: boolean
  }
  error?: string
}

type SummaryItem = {
  region_name?: string
  apartment_name: string
  pyeong: string
  price_krw: number
  complex_id?: string | null
  count?: number
}

type RegionCount = {
  code: string
  name: string
  count: number
}

type TrendPoint = {
  year: string
  count: number
}

type SummaryResponse = {
  ok?: boolean
  latestDealDate?: string
  regionCounts?: RegionCount[]
  trend?: TrendPoint[]
  topPriceWeek?: SummaryItem[]
  topVolumeWeek?: SummaryItem[]
}

const PAGE_SIZE = 30
const REGION_BUTTONS = [
  { code: '11', name: '서울특별시' },
  { code: '41', name: '경기도' },
  { code: '26', name: '부산광역시' },
  { code: '28', name: '인천광역시' },
  { code: '27', name: '대구광역시' },
  { code: '30', name: '대전광역시' },
  { code: '29', name: '광주광역시' },
  { code: '31', name: '울산광역시' },
  { code: '36', name: '세종특별자치시' },
  { code: '51', name: '강원특별자치도' },
  { code: '43', name: '충청북도' },
  { code: '44', name: '충청남도' },
  { code: '45', name: '전북특별자치도' },
  { code: '46', name: '전라남도' },
  { code: '47', name: '경상북도' },
  { code: '48', name: '경상남도' },
  { code: '50', name: '제주특별자치도' },
]
const SUGGESTED_KEYWORDS = ['래미안', '자이', '힐스테이트', '푸르지오', 'e편한세상']
const RECENT_SEARCH_KEY = 'realtrade-master-recent-searches'

function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY) || '[]')
      if (Array.isArray(saved)) {
        setRecentSearches(saved.filter(Boolean).slice(0, 8))
      }
    } catch {
      setRecentSearches([])
    }
  }, [])

  const saveSearch = (keyword: string) => {
    const next = keyword.trim()
    if (!next) return
    const merged = [next, ...recentSearches.filter((item) => item !== next)].slice(0, 8)
    setRecentSearches(merged)
    try {
      localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(merged))
    } catch {}
  }

  return { recentSearches, saveSearch }
}

function PriceText({
  value,
  className = '',
  allOrange = false,
}: {
  value: number
  className?: string
  allOrange?: boolean
}) {
  const { amountText, suffix } = splitKoreanPrice(value)

  return (
    <span className={className}>
      <span className="text-orange-500">
        {amountText}
        {suffix && allOrange ? suffix : ''}
      </span>
      {suffix && !allOrange ? <span className="text-gray-900">{suffix}</span> : null}
    </span>
  )
}

function FancyTrendChart({ items }: { items: TrendPoint[] }) {
  const fallback = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map((year) => ({
    year: String(year),
    count: 0,
  }))
  const values = items.length > 0 ? items : fallback
  const max = Math.max(1, ...values.map((item) => Number(item.count || 0)))
  const width = 860
  const height = 320
  const left = 50
  const right = 24
  const top = 28
  const bottom = 54
  const innerWidth = width - left - right
  const innerHeight = height - top - bottom

  const points = values.map((item, index) => {
    const x = left + (innerWidth / Math.max(1, values.length - 1)) * index
    const ratio = Number(item.count || 0) / max
    const y = top + innerHeight - ratio * innerHeight
    return { x, y, label: item.year, count: Number(item.count || 0) }
  })

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? left} ${
    top + innerHeight
  } L ${points[0]?.x ?? left} ${top + innerHeight} Z`

  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((tick) => ({
    value: Math.round(max * tick),
    y: top + innerHeight - innerHeight * tick,
  }))

  return (
    <div className="min-w-0 overflow-hidden rounded-[28px] border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-keep text-lg font-bold tracking-tight text-gray-900">
            2020년 ~ 2026년 매매거래 동향
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            연도별 전국 아파트 매매 거래건수입니다.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[24px] bg-gradient-to-br from-slate-50 via-white to-orange-50 p-3 sm:p-4">
        <div className="relative h-[260px] w-full min-w-0 sm:h-[300px] md:h-[340px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
            <defs>
              <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb923c" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#fb923c" stopOpacity="0.03" />
              </linearGradient>
              <linearGradient id="trendLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => (
              <g key={`${tick.value}-${tick.y}`}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="#e5e7eb"
                  strokeDasharray="4 6"
                />
                <text
                  x={left - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fontWeight="600"
                  fill="#94a3b8"
                >
                  {tick.value.toLocaleString()}
                </text>
              </g>
            ))}

            <path d={areaPath} fill="url(#trendArea)" />
            <path
              d={linePath}
              fill="none"
              stroke="url(#trendLine)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {points.map((point) => (
              <g key={point.label}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="6"
                  fill="#fff"
                  stroke="#f97316"
                  strokeWidth="3"
                />
                <rect
                  x={point.x - 34}
                  y={point.y - 38}
                  rx="10"
                  ry="10"
                  width="68"
                  height="22"
                  fill="#111827"
                  opacity="0.92"
                />
                <text
                  x={point.x}
                  y={point.y - 23}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#fff"
                >
                  {point.count.toLocaleString()}
                </text>
                <text
                  x={point.x}
                  y={height - 14}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="#6b7280"
                >
                  {point.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  )
}

function TopListSection({
  title,
  items,
}: {
  title: string
  items: SummaryItem[]
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="break-keep text-base font-bold tracking-tight text-gray-900 sm:text-lg">
        {title}
      </h2>

      <ol className="mt-4 space-y-3">
        {items.length === 0 ? (
          <li className="rounded-2xl bg-gray-50 px-4 py-4 text-sm text-gray-500">
            표시할 거래가 없습니다.
          </li>
        ) : (
          items.slice(0, 5).map((item, index) => {
            const body = (
              <div className="flex min-w-0 items-start gap-3 overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-gray-50 px-4 py-3 shadow-sm transition hover:border-orange-200 hover:shadow-md">
                <span className="mt-0.5 inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 px-2 text-xs font-bold text-white">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1 text-sm text-gray-700">
                  <div className="break-words leading-6 text-[14px] sm:text-sm">
                    <span className="font-semibold text-gray-500">
                      {item.region_name || '전국'}
                    </span>{' '}
                    <span className="break-all font-semibold text-gray-900 sm:break-words">
                      {item.apartment_name}
                    </span>{' '}
                    <span className="break-keep">{item.pyeong}</span>{' '}
                    <PriceText
                      value={item.price_krw}
                      allOrange
                      className="font-semibold"
                    />
                    {typeof item.count === 'number' ? (
                      <span className="text-gray-500"> · {item.count}건</span>
                    ) : null}
                  </div>
                </div>
              </div>
            )

            if (!item.complex_id) {
              return (
                <li
                  key={`${item.region_name}-${item.apartment_name}-${item.pyeong}-${index}`}
                >
                  {body}
                </li>
              )
            }

            return (
              <li key={`${item.complex_id}-${index}`}>
                <Link href={`/complex/${item.complex_id}`} className="block min-w-0">
                  {body}
                </Link>
              </li>
            )
          })
        )}
      </ol>
    </section>
  )
}

export default function HomePageClient() {
  const [data, setData] = useState<TransactionItem[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [selectedSidoCode, setSelectedSidoCode] = useState('')
  const [selectedSidoName, setSelectedSidoName] = useState('')
  const [sortType, setSortType] = useState<SortType>('latest')
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [regionCounts, setRegionCounts] = useState<RegionCount[]>([])
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [topPriceWeek, setTopPriceWeek] = useState<SummaryItem[]>([])
  const [topVolumeWeek, setTopVolumeWeek] = useState<SummaryItem[]>([])
  const [summaryLoading, setSummaryLoading] = useState(true)

  const abortRef = useRef<AbortController | null>(null)
  const { recentSearches, saveSearch } = useRecentSearches()

  async function fetchList(page = 1, sort = sortType, nextKeyword = keyword) {
    try {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      setErrorMessage('')

      const params = new URLSearchParams()
      const trimmedKeyword = nextKeyword.trim()

      if (trimmedKeyword) params.set('q', trimmedKeyword)
      if (selectedSidoCode) params.set('sidoCode', selectedSidoCode)
      params.set('page', String(page))
      params.set('pageSize', String(PAGE_SIZE))
      params.set('sort', sort)

      const res = await fetch(`/api/list?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      const json: ListApiResponse = await res.json()

      if (!res.ok || json.ok === false) {
        throw new Error(json.error || json.message || '목록 조회 실패')
      }

      const items = json.items || []
      const pagination = json.pagination

      setData(items)
      setCurrentPage(pagination?.page || page)
      setHasMore(Boolean(pagination?.hasMore))
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      console.error('[browser] 목록 조회 실패', error)
      setData([])
      setHasMore(false)
      setErrorMessage(error?.message || '목록 조회 실패')
    } finally {
      setLoading(false)
    }
  }

  async function fetchSummary() {
    try {
      setSummaryLoading(true)

      const res = await fetch('/api/home/summary')
      const json: SummaryResponse = await res.json()

      setRegionCounts(json.regionCounts || [])
      setTrend(json.trend || [])
      setTopPriceWeek(json.topPriceWeek || [])
      setTopVolumeWeek(json.topVolumeWeek || [])
    } catch (error) {
      console.error('메인 요약 조회 실패', error)
      setRegionCounts([])
      setTrend([])
      setTopPriceWeek([])
      setTopVolumeWeek([])
    } finally {
      setSummaryLoading(false)
    }
  }

  function runSearch(next?: string) {
    const value = (next ?? searchInput).trim()
    setSearchInput(value)
    setKeyword(value)
    setCurrentPage(1)
    if (value) saveSearch(value)
  }

  function applyRegion(code: string, name: string) {
    setSelectedSidoCode(code)
    setSelectedSidoName(name)
    setCurrentPage(1)
  }

  function clearFilters() {
    setSelectedSidoCode('')
    setSelectedSidoName('')
    setSearchInput('')
    setKeyword('')
    setCurrentPage(1)
    setHasMore(false)
    setErrorMessage('')
  }

  useEffect(() => {
    async function init() {
      await Promise.all([fetchSummary(), fetchList(1, 'latest', '')])
      setInitialized(true)
    }

    init()

    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!initialized) return
    fetchList(1, sortType, keyword)
  }, [initialized, selectedSidoCode, keyword, sortType])

  useEffect(() => {
    if (!initialized || currentPage === 1) return
    fetchList(currentPage, sortType, keyword)
  }, [currentPage])

  const regionCountMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of regionCounts) map.set(item.code, item.count)
    return map
  }, [regionCounts])

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f8fa] px-3 py-6 sm:px-4 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-gray-200 bg-white px-4 py-6 shadow-sm sm:px-5 sm:py-7 md:px-8">
          <div className="text-center">
            <h1 className="break-keep text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl md:text-4xl">
              아파트 실거래 정보 검색
            </h1>
            <p className="mt-3 text-sm text-gray-500 md:text-base">
              단지명이나 지역명을 입력하고, 최근 거래와 가격 정보를 빠르게 확인해보세요.
            </p>
          </div>

          <div className="mx-auto mt-6 max-w-3xl">
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSearch()
                }}
                placeholder="단지명 / 지역명 입력"
                className="h-14 min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-5 text-base outline-none transition focus:border-gray-400"
              />
              <button
                type="button"
                onClick={() => runSearch()}
                className="h-14 shrink-0 rounded-2xl bg-[#1f2937] px-6 text-sm font-semibold text-white transition hover:bg-black"
              >
                검색
              </button>
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTED_KEYWORDS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => runSearch(item)}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
                >
                  {item}
                </button>
              ))}
            </div>

            {recentSearches.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500">
                <span className="font-medium text-gray-400">최근 검색어</span>
                {recentSearches.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => runSearch(item)}
                    className="rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-700 transition hover:bg-gray-200"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <FancyTrendChart items={trend} />

        <section className="grid gap-6 lg:grid-cols-2">
          <TopListSection title="최근 일주일 전국 거래가 TOP 5" items={topPriceWeek} />
          <TopListSection title="최근 일주일 전국 거래량 TOP 5" items={topVolumeWeek} />
        </section>

        <section className="overflow-hidden rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="break-keep text-lg font-bold tracking-tight text-gray-900">
                지역 바로가기
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                최근 5년 거래건수 기준으로 바로 이동합니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {REGION_BUTTONS.map((region) => {
              const isActive = selectedSidoCode === region.code
              const count = regionCountMap.get(region.code) || 0
              return (
                <button
                  key={region.code}
                  type="button"
                  onClick={() => applyRegion(region.code, region.name)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    isActive
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>{region.name}</span>
                  <span
                    className={`ml-1 font-semibold ${
                      isActive ? 'text-orange-300' : 'text-orange-500'
                    }`}
                  >
                    ({count.toLocaleString()})
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-gray-200 bg-white p-4 shadow-sm md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h2 className="break-keep text-lg font-bold tracking-tight text-gray-900">
                단지 리스트
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {selectedSidoName ? `${selectedSidoName} 기준으로 ` : ''}
                최근 실거래 단지를 확인할 수 있습니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sortType}
                onChange={(e) => {
                  setSortType(e.target.value as SortType)
                  setCurrentPage(1)
                }}
                className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none"
              >
                <option value="latest">최신 거래순</option>
                <option value="price_desc">가격 높은순</option>
                <option value="price_asc">가격 낮은순</option>
              </select>

              {(selectedSidoCode || keyword) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-700 transition hover:bg-gray-50"
                >
                  필터 초기화
                </button>
              )}
            </div>
          </div>

          {(selectedSidoName || keyword) && (
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {selectedSidoName && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                  지역: {selectedSidoName}
                </span>
              )}
              {keyword && (
                <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-700">
                  검색어: {keyword}
                </span>
              )}
            </div>
          )}

          {errorMessage ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {loading && data.length === 0 ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="h-[180px] animate-pulse rounded-[24px] border border-gray-200 bg-gray-50"
                />
              ))
            ) : data.length === 0 ? (
              <div className="col-span-full rounded-[24px] border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
                검색 결과가 없습니다.
              </div>
            ) : (
              data.map((item) => {
                const detailHref = item.complex_id ? `/complex/${item.complex_id}` : '#'
                const price = Number(item.price_krw || 0)

                return (
                  <Link
                    key={`${item.id}-${item.complex_id || 'row'}`}
                    href={detailHref}
                    className="group min-w-0 overflow-hidden rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md sm:p-5"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="break-all text-base font-bold tracking-tight text-gray-900 sm:break-words sm:text-lg">
                          {item.apartment_name || '-'}
                        </div>
                        <div className="mt-1 break-keep text-sm text-gray-500">
                          {item.umd_name || '-'} · 준공 {item.build_year || '-'}
                        </div>
                      </div>

                      <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                        {item.area_m2 ? `${Math.round(item.area_m2 / 3.3058)}평` : '-'}
                      </span>
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                          최근 실거래가
                        </div>
                        <div className="mt-1 break-keep text-2xl font-extrabold tracking-tight">
                          <PriceText
                            value={price}
                            allOrange
                            className="text-2xl font-extrabold tracking-tight"
                          />
                        </div>
                      </div>

                      <div className="shrink-0 text-right text-sm text-gray-500">
                        <div>
                          {item.deal_year || '-'}.
                          {String(item.deal_month || '').padStart(2, '0')}.
                          {String(item.deal_day || '').padStart(2, '0')}
                        </div>
                        <div className="mt-1">{item.floor || '-'}층</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                      <div className="break-all sm:break-words">{formatRoadAddress(item)}</div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="break-keep">거래 {item.deal_count || 0}건</span>
                        <span className="shrink-0 font-medium text-gray-700 group-hover:text-gray-900">
                          상세보기 →
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage <= 1 || loading}
              className="h-10 rounded-xl border border-gray-200 px-4 text-sm text-gray-700 transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              이전
            </button>
            <span className="min-w-[72px] text-center text-sm font-medium text-gray-700">
              {currentPage} 페이지
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => page + 1)}
              disabled={!hasMore || loading}
              className="h-10 rounded-xl border border-gray-200 px-4 text-sm text-gray-700 transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              다음
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}