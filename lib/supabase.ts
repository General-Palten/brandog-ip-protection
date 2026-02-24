import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
}

let browserClient: SupabaseClient<any> | null = null

const createPlaceholderClient = (): SupabaseClient<any> =>
  createBrowserClient<any>(
    'https://placeholder.supabase.co',
    'placeholder-key'
  )

export const supabase = (() => {
  if (browserClient) return browserClient
  if (!supabaseUrl || !supabaseAnonKey) {
    browserClient = createPlaceholderClient()
    return browserClient
  }

  browserClient = createBrowserClient<any>(supabaseUrl, supabaseAnonKey)
  return browserClient
})()

// Helper to check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey &&
    supabaseUrl !== 'https://placeholder.supabase.co')
}
