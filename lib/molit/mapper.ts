export type TransactionRow = {
  source_type: string
  complex_name: string
  lawd_code: string
  apt_seq: string | null
  road_name: string
  road_bonbun: string
  road_bubun: string
  umd_name: string
  complex_id: string | null
  deal_year: number
  deal_month: number
  deal_day: number
  deal_date: string | null
  area_m2: number
  floor: string
  price_krw: number
  deposit_krw: number | null
  monthly_rent_krw: number | null
  build_year: number
  jibun: string
  dong: string
  apartment_name: string
  raw_data: any
  source_updated_at: string
}

function toNumber(value: any, fallback = 0) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : fallback
}

function pad2(value: any) {
  return String(value ?? '').padStart(2, '0')
}

export function mapMolitItemToTransactionRow(item: any, lawdCode: string): TransactionRow {
  const dealYear = toNumber(item.dealYear)
  const dealMonth = toNumber(item.dealMonth)
  const dealDay = toNumber(item.dealDay)

  const dealDate =
    dealYear && dealMonth && dealDay
      ? `${dealYear}-${pad2(dealMonth)}-${pad2(dealDay)}`
      : null

  return {
    source_type: 'sale',
    complex_name: item.aptNm ?? '',
    lawd_code: lawdCode,

    apt_seq: item.aptSeq ? String(item.aptSeq) : null,
    road_name: item.roadNm ?? '',
    road_bonbun: item.roadNmBonbun ?? '',
    road_bubun: item.roadNmBubun ?? '',
    umd_name: item.umdNm ?? '',
    complex_id: null,

    deal_year: dealYear,
    deal_month: dealMonth,
    deal_day: dealDay,
    deal_date: dealDate,

    area_m2: toNumber(item.excluUseAr),
    floor: String(item.floor ?? ''),
    price_krw: toNumber(item.dealAmount),
    deposit_krw: null,
    monthly_rent_krw: null,
    build_year: toNumber(item.buildYear),
    jibun: item.jibun ?? '',
    dong: item.umdNm ?? '',
    apartment_name: item.aptNm ?? '',
    raw_data: item,
    source_updated_at: new Date().toISOString(),
  }
}