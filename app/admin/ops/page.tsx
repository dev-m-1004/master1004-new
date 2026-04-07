import type { Metadata } from 'next'
import AdminOpsClient from './admin-ops-client'

export const metadata: Metadata = {
  title: '운영 관리자 | Master1004',
  description: '수집, 후처리, 상태 점검을 한 화면에서 관리하는 운영 페이지',
}

export default function AdminOpsPage() {
  return <AdminOpsClient />
}
