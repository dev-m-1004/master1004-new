import { NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    const serviceKey = encodeURIComponent(process.env.MOLIT_API_KEY!)

    const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${serviceKey}&LAWD_CD=11110&DEAL_YMD=202401`

    const res = await fetch(url)
    const xmlText = await res.text()

    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: true,
      trimValues: true,
    })

    const parsed = parser.parse(xmlText)
    const items = parsed?.response?.body?.items?.item

    if (!items) {
      return NextResponse.json({
        message: '데이터 없음',
      })
    }

    const itemList = Array.isArray(items) ? items : [items]

    const rows = itemList.map((item: any) => ({
      source_type: 'sale',
      complex_name: item.aptNm ?? '',
      lawd_code: '11110',

      apt_seq: item.aptSeq ? String(item.aptSeq) : null,
      road_name: item.roadNm ?? '',
      road_bonbun: item.roadNmBonbun ?? '',
      road_bubun: item.roadNmBubun ?? '',
      umd_name: item.umdNm ?? '',
      complex_id: null,

      deal_year: Number(item.dealYear ?? 0),
      deal_month: Number(item.dealMonth ?? 0),
      deal_day: Number(item.dealDay ?? 0),
      area_m2: Number(item.excluUseAr ?? 0),
      floor: String(item.floor ?? ''),
      price_krw: Number(String(item.dealAmount ?? '0').replace(/,/g, '')),
      deposit_krw: null,
      monthly_rent_krw: null,
      build_year: Number(item.buildYear ?? 0),
      jibun: item.jibun ?? '',
      dong: item.umdNm ?? '',
      apartment_name: item.aptNm ?? '',
      raw_data: item,
    }))

    const { error } = await supabase
      .from('transactions')
      .upsert(rows, {
        onConflict:
          'lawd_code,apartment_name,deal_year,deal_month,deal_day,area_m2,floor,price_krw',
        ignoreDuplicates: true,
      })

    if (error) {
      return NextResponse.json({
        message: 'DB 저장 실패',
        error: error.message,
      })
    }

    return NextResponse.json({
      message: 'DB 저장 성공 🎉',
      count: rows.length,
      preview: rows.slice(0, 3),
    })
  } catch (error: any) {
    return NextResponse.json({
      message: '서버 오류',
      error: error.message,
    })
  }
}