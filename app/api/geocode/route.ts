import { NextResponse } from 'next/server'

type NaverGeocodeAddress = {
  roadAddress?: string
  jibunAddress?: string
  englishAddress?: string
  x?: string
  y?: string
}

type NaverGeocodeResponse = {
  status?: string
  meta?: {
    totalCount?: number
  }
  addresses?: NaverGeocodeAddress[]
  errorMessage?: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')?.trim()

    if (!query) {
      return NextResponse.json(
        { ok: false, error: 'query 파라미터가 필요합니다.' },
        { status: 400 }
      )
    }

    const clientId = process.env.NAVER_MAP_CLIENT_ID
    const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { ok: false, error: '네이버 지도 서버 환경변수가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    const url = `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-ncp-apigw-api-key-id': clientId,
        'x-ncp-apigw-api-key': clientSecret,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    const data = (await response.json()) as NaverGeocodeResponse

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: data?.errorMessage || '네이버 geocode 호출 실패',
          status: response.status,
        },
        { status: response.status }
      )
    }

    const first = data.addresses?.[0]

    if (!first?.x || !first?.y) {
      return NextResponse.json(
        {
          ok: false,
          error: '좌표를 찾지 못했습니다.',
          query,
          addresses: data.addresses ?? [],
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ok: true,
      query,
      address: {
        roadAddress: first.roadAddress ?? '',
        jibunAddress: first.jibunAddress ?? '',
        englishAddress: first.englishAddress ?? '',
      },
      location: {
        lng: Number(first.x),
        lat: Number(first.y),
      },
    })
  } catch (error) {
    console.error('[GEOCODE_API_ERROR]', error)

    return NextResponse.json(
      { ok: false, error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}