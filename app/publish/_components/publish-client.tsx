'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { PublishRange, PublishTransactionItem } from '../_lib/publish-utils'
import {
  buildBriefing,
  buildPublishHtml,
  buildStats,
  formatAreaM2,
  formatDateKorean,
  formatDealDate,
  formatKoreanPrice,
  formatPyeong,
  formatPriceForTable,
  formatRoadAddress,
  getRangeShortLabel,
  getRangeSubLabel,
  getTop5ByPrice,
} from '../_lib/publish-utils'

type Props = {
  regionName: string
  range: PublishRange
  items: PublishTransactionItem[]
  baseDateIso: string
  basePath: string
}

function RangeTab({
  href,
  active,
  label,
}: {
  href: string
  active: boolean
  label: string
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'bg-gray-900 text-white'
          : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {label}
    </Link>
  )
}

function SectionTitle({
  children,
  right,
}: {
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold tracking-tight text-gray-900">{children}</h2>
      {right}
    </div>
  )
}

function ComplexName({
  item,
  className = '',
}: {
  item: PublishTransactionItem
  className?: string
}) {
  const name = item.apartment_name || '-'

  if (!item.complex_id) {
    return <span className={className}>{name}</span>
  }

  return (
    <Link
      href={`/complex/${item.complex_id}`}
      className={`${className} text-blue-700 hover:text-blue-900 hover:underline`}
    >
      {name}
    </Link>
  )
}

export default function PublishClient({
  regionName,
  range,
  items,
  baseDateIso,
  basePath,
}: Props) {
  const baseDate = useMemo(() => new Date(baseDateIso), [baseDateIso])

  const htmlBody = useMemo(() => {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000'

    return buildPublishHtml({
      regionName,
      range,
      items,
      baseDate,
      siteOrigin: origin,
      basePath,
    })
  }, [regionName, range, items, baseDate])

  const stats = useMemo(() => buildStats(items), [items])
  const top5 = useMemo(() => getTop5ByPrice(items), [items])
  const briefings = useMemo(
    () => buildBriefing(regionName, items),
    [regionName, items]
  )

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm">
          <div className="px-6 py-8 md:px-8 md:py-8">
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 md:text-4xl">
                  {regionName} 실거래 리포트
                </h1>
                <p className="mt-3 text-sm text-gray-500 md:text-base">
                  {formatDateKorean(baseDate)} · {getRangeSubLabel(range)}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 bg-white px-5 py-4 md:px-8">
            <div className="flex flex-wrap gap-2">
              <RangeTab
                href={`${basePath}/today`}
                active={range === 'today'}
                label="오늘"
              />
              <RangeTab
                href={`${basePath}/week`}
                active={range === 'week'}
                label="최근 1주일"
              />
              <RangeTab
                href={`${basePath}/month`}
                active={range === 'month'}
                label="최근 1개월"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold text-gray-400">총 거래 건수</div>
            <div className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900">
              {stats.totalCount.toLocaleString()}건
            </div>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold text-gray-400">평균 거래가</div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900">
              {stats.avgPrice ? formatKoreanPrice(stats.avgPrice) : '-'}
            </div>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold text-gray-400">대표 면적대</div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
              {stats.commonAreaBand}
            </div>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold text-gray-400">발행 구분</div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
              {getRangeShortLabel(range)}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <SectionTitle>오늘의 브리핑</SectionTitle>
          <div className="space-y-3">
            {briefings.map((line, index) => (
              <div
                key={index}
                className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-7 text-blue-900"
              >
                {line}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <SectionTitle
            right={
              <span className="text-xs font-medium text-gray-400">
                {getRangeSubLabel(range)}
              </span>
            }
          >
            {regionName} 매매가 TOP 5
          </SectionTitle>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse overflow-hidden rounded-2xl">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="px-4 py-3 text-center text-sm font-semibold">순위</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">단지명</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">매매가</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">전용면적</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">층수</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">거래일</th>
                </tr>
              </thead>
              <tbody>
                {top5.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="border-b border-gray-100 px-4 py-6 text-center text-sm text-gray-500"
                    >
                      표시할 거래가 없습니다.
                    </td>
                  </tr>
                ) : (
                  top5.map((item, index) => (
                    <tr
                      key={`${item.id || index}-${item.apartment_name || 'top5'}`}
                      className="border-b border-gray-100"
                    >
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-gray-900 px-2 text-xs font-bold text-white">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold">
                          <ComplexName item={item} />
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {formatRoadAddress(item)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-base font-extrabold text-rose-600">
                        {formatKoreanPrice(item.price_krw)}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-700">
                        {formatAreaM2(item.area_m2)} / {formatPyeong(item.area_m2)}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-700">
                        {item.floor ? `${item.floor}층` : '-'}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-700">
                        {formatDealDate(
                          item.deal_year,
                          item.deal_month,
                          item.deal_day
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm md:p-6">
            <SectionTitle
              right={
                <span className="text-xs font-medium text-gray-400">
                  최근 등록 순
                </span>
              }
            >
              {regionName} 최근 등록 거래
            </SectionTitle>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse overflow-hidden rounded-2xl">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="px-4 py-3 text-left text-sm font-semibold">단지명</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">면적</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">거래가</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">층수</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">거래일</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="border-b border-gray-100 px-4 py-6 text-center text-sm text-gray-500"
                      >
                        해당 조건의 거래가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    items.slice(0, 15).map((item, index) => (
                      <tr
                        key={`${item.id || index}-${item.apartment_name || 'list'}`}
                        className="border-b border-gray-100"
                      >
                        <td className="px-4 py-4">
                          <div className="font-medium">
                            <ComplexName item={item} />
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {item.umd_name || '-'} · {formatRoadAddress(item)}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center text-sm text-gray-700">
                          {formatAreaM2(item.area_m2)}
                        </td>
                        <td className="px-4 py-4 text-center text-sm font-bold text-rose-600">
                          {formatPriceForTable(item.price_krw)}억
                        </td>
                        <td className="px-4 py-4 text-center text-sm text-gray-700">
                          {item.floor ? `${item.floor}층` : '-'}
                        </td>
                        <td className="px-4 py-4 text-center text-sm text-gray-700">
                          {formatDealDate(
                            item.deal_year,
                            item.deal_month,
                            item.deal_day
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm md:p-6">
              <SectionTitle>핵심 요약</SectionTitle>
              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <div className="mb-1 text-xs font-semibold text-gray-400">
                    가장 높은 거래
                  </div>
                  <div>
                    {stats.highest ? formatKoreanPrice(stats.highest.price_krw) : '-'}
                  </div>
                  <div className="mt-1 text-xs">
                    {stats.highest ? <ComplexName item={stats.highest} /> : '-'}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-xs font-semibold text-gray-400">
                    가장 낮은 거래
                  </div>
                  <div>
                    {stats.lowest ? formatKoreanPrice(stats.lowest.price_krw) : '-'}
                  </div>
                  <div className="mt-1 text-xs">
                    {stats.lowest ? <ComplexName item={stats.lowest} /> : '-'}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm md:p-6">
              <SectionTitle>거래 많은 단지</SectionTitle>
              <div className="space-y-2">
                {stats.popularComplexes.length === 0 ? (
                  <div className="text-sm text-gray-500">표시할 데이터가 없습니다.</div>
                ) : (
                  stats.popularComplexes.map(([name, count]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-3"
                    >
                      <span className="font-medium text-gray-800">{name}</span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-500">
                        {count}건
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-blue-100 bg-blue-50 p-5 shadow-sm md:p-6">
              <SectionTitle>게시판 업로드 팁</SectionTitle>
              <div className="space-y-2 text-sm leading-7 text-blue-900/90">
                <div>
                  • 제목은 지역명 + 대표 단지 1~2개까지만 남기면 더 깔끔합니다.
                </div>
                <div>
                  • 본문은 TOP5와 최근 거래 5~10건만 남겨도 충분히 보기 좋습니다.
                </div>
                <div>
                  • 하단 요약 문구는 남겨두는 편이 신뢰감과 완성도가 좋습니다.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <SectionTitle>게시판용 본문</SectionTitle>

          <div
            className="rounded-2xl bg-gray-50 p-5 text-[15px] leading-8 text-gray-800"
            dangerouslySetInnerHTML={{ __html: htmlBody }}
          />
        </section>
      </div>
    </main>
  )
}