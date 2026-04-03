import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const LISTING_VIEW = 'complex_listing_mv'

function normalizePrefix(value: string) {
  return value.replace(/\s+/g, '').trim()
}

function resolveSidoPrefix(sidoCode: string) {
  if (!sidoCode) return ''
  if (sidoCode === '45') return '52'
  return sidoCode
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const sidoCode = resolveSidoPrefix(normalizePrefix(searchParams.get('sidoCode') || ''))

    if (q.length < 2) {
      return NextResponse.json({ ok: true, items: [] })
    }

    let query = supabase
      .from(LISTING_VIEW)
      .select('id, official_name, umd_name, road_name, lawd_code, deal_count')
      .ilike('official_name', `%${q}%`)
      .order('deal_count', { ascending: false, nullsFirst: false })
      .order('official_name', { ascending: true })
      .limit(8)

    if (sidoCode) {
      query = query.like('lawd_code', `${sidoCode}%`)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ ok: false, error: error.message, items: [] }, { status: 500 })
    }

    const items = (data || []).map((row: any) => ({
      complex_id: row.id,
      apartment_name: row.official_name,
      umd_name: row.umd_name,
      road_name: row.road_name,
      lawd_code: row.lawd_code,
      deal_count: row.deal_count,
    }))

    return NextResponse.json({ ok: true, items })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'unexpected error', items: [] }, { status: 500 })
  }
}
