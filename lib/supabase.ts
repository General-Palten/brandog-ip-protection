import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isLikelyHttpUrl, sanitizeEnvValue } from './supabase-env'

const supabaseUrl = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL)
const supabaseAnonKey = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const hasValidSupabaseUrl = isLikelyHttpUrl(supabaseUrl)

if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey || !hasValidSupabaseUrl)) {
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
  if (!supabaseUrl || !supabaseAnonKey || !hasValidSupabaseUrl) {
    browserClient = createPlaceholderClient()
    return browserClient
  }

  browserClient = createBrowserClient<any>(supabaseUrl, supabaseAnonKey)
  return browserClient
})()

// Helper to check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey && hasValidSupabaseUrl &&
    supabaseUrl !== 'https://placeholder.supabase.co')
}
