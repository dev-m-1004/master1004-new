import { supabaseAdmin } from '@/lib/supabase/admin'
import ComplexDetailClient from './complex-detail-client'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  const { data: transactions, error: transactionsError } = await supabaseAdmin
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
    .order('deal_year', { ascending: false })
    .order('deal_month', { ascending: false })
    .order('deal_day', { ascending: false })

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

  if (!transactions || transactions.length === 0) {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border p-6">
            <h1 className="text-2xl font-bold">상세 디버그</h1>
            <pre className="mt-4 whitespace-pre-wrap text-sm text-gray-700">
{JSON.stringify(
  {
    id,
    step: 'no transactions matched by complex_id',
    transactionsCount: 0,
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

  const { data: complexById } = await supabaseAdmin
    .from('complexes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  const firstTx = transactions[0]

  const complex =
    complexById ?? {
      id,
      official_name: firstTx.apartment_name ?? '단지 상세',
      road_name: null,
      road_bonbun: null,
      road_bubun: null,
      sido_name: null,
      sigungu_name: null,
      umd_name: firstTx.umd_name ?? firstTx.dong ?? null,
      build_year: null,
    }

  return (
    <ComplexDetailClient
      complex={complex}
      transactions={transactions}
    />
  )
}