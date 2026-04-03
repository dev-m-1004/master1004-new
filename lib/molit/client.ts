import { XMLParser } from 'fast-xml-parser'

export type MolitRawItem = Record<string, any>

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true,
})

export async function fetchMolitApartmentTrades(params: {
  lawdCode: string
  dealYmd: string
}) {
  const { lawdCode, dealYmd } = params

  const serviceKey = encodeURIComponent(process.env.MOLIT_API_KEY!)
  const url =
    `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev` +
    `?serviceKey=${serviceKey}&LAWD_CD=${lawdCode}&DEAL_YMD=${dealYmd}`

  const res = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`MOLIT API HTTP ${res.status}`)
  }

  const xmlText = await res.text()
  const parsed = parser.parse(xmlText)

  const resultCode = parsed?.response?.header?.resultCode
  const resultMsg = parsed?.response?.header?.resultMsg

  if (resultCode && String(resultCode) !== '00') {
    throw new Error(`MOLIT API error: ${resultCode} ${resultMsg ?? ''}`.trim())
  }

  const items = parsed?.response?.body?.items?.item

  if (!items) {
    return []
  }

  return Array.isArray(items) ? items : [items]
}