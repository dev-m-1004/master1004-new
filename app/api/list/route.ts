import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const sido = url.searchParams.get('sido')

    if (!sido) {
      return NextResponse.json({ ok: false, error: 'sido required' }, { status: 400 })
    }

    // 지역코드 prefix 매핑 (간단 버전)
    const sidoMap: Record<string, string> = {
      서울특별시: '11',
      부산광역시: '26',
      대구광역시: '27',
      인천광역시: '28',
      광주광역시: '29',
      대전광역시: '30',
      울산광역시: '31',
      세종특별자치시: '36',
      경기도: '41',
      강원특별자치도: '42',
      충청북도: '43',
      충청남도: '44',
      전북특별자치도: '45',
      전라남도: '46',
      경상북도: '47',
      경상남도: '48',
      제주특별자치도: '50',
    }

    const prefix = sidoMap[sido]

    if (!prefix) {
      return NextResponse.json({ ok: false, error: 'invalid sido' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .like('lawd_code', `${prefix}%`)
      .order('deal_year', { ascending: false })
      .order('deal_month', { ascending: false })
      .order('deal_day', { ascending: false })
      .limit(30)

    if (error) throw error

    return NextResponse.json({
      ok: true,
      data,
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}