'use client'

import { useMemo } from 'react'
import type { PublishRange, PublishTransactionItem } from '../_lib/publish-utils'
import {
  buildBriefing,
  buildPublishTitle,
  buildStats,
  formatAreaM2,
  formatDateKorean,
  formatDealDate,
  formatKoreanPrice,
  formatPyeong,
  formatRoadAddress,
} from '../_lib/publish-utils'

type Props = {
  regionName: string
  range: PublishRange
  items: PublishTransactionItem[]
  baseDateIso: string
  basePath: string
}

export default function PublishClient({
  regionName,
  range,
  items,
  baseDateIso,
  basePath,
}: Props) {
  const baseDate = useMemo(() => new Date(baseDateIso), [baseDateIso])

  const boardTitle = useMemo(
    () => buildPublishTitle(regionName, range, items),
    [regionName, range, items]
  )

  const boardHtml = useMemo(() => {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000'

    return buildBoardHtml({
      regionName,
      range,
      items,
      baseDate,
      siteOrigin: origin,
      basePath,
    })
  }, [regionName, range, items, baseDate, basePath])

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
          <h1
            id="board-title"
            className="text-xl font-extrabold leading-8 tracking-tight text-gray-900 sm:text-3xl sm:leading-[1.45]"
          >
            {boardTitle}
          </h1>

          <div
            id="board-content"
            className="mt-5 rounded-2xl bg-gray-50 p-4 text-[15px] leading-8 text-gray-800 sm:mt-6 sm:p-6"
            dangerouslySetInnerHTML={{ __html: boardHtml }}
          />
        </section>
      </div>
    </main>
  )
}

function escapeHtml(value: string) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getRangeLabel(range: PublishRange) {
  if (range === 'today') return '오늘'
  if (range === 'week') return '최근 1주일'
  return '최근 1개월'
}

function getRangeIntro(range: PublishRange, regionName: string, baseDate: Date) {
  const dateText = formatDateKorean(baseDate)

  if (range === 'today') {
    return `${dateText} 기준 ${regionName}의 전일 등록 아파트 매매 실거래 현황입니다.`
  }

  if (range === 'week') {
    return `${dateText} 기준 ${regionName}의 최근 7일 등록 아파트 매매 실거래 현황입니다.`
  }

  return `${dateText} 기준 ${regionName}의 최근 30일 등록 아파트 매매 실거래 현황입니다.`
}

function buildComplexAnchor(item: PublishTransactionItem, siteOrigin: string) {
  const name = escapeHtml(String(item.apartment_name || '-'))
  if (!item.complex_id) return `<span>${name}</span>`

  const href = `${siteOrigin}/complex/${encodeURIComponent(String(item.complex_id))}`
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;text-decoration:none;font-weight:700;">${name}</a>`
}

function getTop5ByPrice(items: PublishTransactionItem[]) {
  return [...items]
    .filter((item) => Number(item.price_krw || 0) > 0)
    .sort((a, b) => Number(b.price_krw || 0) - Number(a.price_krw || 0))
    .slice(0, 5)
}

function buildBoardLinks(regionName: string, siteOrigin: string, basePath: string) {
  const links = [
    { label: `${regionName} 오늘의 실거래`, href: `${siteOrigin}${basePath}/today` },
    { label: `${regionName} 최근 일주일 실거래`, href: `${siteOrigin}${basePath}/week` },
    { label: `${regionName} 최근 1개월 실거래`, href: `${siteOrigin}${basePath}/month` },
  ]

  return `
  <div style="margin:0 0 18px 0;display:flex;flex-direction:column;gap:6px;">
    ${links
      .map(
        (item) =>
          `<a href="${item.href}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;text-decoration:underline;font-size:15px;">${escapeHtml(item.label)}</a>`
      )
      .join('')}
  </div>`
}

function buildBoardHtml({
  regionName,
  range,
  items,
  baseDate,
  siteOrigin,
  basePath,
}: {
  regionName: string
  range: PublishRange
  items: PublishTransactionItem[]
  baseDate: Date
  siteOrigin: string
  basePath: string
}) {
  const stats = buildStats(items)
  const briefings = buildBriefing(regionName, items)
  const top5 = getTop5ByPrice(items)
  const latest = items.slice(0, 10)

  const top5Rows =
    top5.length > 0
      ? top5
          .map(
            (item, index) => `
              <tr>
                <td style="padding:10px;border:1px solid #e5e7eb;text-align:center;">${index + 1}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;">${buildComplexAnchor(item, siteOrigin)}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;text-align:center;">${escapeHtml(formatAreaM2(item.area_m2))} / ${escapeHtml(formatPyeong(item.area_m2))}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;text-align:center;">${escapeHtml(item.floor ? `${item.floor}층` : '-')}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;text-align:center;color:#dc2626;font-weight:700;">${escapeHtml(formatKoreanPrice(item.price_krw))}</td>
              </tr>
            `
          )
          .join('')
      : `
        <tr>
          <td colspan="5" style="padding:16px;border:1px solid #e5e7eb;text-align:center;color:#6b7280;">표시할 거래가 없습니다.</td>
        </tr>
      `

  const latestRows =
    latest.length > 0
      ? latest
          .map(
            (item) => `
              <tr>
                <td style="padding:10px;border:1px solid #e5e7eb;">${buildComplexAnchor(item, siteOrigin)}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;text-align:center;">${escapeHtml(formatAreaM2(item.area_m2))}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;text-align:center;">${escapeHtml(item.floor ? `${item.floor}층` : '-')}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;text-align:center;color:#dc2626;font-weight:700;">${escapeHtml(formatKoreanPrice(item.price_krw))}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;text-align:center;">${escapeHtml(formatDealDate(item.deal_year, item.deal_month, item.deal_day))}</td>
              </tr>
            `
          )
          .join('')
      : `
        <tr>
          <td colspan="5" style="padding:16px;border:1px solid #e5e7eb;text-align:center;color:#6b7280;">표시할 거래가 없습니다.</td>
        </tr>
      `

  const popularText =
    stats.popularComplexes.length > 0
      ? stats.popularComplexes
          .map(([name, count]) => `${escapeHtml(name)}(${count}건)`)
          .join(', ')
      : '-'

  return `
<div style="font-family:'Segoe UI',Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.7;color:#111827;">
  <p style="margin:0 0 18px 0;font-size:16px;">${escapeHtml(getRangeIntro(range, regionName, baseDate))}</p>

  <div style="border:1px solid #dbeafe;background:#eff6ff;border-radius:14px;padding:16px 18px;margin:0 0 20px 0;">
    <div style="font-weight:800;margin-bottom:10px;">핵심 브리핑</div>
    <div>${escapeHtml(briefings[0] || '-')}</div>
    <div>${escapeHtml(briefings[1] || '-')}</div>
    <div>${escapeHtml(briefings[2] || '-')}</div>
  </div>

  <h3 style="font-size:22px;margin:26px 0 12px 0;">최근 등록 거래</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
    <thead>
      <tr style="background:#f3f4f6;color:#111827;">
        <th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">단지명</th>
        <th style="padding:10px;border:1px solid #e5e7eb;">전용면적</th>
        <th style="padding:10px;border:1px solid #e5e7eb;">층수</th>
        <th style="padding:10px;border:1px solid #e5e7eb;">매매가</th>
        <th style="padding:10px;border:1px solid #e5e7eb;">거래일</th>
      </tr>
    </thead>
    <tbody>
      ${latestRows}
    </tbody>
  </table>

  <h3 style="font-size:22px;margin:26px 0 12px 0;">매매가 TOP 5</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
    <thead>
      <tr style="background:#111827;color:#fff;">
        <th style="padding:10px;border:1px solid #e5e7eb;">순위</th>
        <th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">단지명</th>
        <th style="padding:10px;border:1px solid #e5e7eb;">면적</th>
        <th style="padding:10px;border:1px solid #e5e7eb;">층수</th>
        <th style="padding:10px;border:1px solid #e5e7eb;">매매가</th>
      </tr>
    </thead>
    <tbody>
      ${top5Rows}
    </tbody>
  </table>

  ${buildBoardLinks(regionName, siteOrigin, basePath)}

  <div style="border:1px solid #e5e7eb;background:#fafafa;border-radius:14px;padding:16px 18px;">
    <div style="font-weight:800;margin-bottom:10px;">핵심 요약</div>
    <div>총 실거래 건수: ${stats.totalCount.toLocaleString()}건</div>
    <div>평균 거래금액: ${escapeHtml(stats.avgPrice ? formatKoreanPrice(stats.avgPrice) : '-')}</div>
    <div>가장 높은 거래: ${escapeHtml(stats.highest ? `${stats.highest.apartment_name || '-'}, ${formatKoreanPrice(stats.highest.price_krw)}, ${formatAreaM2(stats.highest.area_m2)}, ${stats.highest.floor ? `${stats.highest.floor}층` : '-'}` : '-')}</div>
    <div>가장 낮은 거래: ${escapeHtml(stats.lowest ? `${stats.lowest.apartment_name || '-'}, ${formatKoreanPrice(stats.lowest.price_krw)}, ${formatAreaM2(stats.lowest.area_m2)}, ${stats.lowest.floor ? `${stats.lowest.floor}층` : '-'}` : '-')}</div>
    <div>거래가 많았던 단지: ${popularText}</div>
    <div>많이 거래된 면적대: ${escapeHtml(stats.commonAreaBand)}</div>
    <div style="margin-top:10px;">관심 단지를 중심으로 최근 거래 흐름을 참고해보세요.</div>
  </div>

  <div style="margin-top:18px;font-size:13px;color:#6b7280;">구분: ${escapeHtml(getRangeLabel(range))} · 기준일: ${escapeHtml(formatDateKorean(baseDate))}</div>
</div>
`
}
