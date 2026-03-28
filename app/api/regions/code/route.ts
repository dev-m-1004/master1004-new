import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const sido = req.nextUrl.searchParams.get('sido')
  const sigungu = req.nextUrl.searchParams.get('sigungu')

  if (!sido || !sigungu) {
    return NextResponse.json({ data: null })
  }

  const { data, error } = await supabase
    .from('regions')
    .select('lawd_code')
    .eq('sido_name', sido)
    .eq('sigungu_name', sigungu)
    .limit(1)
    .single()

  if (error) {
    return NextResponse.json({ data: null })
  }

  return NextResponse.json({ data })
}