'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

function formatKoreanPrice(value: number) {
  const eok = Math.floor(value / 10000)
  const man = value % 10000

  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString()}만`
  if (eok > 0) return `${eok}억`
  return `${man.toLocaleString()}만`
}

export default function PriceChart({
  data,
}: {
  data: { date: string; price: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis
          tickFormatter={(value) => formatKoreanPrice(Number(value))}
          tick={{ fontSize: 12 }}
          width={90}
        />
        <Tooltip
          formatter={(value) => [formatKoreanPrice(Number(value)), '실거래가']}
        />
        <Line
          type="monotone"
          dataKey="price"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}