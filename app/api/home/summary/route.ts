import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('lawd_code')

    if (error) throw error

    const result: Record<string, number> = {}

    data.forEach((row) => {
      const prefix = row.lawd_code.slice(0, 2)
      result[prefix] = (result[prefix] || 0) + 1
    })

    return NextResponse.json({
      ok: true,
      data: result,
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}