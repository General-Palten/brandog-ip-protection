import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)

// Helper to check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey &&
    supabaseUrl !== 'https://placeholder.supabase.co')
}
