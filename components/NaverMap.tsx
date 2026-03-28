'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    naver: any
  }
}

export default function NaverMap({
  name,
  address,
  areaAddress,
}: {
  name?: string
  address?: string
  areaAddress?: string
}) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!loaded) return
    if (!window.naver || !mapRef.current) return

    const naver = window.naver

    const map = new naver.maps.Map(mapRef.current, {
      center: new naver.maps.LatLng(37.5665, 126.9780),
      zoom: 15,
    })

    const candidates = [
      [address, name].filter(Boolean).join(' '),
      [areaAddress, name].filter(Boolean).join(' '),
      address || '',
      areaAddress || '',
      name || '',
    ]
      .map((item) => item.trim())
      .filter(Boolean)

    if (candidates.length === 0) {
      setErrorMessage('지도에 표시할 주소 정보가 없습니다.')
      return
    }

    function tryGeocode(index: number) {
      if (index >= candidates.length) {
        setErrorMessage('위치를 찾지 못했습니다.')
        return
      }

      const query = candidates[index]

      naver.maps.Service.geocode(
        { query },
        function (status: any, response: any) {
          if (
            status !== naver.maps.Service.Status.OK ||
            !response?.v2?.addresses?.length
          ) {
            tryGeocode(index + 1)
            return
          }

          const item = response.v2.addresses[0]
          const lat = Number(item.y)
          const lng = Number(item.x)
          const position = new naver.maps.LatLng(lat, lng)

          map.setCenter(position)

          const marker = new naver.maps.Marker({
            position,
            map,
          })

          const infoWindow = new naver.maps.InfoWindow({
            content: `
              <div style="padding:10px 12px;min-width:180px;line-height:1.5;">
                <div style="font-weight:700;">${name || '단지 위치'}</div>
                <div style="margin-top:4px;font-size:13px;color:#555;">
                  ${address || areaAddress || query}
                </div>
              </div>
            `,
          })

          infoWindow.open(map, marker)
        }
      )
    }

    tryGeocode(0)
  }, [loaded, name, address, areaAddress])

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}&submodules=geocoder`}
        onLoad={() => setLoaded(true)}
      />

      <div className="mt-8 rounded-2xl border p-4">
        <h2 className="text-lg font-semibold">단지 위치</h2>

        {errorMessage && (
          <div className="mt-3 text-sm text-red-500">{errorMessage}</div>
        )}

        <div
          ref={mapRef}
          style={{ width: '100%', height: '350px', marginTop: '16px' }}
        />
      </div>
    </>
  )
}