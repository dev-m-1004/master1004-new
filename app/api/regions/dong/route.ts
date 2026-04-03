import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function extractDongDisplayName(rawName: string) {
  const name = String(rawName || '').trim()
  if (!name) return ''

  const parts = name.split(/\s+/).filter(Boolean)
  const last = parts[parts.length - 1] || ''

  if (last.endsWith('동') || last.endsWith('리')) {
    return last
  }

  if (name.endsWith('동') || name.endsWith('리')) {
    return name
  }

  return ''
}

export async function GET(req: NextRequest) {
  const sido = req.nextUrl.searchParams.get('sido')
  const sigungu = req.nextUrl.searchParams.get('sigungu')

  if (!sido || !sigungu) {
    return NextResponse.json({ data: [] })
  }

  const { data, error } = await supabase
    .from('regions')
    .select('lawd_code, eupmyeondong_name')
    .eq('sido_name', sido)
    .eq('sigungu_name', sigungu)
    .not('eupmyeondong_name', 'is', null)

  if (error) {
    return NextResponse.json(
      {
        message: '조회 실패',
        error: error.message,
      },
      { status: 500 }
    )
  }

  const map = new Map<string, { lawd_code: string; eupmyeondong_name: string }>()

  for (const row of data || []) {
    const lawdCode = String(row.lawd_code || '').trim()
    const rawDongName = String(row.eupmyeondong_name || '').trim()

    if (!lawdCode || !rawDongName) continue

    const displayDongName = extractDongDisplayName(rawDongName)

    // 법정동 드롭다운에는 동/리만 노출
    if (!displayDongName) continue

    // 중복 제거: 표시명 기준
    if (!map.has(displayDongName)) {
      map.set(displayDongName, {
        lawd_code: lawdCode,
        eupmyeondong_name: displayDongName,
      })
    }
  }

  return NextResponse.json({
    data: Array.from(map.values()).sort((a, b) =>
      a.eupmyeondong_name.localeCompare(b.eupmyeondong_name, 'ko')
    ),
  })
}