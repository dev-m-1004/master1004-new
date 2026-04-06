import type { Metadata } from 'next'
import PublishClient from '../../../../_components/publish-client'
import { getPublishTransactions } from '../../../../_lib/publish-data'
import { buildPublishTitle, type PublishRange } from '../../../../_lib/publish-utils'

type PageProps = {
  params: Promise<{
    sido: string
    sigungu: string
    range: string
  }>
}

function isValidRange(value: string): value is PublishRange {
  return value === 'today' || value === 'week' || value === 'month'
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await params
  const sido = decodeURIComponent(resolved.sido)
  const sigungu = decodeURIComponent(resolved.sigungu)
  const range = resolved.range

  if (!isValidRange(range)) {
    return {
      title: '잘못된 배포 페이지',
      description: '올바르지 않은 배포 페이지 주소입니다.',
    }
  }

  const result = await getPublishTransactions({
    scope: 'sigungu',
    sido,
    sigungu,
    range,
  })

  const title = buildPublishTitle(result.regionName, range, result.items)

  return {
    title,
    description: `${result.regionName} 실거래를 커뮤니티 배포용 형식으로 정리한 페이지`,
  }
}

export default async function SigunguPublishPage({ params }: PageProps) {
  const resolved = await params
  const sido = decodeURIComponent(resolved.sido)
  const sigungu = decodeURIComponent(resolved.sigungu)
  const range = resolved.range

  if (!isValidRange(range)) {
    return <div className="p-10">잘못된 range 값입니다.</div>
  }

  const result = await getPublishTransactions({
    scope: 'sigungu',
    sido,
    sigungu,
    range,
  })

  return (
    <PublishClient
      regionName={result.regionName}
      range={range}
      items={result.items}
      topDeals={result.topDeals}
      baseDateIso={result.baseDate.toISOString()}
      basePath={`/publish/sigungu/${encodeURIComponent(sido)}/${encodeURIComponent(sigungu)}`}
    />
  )
}
