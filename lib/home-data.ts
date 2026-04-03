import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getHomeTrend() {
  const { data } = await supabase
    .from('home_yearly_tx_mv')
    .select('deal_year, tx_count')
    .order('deal_year')

  return (data || []).map((r: any) => ({
    year: String(r.deal_year),
    count: Number(r.tx_count || 0),
  }))
}

export async function getHomeRegions() {
  const { data } = await supabase
    .from('home_regions_mv')
    .select('*')
    .order('deal_count', { ascending: false })
    .limit(17)

  return data || []
}

export async function getHomeTopPrice() {
  const { data } = await supabase
    .from('home_top_price_mv')
    .select('*')
    .order('max_price', { ascending: false })
    .limit(5)

  return data || []
}

export async function getHomeTopVolume() {
  const { data } = await supabase
    .from('home_top_volume_mv')
    .select('*')
    .order('deal_count', { ascending: false })
    .limit(5)

  return data || []
}