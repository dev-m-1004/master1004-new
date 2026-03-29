import { createClient } from '@supabase/supabase-js'

function getEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} 환경변수가 설정되지 않았습니다.`)
  }

  return value
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)