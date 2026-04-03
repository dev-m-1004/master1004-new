import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SIDO_CODE_MAP: Record<string, string> = {
  서울특별시: '11',
  부산광역시: '26',
  대구광역시: '27',
  인천광역시: '28',
  광주광역시: '29',
  대전광역시: '30',
  울산광역시: '31',
  세종특별자치시: '36',
  경기도: '41',
  강원도: '42',
  강원특별자치도: '51',
  충청북도: '43',
  충청남도: '44',
  전북특별자치도: '45',
  전라남도: '46',
  경상북도: '47',
  경상남도: '48',
  제주특별자치도: '50',
}

export async function GET() {
  const { data, error } = await supabase
    .from('region_sidos')
    .select('sido_name')
    .order('sido_name', { ascending: true })

  if (error) {
    return NextResponse.json(
      {
        message: '조회 실패',
        error: error.message,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: (data || []).map((row) => {
      const name = String(row.sido_name ?? '').trim()
      return {
        code: SIDO_CODE_MAP[name] || name,
        name,
      }
    }),
  })
}
