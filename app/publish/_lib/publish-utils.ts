export type PublishRange = 'today' | 'week' | 'month'

export type PublishTransactionItem = {
  id?: string | number
  complex_id?: string | null
  apartment_name?: string | null
  price_krw?: number | null
  area_m2?: number | null
  floor?: number | null
  deal_year?: number | null
  deal_month?: number | null
  deal_day?: number | null
  umd_name?: string | null
  road_name?: string | null
  road_bonbun?: string | null
  road_bubun?: string | null
  created_at?: string | null
}

export function getRangeLabel(range: PublishRange) {
  if (range === 'today') return '오늘의 아파트 실거래'
  if (range === 'week') return '최근 일주일 아파트 실거래'
  return '최근 1개월 아파트 실거래'
}

export function getRangeShortLabel(range: PublishRange) {
  if (range === 'today') return '오늘'
  if (range === 'week') return '1주일'
  return '1개월'
}

export function getRangeSubLabel(range: PublishRange) {
  if (range === 'today') return '전일 등록 기준'
  if (range === 'week') return '최근 7일 등록 기준'
  return '최근 30일 등록 기준'
}

export function formatDateKorean(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
}

export function formatDealDate(
  year?: number | null,
  month?: number | null,
  day?: number | null
) {
  if (!year || !month || !day) return '-'
  return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`
}

export function formatKoreanPrice(value?: number | null) {
  const amount = Number(value || 0)
  if (!amount) return '-'

  const eok = Math.floor(amount / 10000)
  const man = amount % 10000

  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString()}`
  if (eok > 0) return `${eok}억`
  return `${man.toLocaleString()}`
}

export function formatPriceForTable(value?: number | null) {
  const amount = Number(value || 0)
  if (!amount) return '-'

  const eok = Math.floor(amount / 10000)
  const man = amount % 10000

  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString()}`
  if (eok > 0) return `${eok}억`
  return `${man.toLocaleString()}`
}

export function formatAreaM2(value?: number | null) {
  const num = Number(value || 0)
  if (!num) return '-'
  return `${num.toFixed(2)}㎡`
}

export function formatPyeong(value?: number | null) {
  const num = Number(value || 0)
  if (!num) return '-'
  return `${Math.round(num / 3.3058)}평`
}

export function formatRoadAddress(item: PublishTransactionItem) {
  const roadName = String(item.road_name || '').trim()
  const bonbun = String(item.road_bonbun || '').trim()
  const bubun = String(item.road_bubun || '').trim()

  if (!roadName) return item.umd_name || '-'

  if (bonbun && bubun && bubun !== '0' && bubun !== '0000') {
    return `${roadName} ${Number(bonbun)}-${Number(bubun)}`
  }

  if (bonbun) return `${roadName} ${Number(bonbun)}`
  return roadName
}

export function formatListLine(item: PublishTransactionItem) {
  const name = item.apartment_name || '-'
  const area = formatAreaM2(item.area_m2)
  const pyeong = formatPyeong(item.area_m2)
  const floor = item.floor ? `${item.floor}층` : '-'
  const price = formatKoreanPrice(item.price_krw)

  return `${name} / ${area} / ${pyeong} / ${floor} / ${price}`
}

function getComplexFrequency(items: PublishTransactionItem[]) {
  const map = new Map<string, number>()

  for (const item of items) {
    const name = String(item.apartment_name || '').trim()
    if (!name) continue
    map.set(name, (map.get(name) || 0) + 1)
  }

  return Array.from(map.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0], 'ko')
  })
}

export function getTopComplexNames(items: PublishTransactionItem[], limit = 2) {
  return getComplexFrequency(items)
    .slice(0, limit)
    .map(([name]) => name)
}

export function buildPublishTitle(
  regionName: string,
  range: PublishRange,
  items: PublishTransactionItem[]
) {
  const leaders = getTopComplexNames(items, 2)
  const prefix = `${regionName} ${getRangeLabel(range)} 현황`

  if (leaders.length > 0) return `${prefix}, ${leaders.join(', ')}`
  return prefix
}

export function getAveragePrice(items: PublishTransactionItem[]) {
  const values = items
    .map((item) => Number(item.price_krw || 0))
    .filter((value) => value > 0)

  if (!values.length) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function getMostCommonAreaBand(items: PublishTransactionItem[]) {
  const map = new Map<string, number>()

  for (const item of items) {
    const area = Number(item.area_m2 || 0)
    if (!area) continue

    let key = '기타'
    if (area < 40) key = '40㎡ 미만'
    else if (area < 60) key = '40~59㎡'
    else if (area < 85) key = '60~84㎡'
    else if (area < 100) key = '85~99㎡'
    else key = '100㎡ 이상'

    map.set(key, (map.get(key) || 0) + 1)
  }

  const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] || '-'
}

export function buildStats(items: PublishTransactionItem[]) {
  const validPriceItems = items
    .filter((item) => Number(item.price_krw || 0) > 0)
    .sort((a, b) => Number(b.price_krw || 0) - Number(a.price_krw || 0))

  const highest = validPriceItems[0] || null
  const lowest = validPriceItems[validPriceItems.length - 1] || null
  const avgPrice = getAveragePrice(items)
  const popularComplexes = getComplexFrequency(items).slice(0, 3)
  const commonAreaBand = getMostCommonAreaBand(items)

  return {
    totalCount: items.length,
    avgPrice,
    highest,
    lowest,
    popularComplexes,
    commonAreaBand,
  }
}

export function getTop5ByPrice(items: PublishTransactionItem[]) {
  return [...items]
    .filter((item) => Number(item.price_krw || 0) > 0)
    .sort((a, b) => Number(b.price_krw || 0) - Number(a.price_krw || 0))
    .slice(0, 5)
}

export function buildBriefing(regionName: string, items: PublishTransactionItem[]) {
  const stats = buildStats(items)
  const highestName = stats.highest?.apartment_name || '-'
  const lowestName = stats.lowest?.apartment_name || '-'
  const popular = stats.popularComplexes
    .slice(0, 2)
    .map(([name]) => name)
    .join(', ')

  return [
    `${regionName} 최근 등록 거래는 ${stats.commonAreaBand} 중심으로 확인됩니다.`,
    `최고 거래 단지는 ${highestName}, 최저 거래 단지는 ${lowestName}입니다.`,
    `거래가 많이 나온 단지는 ${popular || '-'} 입니다.`,
  ]
}

export function buildPublishBody(params: {
  regionName: string
  range: PublishRange
  items: PublishTransactionItem[]
  baseDate: Date
}) {
  const { regionName, range, items, baseDate } = params
  const dateText = formatDateKorean(baseDate)
  const stats = buildStats(items)
  const top5 = getTop5ByPrice(items)
  const latestList = items.slice(0, 10).map(formatListLine)

  const intro =
    range === 'today'
      ? `${dateText} 기준 ${regionName}의 전일 등록 아파트 매매 실거래 현황입니다.`
      : range === 'week'
        ? `${dateText} 기준 ${regionName}의 최근 7일 등록 아파트 매매 실거래 현황입니다.`
        : `${dateText} 기준 ${regionName}의 최근 30일 등록 아파트 매매 실거래 현황입니다.`

  const top5Lines =
    top5.length > 0
      ? top5.map((item, index) => `${index + 1}위 ${formatListLine(item)}`)
      : ['표시할 거래가 없습니다.']

  const popularText =
    stats.popularComplexes.length > 0
      ? stats.popularComplexes.map(([name, count]) => `${name}(${count}건)`).join(', ')
      : '-'

  return [
    buildPublishTitle(regionName, range, items),
    '',
    intro,
    '',
    '■ 핵심 브리핑',
    ...buildBriefing(regionName, items),
    '',
    '■ 최근 등록 거래',
    ...latestList,
    '',
    `■ 매매가 TOP 5 (${getRangeSubLabel(range)})`,
    ...top5Lines,
    '',
    `총 실거래 건수: ${stats.totalCount.toLocaleString()}건`,
    `평균 거래금액: ${stats.avgPrice ? formatKoreanPrice(stats.avgPrice) : '-'}`,
    `가장 높은 거래: ${stats.highest ? formatListLine(stats.highest) : '-'}`,
    `가장 낮은 거래: ${stats.lowest ? formatListLine(stats.lowest) : '-'}`,
    `거래가 많았던 단지: ${popularText}`,
    `많이 거래된 면적대: ${stats.commonAreaBand}`,
    '',
    '관심 단지를 중심으로 최근 거래 흐름을 참고해보세요.',
  ].join('\n')
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildComplexAnchor(item: PublishTransactionItem) {
  const name = escapeHtml(String(item.apartment_name || '-'))
  if (!item.complex_id) return `<span>${name}</span>`

  const href = `/complex/${encodeURIComponent(String(item.complex_id))}`
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;text-decoration:none;font-weight:700;">${name}</a>`
}

function buildPublishLinks(regionName: string, basePath: string) {
  const links = [
    { label: `${regionName} 오늘의 실거래`, href: `${basePath}/today` },
    { label: `${regionName} 최근 일주일 실거래`, href: `${basePath}/week` },
    { label: `${regionName} 최근 1개월 실거래`, href: `${basePath}/month` },
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

export function buildPublishHtml(params: {
  regionName: string
  range: PublishRange
  items: PublishTransactionItem[]
  baseDate: Date
  basePath: string
}) {
  const { regionName, range, items, baseDate, basePath } = params
  const title = escapeHtml(buildPublishTitle(regionName, range, items))
  const intro = escapeHtml(
    range === 'today'
      ? `${formatDateKorean(baseDate)} 기준 ${regionName}의 전일 등록 아파트 매매 실거래 현황입니다.`
      : range === 'week'
        ? `${formatDateKorean(baseDate)} 기준 ${regionName}의 최근 7일 등록 아파트 매매 실거래 현황입니다.`
        : `${formatDateKorean(baseDate)} 기준 ${regionName}의 최근 30일 등록 아파트 매매 실거래 현황입니다.`
  )

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
                <td style="padding:10px;border:1px solid #e5e7eb;">${buildComplexAnchor(item)}</td>
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
                <td style="padding:10px;border:1px solid #e5e7eb;">${buildComplexAnchor(item)}</td>
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
  <div style="padding:28px 24px;border-radius:20px;background:linear-gradient(135deg,#7c5cff 0%,#a78bfa 100%);color:#fff;margin-bottom:20px;">
    <div style="font-size:14px;opacity:0.9;">실거래마스터 - 최신 아파트 실거래정보</div>
    <div style="font-size:38px;font-weight:800;margin-top:10px;">${escapeHtml(regionName)}</div>
    <div style="font-size:30px;font-weight:800;">실거래 리포트</div>
    <div style="font-size:18px;margin-top:14px;">${escapeHtml(formatDateKorean(baseDate))}</div>
    <div style="font-size:14px;opacity:0.9;margin-top:4px;">${escapeHtml(getRangeSubLabel(range))} · ${escapeHtml(getRangeLabel(range))}</div>
  </div>

  <h2 style="font-size:26px;line-height:1.4;margin:0 0 14px 0;">${title}</h2>
  <p style="margin:0 0 18px 0;font-size:16px;">${intro}</p>

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

  ${buildPublishLinks(regionName, basePath)}

  <div style="border:1px solid #e5e7eb;background:#fafafa;border-radius:14px;padding:16px 18px;">
    <div style="font-weight:800;margin-bottom:10px;">핵심 요약</div>
    <div>총 실거래 건수: ${stats.totalCount.toLocaleString()}건</div>
    <div>평균 거래금액: ${escapeHtml(stats.avgPrice ? formatKoreanPrice(stats.avgPrice) : '-')}</div>
    <div>가장 높은 거래: ${escapeHtml(stats.highest ? formatListLine(stats.highest) : '-')}</div>
    <div>가장 낮은 거래: ${escapeHtml(stats.lowest ? formatListLine(stats.lowest) : '-')}</div>
    <div>거래가 많았던 단지: ${popularText}</div>
    <div>많이 거래된 면적대: ${escapeHtml(stats.commonAreaBand)}</div>
  </div>
</div>
`
}
