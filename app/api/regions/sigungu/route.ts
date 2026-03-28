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
    .from('region_sigungus')
    .select('sigungu_name')
    .eq('sido_name', sido)

  if (error) {
    return NextResponse.json({
      message: '조회 실패',
      error: error.message,
    })
  }

  return NextResponse.json({
    data: (data || []).map((row) => row.sigungu_name),
  })
}