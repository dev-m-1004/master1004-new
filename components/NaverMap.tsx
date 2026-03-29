'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const infoWindowRef = useRef<any>(null)
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [sdkReady, setSdkReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const candidates = useMemo(() => {
    return [
      [address, name].filter(Boolean).join(' '),
      [areaAddress, name].filter(Boolean).join(' '),
      address || '',
      areaAddress || '',
      name || '',
    ]
      .map((item) => item.trim())
      .filter(Boolean)
  }, [name, address, areaAddress])

  useEffect(() => {
    return () => {
      if (readyTimerRef.current) {
        clearTimeout(readyTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!sdkReady) return
    if (!mapRef.current) return

    const naver = window.naver
    if (!naver?.maps) return

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new naver.maps.Map(mapRef.current, {
        center: new naver.maps.LatLng(37.5665, 126.9780),
        zoom: 15,
      })
    }
  }, [sdkReady])

  useEffect(() => {
    if (!sdkReady) return
    if (!mapInstanceRef.current) return

    const naver = window.naver

    if (!naver?.maps?.Service?.geocode) {
      setErrorMessage('지도 서비스를 불러오는 중입니다.')
      return
    }

    if (candidates.length === 0) {
      setErrorMessage('지도에 표시할 주소 정보가 없습니다.')
      return
    }

    let cancelled = false
    setErrorMessage('')

    function clearOverlays() {
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }

      if (infoWindowRef.current) {
        infoWindowRef.current.close()
        infoWindowRef.current = null
      }
    }

    function tryGeocode(index: number) {
      if (cancelled) return

      if (index >= candidates.length) {
        setErrorMessage('위치를 찾지 못했습니다.')
        return
      }

      const query = candidates[index]

      naver.maps.Service.geocode({ query }, (status: any, response: any) => {
        if (cancelled) return

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

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          tryGeocode(index + 1)
          return
        }

        const position = new naver.maps.LatLng(lat, lng)
        const map = mapInstanceRef.current

        clearOverlays()

        map.setCenter(position)

        markerRef.current = new naver.maps.Marker({
          position,
          map,
        })

        infoWindowRef.current = new naver.maps.InfoWindow({
          content: `
            <div style="
              position: relative;
              min-width: 240px;
              max-width: 280px;
              padding: 0;
              border-radius: 18px;
              background: #ffffff;
              box-shadow: 0 10px 30px rgba(15, 23, 42, 0.16);
              border: 1px solid rgba(15, 23, 42, 0.08);
              overflow: visible;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif;
            ">
              <div style="
                padding: 14px 16px 12px;
              ">
                <div style="
                  display: inline-flex;
                  align-items: center;
                  gap: 6px;
                  margin-bottom: 8px;
                  padding: 4px 8px;
                  border-radius: 999px;
                  background: #f3f4f6;
                  color: #4b5563;
                  font-size: 11px;
                  font-weight: 700;
                  letter-spacing: 0.02em;
                ">
                  단지 위치
                </div>

                <div style="
                  font-size: 17px;
                  font-weight: 800;
                  color: #111827;
                  line-height: 1.35;
                  word-break: keep-all;
                ">
                  ${escapeHtml(name || '단지 위치')}
                </div>

                <div style="
                  margin-top: 8px;
                  font-size: 13px;
                  line-height: 1.55;
                  color: #6b7280;
                  word-break: keep-all;
                ">
                  ${escapeHtml(address || areaAddress || query)}
                </div>
              </div>

              <div style="
                position: absolute;
                left: 50%;
                bottom: -10px;
                width: 20px;
                height: 20px;
                background: #ffffff;
                border-right: 1px solid rgba(15, 23, 42, 0.08);
                border-bottom: 1px solid rgba(15, 23, 42, 0.08);
                transform: translateX(-50%) rotate(45deg);
                box-shadow: 8px 8px 16px rgba(15, 23, 42, 0.06);
              "></div>
            </div>
          `,
          borderWidth: 0,
          backgroundColor: 'transparent',
          disableAnchor: true,
          pixelOffset: new naver.maps.Point(0, -18),
        })

        infoWindowRef.current.open(map, markerRef.current)
        setErrorMessage('')
      })
    }

    tryGeocode(0)

    return () => {
      cancelled = true
    }
  }, [sdkReady, candidates])

  return (
    <>
      <Script
        id="naver-map-script"
        strategy="afterInteractive"
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}&submodules=geocoder`}
        onReady={() => {
          const waitForService = () => {
            if (window?.naver?.maps?.Service?.geocode) {
              setSdkReady(true)
              return
            }

            readyTimerRef.current = setTimeout(waitForService, 100)
          }

          waitForService()
        }}
      />

      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">단지 위치</h2>

        {errorMessage && (
          <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {errorMessage}
          </div>
        )}

        <div
          ref={mapRef}
          className="mt-4 w-full overflow-hidden rounded-2xl border border-gray-100"
          style={{ height: '380px' }}
        />
      </div>
    </>
  )
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}