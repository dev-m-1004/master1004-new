import type { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase/admin'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ]

  try {
    const { data } = await supabaseAdmin
      .from('complex_listing_mv')
      .select('id, latest_deal_year, latest_deal_month, latest_deal_day')
      .order('latest_deal_year', { ascending: false, nullsFirst: false })
      .order('latest_deal_month', { ascending: false, nullsFirst: false })
      .order('latest_deal_day', { ascending: false, nullsFirst: false })
      .limit(1000)

    for (const row of data || []) {
      const lastModified =
        row.latest_deal_year && row.latest_deal_month && row.latest_deal_day
          ? new Date(
              Number(row.latest_deal_year),
              Number(row.latest_deal_month) - 1,
              Number(row.latest_deal_day)
            )
          : new Date()

      urls.push({
        url: `${siteUrl}/complex/${row.id}`,
        lastModified,
        changeFrequency: 'daily',
        priority: 0.8,
      })
    }
  } catch (error) {
    console.error('sitemap complex fetch error:', error)
  }

  return urls
}
