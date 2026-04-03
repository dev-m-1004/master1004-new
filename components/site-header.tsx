import Link from 'next/link'

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="min-w-0">
          <div className="truncate text-xl font-bold text-gray-900 md:text-2xl">
            실거래마스터
          </div>
          <div className="truncate text-xs text-gray-500 md:text-sm">
            아파트 실거래 정보
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-xl border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            aria-label="홈으로 이동"
          >
            홈
          </Link>
        </nav>
      </div>
    </header>
  )
}
