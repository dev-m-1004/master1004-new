import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function normalizeKeyword(value: string) {
  return value.toLowerCase().replace(/\s+/g, '')
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  const dong = req.nextUrl.searchParams.get('dong') || ''
  const sidoCode = req.nextUrl.searchParams.get('sidoCode') || ''
  const sigunguCode = req.nextUrl.searchParams.get('sigunguCode') || ''
  const lawdCode = req.nextUrl.searchParams.get('lawdCode') || ''

  let complexIds: string[] | null = null

  if (q) {
    const normalizedQ = normalizeKeyword(q)

    const { data: aliasMatches, error: aliasError } = await supabase
      .from('complex_aliases')
      .select('complex_id')
      .ilike('alias_normalized', `%${normalizedQ}%`)

    if (aliasError) {
      return NextResponse.json({
        message: '별칭 검색 실패',
        error: aliasError.message,
      })
    }

    complexIds = [...new Set((aliasMatches || []).map((row) => row.complex_id))]
  }

  let query = supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (complexIds && complexIds.length > 0) {
    query = query.in('complex_id', complexIds)
  } else if (q) {
    query = query.ilike('apartment_name', `%${q}%`)
  }

  if (dong) {
    query = query.ilike('dong', `%${dong}%`)
  }

  if (lawdCode) {
    query = query.eq('lawd_code', lawdCode)
  } else if (sigunguCode) {
    query = query.like('lawd_code', `${sigunguCode}%`)
  } else if (sidoCode) {
    query = query.like('lawd_code', `${sidoCode}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({
      message: '조회 실패',
      error: error.message,
    })
  }

  return NextResponse.json({
    message: '조회 성공',
    data,
  })
}