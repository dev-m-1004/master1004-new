import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .limit(1)

  return NextResponse.json({ data, error })
}