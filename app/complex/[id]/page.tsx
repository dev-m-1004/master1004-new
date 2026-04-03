import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import ComplexDetailClient from './complex-detail-client'

type PageProps = {
  params: Promise<{ id: string }> | { id: string }
}

const LOOKBACK_YEARS = 3
const MAX_TRANSACTION_ROWS = 500

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function getMinDealYear() {
  const now = new Date()
  return now.getFullYear() - (LOOKBACK_YEARS - 1)
}

async function getParamsId(params: PageProps['params']) {
  const resolved = await Promise.resolve(params)
  return resolved.id
}

function buildRoadAddress(complex: any) {
  const roadName = typeof complex?.road_name === 'string' ? complex.road_name.trim() : ''
  const bonbun = typeof complex?.road_bonbun === 'string' ? complex.road_bonbun.trim() : ''
  const bubun = typeof complex?.road_bubun === 'string' ? complex.road_bubun.trim() : ''

  if (!roadName) return null

  const buildingNo = [bonbun, bubun].filter(Boolean).join('-')
  return [roadName, buildingNo].filter(Boolean).join(' ')
}

function buildAreaAddress(complex: any) {
  const parts = [
    typeof complex?.umd_name === 'string' ? complex.umd_name.trim() : '',
  ].filter(Boolean)

  return parts.length ? parts.join(' ') : null
}

function buildDescription(complex: any) {
  const bits = [
    buildAreaAddress(complex),
    buildRoadAddress(complex),
    complex?.build_year ? `${complex.build_year}년 준공` : null,
    `최근 ${LOOKBACK_YEARS}년 실거래가`,
  ].filter(Boolean)

  return bits.join(' · ')
}

async function fetchComplexById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('complexes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  return { data, error }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = await getParamsId(params)
  const { data: complex } = await fetchComplexById(id)

  if (!complex) {
    return {
      title: '단지 정보를 찾을 수 없습니다 | MASTER1004',
      description: '요청한 단지 정보를 찾을 수 없습니다.',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const siteName = 'MASTER1004'
  const complexName = complex.official_name || complex.name || '단지 상세'
  const title = `${complexName} 실거래가 | ${siteName}`
  const description = buildDescription(complex) || `${complexName} 최근 ${LOOKBACK_YEARS}년 실거래가`
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  const canonical = baseUrl ? `${baseUrl.replace(/\/$/, '')}/complex/${id}` : undefined

  return {
    title,
    description,
    alternates: canonical
      ? {
          canonical,
        }
      : undefined,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName,
      type: 'website',
      locale: 'ko_KR',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function Page({ params }: PageProps) {
  const id = await getParamsId(params)
  const minDealYear = getMinDealYear()

  const [{ data: complexById, error: complexError }, { data: transactions, error: transactionsError }] =
    await Promise.all([
      fetchComplexById(id),
      supabaseAdmin
        .from('transactions')
        .select(`
          id,
          complex_id,
          apartment_name,
          price_krw,
          area_m2,
          floor,
          deal_year,
          deal_month,
          deal_day,
          lawd_code,
          dong,
          umd_name
        `)
        .eq('complex_id', id)
        .gte('deal_year', minDealYear)
        .order('deal_year', { ascending: false })
        .order('deal_month', { ascending: false })
        .order('deal_day', { ascending: false })
        .order('id', { ascending: false })
        .limit(MAX_TRANSACTION_ROWS),
    ])

  if (complexError) {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-2xl font-bold text-red-600">단지 조회 오류</h1>
            <pre className="mt-4 whitespace-pre-wrap text-sm text-red-700">
{JSON.stringify(
  {
    id,
    step: 'complex query error',
    error: complexError.message,
  },
  null,
  2
)}
            </pre>
          </div>
        </div>
      </main>
    )
  }

  if (transactionsError) {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-2xl font-bold text-red-600">상세 조회 오류</h1>
            <pre className="mt-4 whitespace-pre-wrap text-sm text-red-700">
{JSON.stringify(
  {
    id,
    step: 'transactions query error',
    error: transactionsError.message,
  },
  null,
  2
)}
            </pre>
          </div>
        </div>
      </main>
    )
  }

  const safeTransactions = Array.isArray(transactions) ? transactions : []
  const firstTx = safeTransactions[0]

  const complex =
    complexById ?? {
      id,
      official_name: firstTx?.apartment_name ?? '단지 상세',
      road_name: null,
      road_bonbun: null,
      road_bubun: null,
      umd_name: firstTx?.umd_name ?? firstTx?.dong ?? null,
      build_year: null,
    }

  if (!complexById && safeTransactions.length === 0) {
    notFound()
  }

  const summary = {
    transactionCount: safeTransactions.length,
    minDealYear,
    maxRows: MAX_TRANSACTION_ROWS,
    areaCount: new Set(
      safeTransactions
        .map((item) => Math.round(toNumber(item.area_m2)))
        .filter((value) => value > 0)
    ).size,
  }

  return (
    <ComplexDetailClient
      complex={complex}
      transactions={safeTransactions}
      summary={summary}
    />
  )
}
