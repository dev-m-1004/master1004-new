import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from('region_sidos')
    .select('sido_name')

  if (error) {
    return NextResponse.json({
      message: '조회 실패',
      error: error.message,
    })
  }

  return NextResponse.json({
    data: (data || []).map((row) => row.sido_name),
  })
}