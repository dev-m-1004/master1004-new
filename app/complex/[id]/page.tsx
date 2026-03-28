import { createClient } from '@supabase/supabase-js'
import PriceChart from './price-chart'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 가격 포맷
function formatKoreanPrice(value: number) {
  const eok = Math.floor(value / 10000)
  const man = value % 10000

  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString()}만 원`
  if (eok > 0) return `${eok}억 원`
  return `${man.toLocaleString()}만 원`
}

// 건축 연차 계산
function getBuildingAge(buildYear?: number | null) {
  if (!buildYear) return '-'
  const currentYear = new Date().getFullYear()
  return `${currentYear - buildYear + 1}년`
}

// 도로명 주소 표시
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

// 지역명 표시
function formatLocationText(complex: any) {
  const parts = [
    complex?.sido_name,
    complex?.sigungu_name,
    complex?.umd_name,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' ') : complex?.umd_name || '-'
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // 단지 정보
  const { data: complex } = await supabase
    .from('complexes')
    .select('*')
    .eq('id', id)
    .single()

  // 거래 데이터
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('complex_id', id)
    .order('deal_year', { ascending: false })
    .order('deal_month', { ascending: false })
    .order('deal_day', { ascending: false })

  const safeTransactions = transactions || []

  // 요약 데이터
  const dealCount = safeTransactions.length

  const prices = safeTransactions
    .map((item: any) => Number(item.price_krw || 0))
    .filter((price: number) => price > 0)

  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0
  const latestPrice =
    safeTransactions.length > 0
      ? Number(safeTransactions[0].price_krw || 0)
      : 0

  // 차트 데이터
  const chartData =
    safeTransactions
      .slice()
      .reverse()
      .map((item: any) => ({
        date: `${item.deal_year}.${String(item.deal_month).padStart(2, '0')}.${String(item.deal_day).padStart(2, '0')}`,
        price: item.price_krw,
      })) || []

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl">
        {/* 단지명 */}
        <h1 className="text-3xl font-bold">
          {complex?.official_name || '단지 상세'}
        </h1>

        {/* 주소 / 지역 / 준공정보 */}
        <div className="mt-3 space-y-1 text-sm text-gray-600">
          <div>
            {formatRoadAddress(
              complex?.road_name,
              complex?.road_bonbun,
              complex?.road_bubun
            )}
          </div>

          <div>{formatLocationText(complex)}</div>

          <div>
            {complex?.build_year
              ? `${complex.build_year}년 준공 · ${getBuildingAge(complex.build_year)}`
              : '-'}
          </div>
        </div>

        {/* 요약 카드 */}
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

        {/* 가격 추이 차트 */}
        {chartData.length > 0 && (
          <div className="mt-8 rounded-2xl border p-4">
            <h2 className="text-lg font-semibold">가격 추이</h2>
            <div className="mt-4 h-80">
              <PriceChart data={chartData} />
            </div>
          </div>
        )}

        {/* 오류 */}
        {error && (
          <p className="mt-4 text-red-600">
            조회 실패: {error.message}
          </p>
        )}

        {/* 거래 목록 */}
        <div className="mt-8 space-y-3">
          {safeTransactions.map((item: any, i: number) => (
            <div key={i} className="rounded-2xl border p-4">
              <div className="text-sm text-gray-600">
                {item.deal_year}.{item.deal_month}.{item.deal_day}
              </div>

              <div className="mt-1 text-xl font-semibold">
                {formatKoreanPrice(item.price_krw)}
              </div>

              <div className="text-sm text-gray-500">
                {item.area_m2}㎡ / {item.floor}층
              </div>

              <div className="text-sm text-gray-500">
                법정동: {item.umd_name || item.dong || '-'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}