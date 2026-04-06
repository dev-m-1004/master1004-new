import HomePageClient from './home-page-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Page() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '실거래마스터',
    alternateName: '실거래마스터 - 아파트 실거래 정보',
    url: siteUrl,
    description:
      '전국 아파트 실거래 내역을 단지명과 지역으로 검색하고, 최근 거래와 가격 정보를 확인할 수 있습니다.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePageClient />
    </>
  )
}
