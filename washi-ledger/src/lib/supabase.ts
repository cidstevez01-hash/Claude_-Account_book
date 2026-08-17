import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，检查 .env 文件')
}

export const supabase = createClient(url, anonKey)
