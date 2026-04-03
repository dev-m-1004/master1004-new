import type { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.master1004.com'
const gaId = process.env.NEXT_PUBLIC_GA_ID || 'G-B017KDHY7M'
const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || 'ca-pub-2521238066247846'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: '실거래마스터 - 아파트 실거래 정보',
    template: '%s | 실거래마스터',
  },
  description:
    '전국 아파트 단지와 실거래 내역을 지역과 단지명으로 검색하고, 가격 추이와 최근 거래 정보를 확인할 수 있는 서비스입니다.',
  keywords: [
    '실거래마스터',
    '아파트 실거래가',
    '실거래 정보',
    '아파트 매매',
    '국토부 실거래가',
    '단지 실거래',
    '부동산 실거래',
    '아파트 시세',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: siteUrl,
    siteName: '실거래마스터',
    title: '실거래마스터 - 아파트 실거래 정보',
    description:
      '전국 아파트 단지와 실거래 내역을 지역과 단지명으로 검색하고, 가격 추이와 최근 거래 정보를 확인할 수 있는 서비스입니다.',
  },
  twitter: {
    card: 'summary_large_image',
    title: '실거래마스터 - 아파트 실거래 정보',
    description:
      '전국 아파트 단지와 실거래 내역을 지역과 단지명으로 검색하고, 가격 추이와 최근 거래 정보를 확인할 수 있는 서비스입니다.',
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    other: {
      'naver-site-verification': [
        'naver544eefb87dea203deed3709a9f24c44c.html',
        'naver7a7dfed64d6bae5009193fc7df663ab8.html',
      ],
    },
  },
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-[rgba(249,246,241,0.78)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1f3147] text-sm font-bold text-white shadow-[0_10px_30px_rgba(31,49,71,0.18)]">
            RM
          </span>
          <div>
            <div className="text-[15px] font-bold tracking-[-0.02em] text-[#1f3147]">실거래마스터</div>
            <div className="text-xs text-[#7d7366]">아파트 실거래 정보 서비스</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          <Link href="/" className="rounded-full px-4 py-2 text-sm font-medium text-[#2b3647] transition hover:bg-white/80">
            홈
          </Link>
        </nav>
      </div>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[#e8ded3] bg-[#f5efe8]">
      <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-[#7b7063] md:px-6 lg:px-8">
        ©Copyright @ 실거래마스터 All Rights Reserved.
      </div>
    </footer>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#f7f2eb] text-gray-900">
        <Script
          id="google-analytics-src"
          src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', '${gaId}', {
              page_path: window.location.pathname,
            });
          `}
        </Script>

        <Script
          id="google-adsense"
          async
          strategy="afterInteractive"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
          crossOrigin="anonymous"
        />

        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  )
}
