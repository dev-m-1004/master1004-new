import type { Metadata } from 'next'
import HomePageClient from './home-page-client'

export const metadata: Metadata = {
  title: '실거래마스터 - 아파트 실거래 정보',
  description:
    '전국 아파트 실거래 내역을 단지명과 지역으로 검색하고, 최근 거래와 가격 정보를 확인할 수 있습니다.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: '실거래마스터 - 아파트 실거래 정보',
    description:
      '전국 아파트 실거래 내역을 단지명과 지역으로 검색하고, 최근 거래와 가격 정보를 확인할 수 있습니다.',
    url: '/',
  },
}

export default function Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '실거래마스터',
    alternateName: '실거래마스터 - 아파트 실거래 정보',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    description:
      '전국 아파트 실거래 내역을 단지명과 지역으로 검색하고, 최근 거래와 가격 정보를 확인할 수 있습니다.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/?q={search_term_string}`,
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
