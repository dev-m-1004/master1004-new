'use client'

import { useEffect, useState } from 'react'

function formatKoreanPrice(value: number) {
  const eok = Math.floor(value / 10000)
  const man = value % 10000

  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString()}만 원`
  if (eok > 0) return `${eok}억 원`
  return `${man.toLocaleString()}만 원`
}

type DongItem = {
  lawd_code: string
  eupmyeondong_name: string
}

export default function Home() {
  const [data, setData] = useState<any[]>([])
  const [keyword, setKeyword] = useState('')

  const [sidoList, setSidoList] = useState<string[]>([])
  const [sigunguList, setSigunguList] = useState<string[]>([])
  const [dongList, setDongList] = useState<DongItem[]>([])

  const [selectedSido, setSelectedSido] = useState('')
  const [selectedSigungu, setSelectedSigungu] = useState('')
  const [selectedDong, setSelectedDong] = useState('')
  const [selectedLawdCode, setSelectedLawdCode] = useState('')

  async function fetchData() {
    const params = new URLSearchParams()

    if (keyword) params.set('q', keyword)
    if (selectedLawdCode) params.set('lawdCode', selectedLawdCode)
    if (selectedDong) params.set('dong', selectedDong)

    const res = await fetch(`/api/list?${params.toString()}`)
    const json = await res.json()
    setData(json.data || [])
  }

  async function loadSido() {
    const res = await fetch('/api/regions/sido')
    const json = await res.json()
    setSidoList(json.data || [])
  }

  async function loadSigungu(sido: string) {
    const res = await fetch(`/api/regions/sigungu?sido=${encodeURIComponent(sido)}`)
    const json = await res.json()
    setSigunguList(json.data || [])
  }

  async function loadDong(sido: string, sigungu: string) {
    const res = await fetch(
      `/api/regions/dong?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}`
    )
    const json = await res.json()
    setDongList(json.data || [])
  }

  useEffect(() => {
    loadSido()
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedSido) {
      loadSigungu(selectedSido)
    } else {
      setSigunguList([])
    }

    setSelectedSigungu('')
    setSelectedDong('')
    setSelectedLawdCode('')
    setDongList([])
  }, [selectedSido])

  useEffect(() => {
    if (selectedSido && selectedSigungu) {
      loadDong(selectedSido, selectedSigungu)
    } else {
      setDongList([])
    }

    setSelectedDong('')
    setSelectedLawdCode('')
  }, [selectedSido, selectedSigungu])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData()
    }, 400)

    return () => clearTimeout(timer)
  }, [keyword, selectedLawdCode, selectedDong])

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold">master1004 실거래가</h1>
        <p className="mt-2 text-sm text-gray-500">
          국토교통부 실거래가 데이터를 기반으로 단지별 거래를 조회합니다.
        </p>
        <div className="mt-6 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="단지명"
            className="rounded-xl border px-4 py-3"
          />

          <select
            value={selectedSido}
            onChange={(e) => setSelectedSido(e.target.value)}
            className="rounded-xl border px-4 py-3"
          >
            <option value="">시/도 선택</option>
            {sidoList.map((sido) => (
              <option key={sido} value={sido}>
                {sido}
              </option>
            ))}
          </select>

          <select
            value={selectedSigungu}
            onChange={(e) => setSelectedSigungu(e.target.value)}
            className="rounded-xl border px-4 py-3"
          >
            <option value="">시/군/구 선택</option>
            {sigunguList.map((sigungu) => (
              <option key={sigungu} value={sigungu}>
                {sigungu}
              </option>
            ))}
          </select>

          <select
            value={selectedDong}
            onChange={(e) => {
              const value = e.target.value
              const selected = dongList.find((d) => d.eupmyeondong_name === value)

              setSelectedDong(value)
              setSelectedLawdCode(selected?.lawd_code || '')
            }}
            className="rounded-xl border px-4 py-3"
          >
            <option value="">법정동 선택</option>
            {dongList.map((dong) => (
              <option key={dong.lawd_code} value={dong.eupmyeondong_name}>
                {dong.eupmyeondong_name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setKeyword('')
              setSelectedSido('')
              setSelectedSigungu('')
              setSelectedDong('')
              setSelectedLawdCode('')
              setDongList([])
              setSigunguList([])
            }}
            className="rounded-xl border px-4 py-3 cursor-pointer"
          >
            초기화
          </button>
        </div>

        <div className="mt-8 grid gap-4">
  {data.length === 0 ? (
    <div className="rounded-2xl border p-8 text-center text-gray-500">
      검색 결과가 없습니다.
    </div>
  ) : (
    data.map((item, i) => (
      <div
        key={i}
        className="rounded-2xl border p-5 transition hover:shadow-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {item.complex_id ? (
              <a
                href={`/complex/${item.complex_id}`}
                className="text-xl font-bold text-blue-600 hover:underline"
              >
                {item.apartment_name}
              </a>
            ) : (
              <div className="text-xl font-bold">{item.apartment_name}</div>
            )}

            <div className="mt-2 text-sm text-gray-500">
              법정동: {item.umd_name || item.dong || '-'} / 코드: {item.lawd_code}
            </div>

            <div className="mt-1 text-sm text-gray-500">
              거래일: {item.deal_year}.{item.deal_month}.{item.deal_day}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-2xl font-bold">
              {formatKoreanPrice(item.price_krw)}
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {item.area_m2}㎡ / {item.floor}층
            </div>
          </div>
        </div>
      </div>
    ))
  )}
</div>
      </div>
    </main>
  )
}