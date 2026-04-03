import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const sido = req.nextUrl.searchParams.get('sido')

  if (!sido) {
    return NextResponse.json({ data: [] })
  }

  const { data, error } = await supabase
    .from('regions')
    .select('sigungu_name')
    .eq('sido_name', sido)
    .not('sigungu_name', 'is', null)

  if (error) {
    return NextResponse.json(
      {
        message: '조회 실패',
        error: error.message,
      },
      { status: 500 }
    )
  }

  const unique = Array.from(
    new Set((data || []).map((row) => String(row.sigungu_name || '').trim()))
  ).filter(Boolean)

  return NextResponse.json({
    data: unique.map((name) => ({
      code: name,
      name,
    })),
  })
}
