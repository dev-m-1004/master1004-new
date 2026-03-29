'use client'

import { useMemo, useState } from 'react'
import NaverMap from '@/components/NaverMap'
import PriceChart from './price-chart'

type Complex = {
  id?: string
  official_name?: string | null
  road_name?: string | null
  road_bonbun?: string | null
  road_bubun?: string | null
  sido_name?: string | null
  sigungu_name?: string | null
  umd_name?: string | null
  build_year?: number | null
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

function formatKoreanPrice(value: number) {
  const eok = Math.floor(value / 10000)
  const man = value % 10000

  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString()}만 원`
  if (eok > 0) return `${eok}억 원`
  return `${man.toLocaleString()}만 원`
}

function getBuildingAge(buildYear?: number | null) {
  if (!buildYear) return '-'
  const currentYear = new Date().getFullYear()
  return `${currentYear - buildYear + 1}년`
}

function formatRoadAddress(
  roadName?: string | null,
  bonbun?: string | null,
  bubun?: string | null
) {
  if (!roadName) return '-'

  const main = bonbun?.toString().trim() || ''
  const sub = bubun?.toString().trim() || ''

  if (main && sub && sub !== '0' && sub !== '0000') {
    return `${roadName} ${Number(main)}-${Number(sub)}`
  }

  if (main) {
    return `${roadName} ${Number(main)}`
  }

  return roadName
}

function formatLocationText(complex: Complex) {
  const parts = [
    complex?.sido_name,
    complex?.sigungu_name,
    complex?.umd_name,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' ') : complex?.umd_name || '-'
}

function formatDealDate(item: Transaction) {
  const year = item.deal_year ?? ''
  const month = String(item.deal_month ?? '').padStart(2, '0')
  const day = String(item.deal_day ?? '').padStart(2, '0')
  return `${year}.${month}.${day}`
}

export default function ComplexDetailClient({
  complex,
  transactions,
}: {
  complex: Complex
  transactions: Transaction[]
}) {
  const [selectedArea, setSelectedArea] = useState<number | null>(null)

  const safeTransactions = transactions || []

  const dealCount = safeTransactions.length

  const prices = safeTransactions
    .map((item) => Number(item.price_krw || 0))
    .filter((price) => price > 0)

  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0
  const latestPrice =
    safeTransactions.length > 0
      ? Number(safeTransactions[0]?.price_krw || 0)
      : 0

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
    if (selectedArea === null) return safeTransactions

    return safeTransactions.filter((item) => {
      const area = Math.round(Number(item.area_m2 || 0))
      return area === selectedArea
    })
  }, [safeTransactions, selectedArea])

  const chartData = useMemo(() => {
    return filteredTransactions
      .slice()
      .sort((a, b) => {
        const dateA = new Date(
          `${a.deal_year}-${String(a.deal_month).padStart(2, '0')}-${String(a.deal_day).padStart(2, '0')}`
        ).getTime()

        const dateB = new Date(
          `${b.deal_year}-${String(b.deal_month).padStart(2, '0')}-${String(b.deal_day).padStart(2, '0')}`
        ).getTime()

        return dateA - dateB
      })
      .map((item) => ({
        date: formatDealDate(item),
        price: Number(item.price_krw || 0),
      }))
      .filter((item) => item.price > 0)
  }, [filteredTransactions])

  const roadAddress = formatRoadAddress(
    complex?.road_name,
    complex?.road_bonbun,
    complex?.road_bubun
  )

  const locationText = formatLocationText(complex)

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold">
          {complex?.official_name || '단지 상세'}
        </h1>

        <div className="mt-3 space-y-1 text-sm text-gray-600">
          <div>{roadAddress}</div>
          <div>{locationText}</div>
          <div>
            {complex?.build_year
              ? `${complex.build_year}년 준공 · ${getBuildingAge(complex.build_year)}`
              : '-'}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border p-4">
            <div className="text-sm text-gray-500">거래건수</div>
            <div className="mt-2 text-2xl font-bold">{dealCount}건</div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-sm text-gray-500">최고가</div>
            <div className="mt-2 text-2xl font-bold text-red-600">
              {maxPrice ? formatKoreanPrice(maxPrice) : '-'}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-sm text-gray-500">최저가</div>
            <div className="mt-2 text-2xl font-bold">
              {minPrice ? formatKoreanPrice(minPrice) : '-'}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-sm text-gray-500">최근거래가</div>
            <div className="mt-2 text-2xl font-bold text-orange-500">
              {latestPrice ? formatKoreanPrice(latestPrice) : '-'}
            </div>
          </div>
        </div>

        {areaList.length > 0 && (
          <div className="mt-8 rounded-2xl border p-4">
            <h2 className="text-lg font-semibold">면적 선택</h2>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedArea(null)}
                className={`rounded-full border px-4 py-2 text-sm ${
                  selectedArea === null
                    ? 'border-black bg-black text-white'
                    : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                전체 ({safeTransactions.length})
              </button>

              {areaList.map(({ area, count }) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => setSelectedArea(area)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    selectedArea === area
                      ? 'border-black bg-black text-white'
                      : 'border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  {area}㎡ ({count})
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 rounded-2xl border p-4">
          <h2 className="text-lg font-semibold">
            가격 추이
            {selectedArea !== null && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({selectedArea}㎡)
              </span>
            )}
          </h2>

          {chartData.length <= 1 ? (
            <div className="mt-4 flex h-80 items-center justify-center text-gray-500">
              거래 데이터가 부족해서 추이를 표시하기 어렵습니다.
            </div>
          ) : (
            <div className="mt-4 h-80">
              <PriceChart data={chartData} />
            </div>
          )}
        </div>

        <NaverMap
  name={complex?.official_name ?? undefined}
  address={roadAddress ?? undefined}
  areaAddress={locationText ?? undefined}
/>

        <div className="mt-8 space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="rounded-2xl border p-6 text-gray-500">
              선택한 면적의 거래 내역이 없습니다.
            </div>
          ) : (
            filteredTransactions.map((item, i) => (
              <div
                key={`${item.id || i}-${item.deal_year}-${item.deal_month}-${item.deal_day}`}
                className={`rounded-2xl border p-4 ${
                  i === 0 ? 'border-yellow-300 bg-yellow-50' : ''
                }`}
              >
                <div className="text-sm text-gray-600">
                  {formatDealDate(item)}
                  {i === 0 && (
                    <span className="ml-2 rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">
                      최신 거래
                    </span>
                  )}
                </div>

                <div className="mt-1 text-xl font-semibold">
                  {item.price_krw
                    ? formatKoreanPrice(Number(item.price_krw))
                    : '-'}
                </div>

                <div className="text-sm text-gray-500">
                  {item.area_m2 ?? '-'}㎡ / {item.floor ?? '-'}층
                </div>

                <div className="text-sm text-gray-500">
                  법정동: {item.umd_name || item.dong || '-'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}