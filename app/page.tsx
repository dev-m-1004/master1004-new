'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

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

type SortType = 'latest' | 'price_desc' | 'price_asc'

const ITEMS_PER_PAGE = 30

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

  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [sortType, setSortType] = useState<SortType>('latest')
  const [currentPage, setCurrentPage] = useState(1)

  async function loadInitialData() {
    try {
      setLoading(true)

      const res = await fetch('/api/list')
      const json = await res.json()
      setData(json.data || [])
      setCurrentPage(1)
    } catch (error) {
      console.error('초기 목록 조회 실패', error)
      setData([])
      setCurrentPage(1)
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }

  async function fetchData() {
    try {
      setLoading(true)

      const params = new URLSearchParams()

      if (keyword.trim()) params.set('q', keyword.trim())
      if (selectedLawdCode) params.set('lawdCode', selectedLawdCode)
      if (selectedDong) params.set('dong', selectedDong)

      if (!params.toString()) {
        const res = await fetch('/api/list')
        const json = await res.json()
        setData(json.data || [])
        setCurrentPage(1)
        return
      }

      const res = await fetch(`/api/list?${params.toString()}`)
      const json = await res.json()
      setData(json.data || [])
      setCurrentPage(1)
    } catch (error) {
      console.error('목록 조회 실패', error)
      setData([])
      setCurrentPage(1)
    } finally {
      setLoading(false)
    }
  }

  async function loadSido() {
    try {
      const res = await fetch('/api/regions/sido')
      const json = await res.json()
      setSidoList(json.data || [])
    } catch (error) {
      console.error('시도 목록 조회 실패', error)
      setSidoList([])
    }
  }

  async function loadSigungu(sido: string) {
    try {
      const res = await fetch(
        `/api/regions/sigungu?sido=${encodeURIComponent(sido)}`
      )
      const json = await res.json()
      setSigunguList(json.data || [])
    } catch (error) {
      console.error('시군구 목록 조회 실패', error)
      setSigunguList([])
    }
  }

  async function loadDong(sido: string, sigungu: string) {
    try {
      const res = await fetch(
        `/api/regions/dong?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}`
      )
      const json = await res.json()
      setDongList(json.data || [])
    } catch (error) {
      console.error('법정동 목록 조회 실패', error)
      setDongList([])
    }
  }

  function getDealTime(item: any) {
    const year = Number(item.deal_year || 0)
    const month = Number(item.deal_month || 0)
    const day = Number(item.deal_day || 0)

    return new Date(year, month - 1, day).getTime()
  }

  const sortedData = useMemo(() => {
    const copied = [...data]

    if (sortType === 'latest') {
      return copied.sort((a, b) => getDealTime(b) - getDealTime(a))
    }

    if (sortType === 'price_desc') {
      return copied.sort(
        (a, b) => Number(b.price_krw || 0) - Number(a.price_krw || 0)
      )
    }

    if (sortType === 'price_asc') {
      return copied.sort(
        (a, b) => Number(a.price_krw || 0) - Number(b.price_krw || 0)
      )
    }

    return copied
  }, [data, sortType])

  const totalPages = Math.max(1, Math.ceil(sortedData.length / ITEMS_PER_PAGE))

  const pagedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return sortedData.slice(startIndex, endIndex)
  }, [sortedData, currentPage])

  useEffect(() => {
    loadSido()
    loadInitialData()
  }, [])

  useEffect(() => {
    if (!initialized) return

    if (selectedSido) {
      loadSigungu(selectedSido)
    } else {
      setSigunguList([])
    }

    setSelectedSigungu('')
    setSelectedDong('')
    setSelectedLawdCode('')
    setDongList([])
    setCurrentPage(1)
  }, [selectedSido, initialized])

  useEffect(() => {
    if (!initialized) return

    if (selectedSido && selectedSigungu) {
      loadDong(selectedSido, selectedSigungu)
    } else {
      setDongList([])
    }

    setSelectedDong('')
    setSelectedLawdCode('')
    setCurrentPage(1)
  }, [selectedSido, selectedSigungu, initialized])

  useEffect(() => {
    if (!initialized) return

    const timer = setTimeout(() => {
      fetchData()
    }, 400)

    return () => clearTimeout(timer)
  }, [keyword, selectedLawdCode, selectedDong, initialized])

  useEffect(() => {
    setCurrentPage(1)
  }, [sortType])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">master1004 실거래가</h1>
          <p className="mt-2 text-sm text-gray-500">
            국토교통부 실거래가 데이터를 기반으로 단지별 거래를 조회합니다.
          </p>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="단지명 검색"
              className="h-12 rounded-xl border px-4 outline-none"
            />

            <select
              value={selectedSido}
              onChange={(e) => setSelectedSido(e.target.value)}
              className="h-12 rounded-xl border px-4 outline-none"
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
              className="h-12 rounded-xl border px-4 outline-none"
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
                const selected = dongList.find(
                  (d) => d.eupmyeondong_name === value
                )

                setSelectedDong(value)
                setSelectedLawdCode(selected?.lawd_code || '')
                setCurrentPage(1)
              }}
              className="h-12 rounded-xl border px-4 outline-none"
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
                setCurrentPage(1)
              }}
              className="cursor-pointer rounded-xl border px-4 py-3"
            >
              초기화
            </button>
          </div>
        </div>

        {loading && (
          <div className="mt-6 rounded-2xl border p-6 text-gray-500">
            불러오는 중...
          </div>
        )}

        {!loading && data.length > 0 && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-500">
              검색 결과 {data.length}건 · {currentPage}/{totalPages}페이지
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSortType('latest')}
                className={`rounded-full border px-4 py-2 text-sm ${
                  sortType === 'latest'
                    ? 'border-black bg-black text-white'
                    : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                최신 거래순
              </button>

              <button
                type="button"
                onClick={() => setSortType('price_desc')}
                className={`rounded-full border px-4 py-2 text-sm ${
                  sortType === 'price_desc'
                    ? 'border-black bg-black text-white'
                    : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                가격 높은순
              </button>

              <button
                type="button"
                onClick={() => setSortType('price_asc')}
                className={`rounded-full border px-4 py-2 text-sm ${
                  sortType === 'price_asc'
                    ? 'border-black bg-black text-white'
                    : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                가격 낮은순
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-4">
          {!loading && data.length === 0 ? (
            <div className="rounded-2xl border p-8 text-center text-gray-500">
              검색 결과가 없습니다.
            </div>
          ) : (
            pagedData.map((item, i) => (
              <div
                key={`${item.id || i}-${item.deal_year}-${item.deal_month}-${item.deal_day}`}
                className="rounded-2xl border p-5 transition hover:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {item.complex_id ? (
                      <Link
                        href={`/complex/${item.complex_id}`}
                        className="text-xl font-semibold hover:underline"
                      >
                        {item.apartment_name}
                      </Link>
                    ) : (
                      <div className="text-xl font-semibold">
                        {item.apartment_name}
                      </div>
                    )}

                    <div className="mt-2 space-y-1 text-sm text-gray-500">
                      <div>법정동: {item.umd_name || item.dong || '-'}</div>
                      <div>지역코드: {item.lawd_code || '-'}</div>
                      <div>
                        거래일: {item.deal_year}.
                        {String(item.deal_month).padStart(2, '0')}.
                        {String(item.deal_day).padStart(2, '0')}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-sm text-gray-500">거래가</div>
                    <div className="mt-1 text-xl font-bold text-orange-500">
                      {item.price_krw ? formatKoreanPrice(item.price_krw) : '-'}
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

        {!loading && data.length > 0 && totalPages > 1 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="rounded-xl border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              처음
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="rounded-xl border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              이전
            </button>

            <div className="px-3 py-2 text-sm text-gray-600">
              {currentPage} / {totalPages}
            </div>

            <button
              type="button"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
              className="rounded-xl border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              다음
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="rounded-xl border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              마지막
            </button>
          </div>
        )}
      </div>
    </main>
  )
}