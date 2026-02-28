import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isLikelyHttpUrl, sanitizeEnvValue } from './supabase-env'

const supabaseUrl = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL)
const supabaseAnonKey = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const hasValidSupabaseUrl = isLikelyHttpUrl(supabaseUrl)

if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey || !hasValidSupabaseUrl)) {
  console.warn('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
}

// Bypass navigator.locks for the auth session lock.
// The @supabase/ssr browser client uses navigator.locks internally to prevent
// concurrent token refreshes across tabs. However, the lock acquisition uses an
// AbortController that gets aborted during React lifecycle transitions (strict
// mode, HMR, fast remounts), which permanently breaks ALL Supabase requests
// with "AbortError: signal is aborted without reason".
// Using a simple in-memory lock is safe for a singleton client in a single tab
// and avoids the navigator.locks AbortController issue entirely.
const navigatorLockFallback = async <R,>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => {
  return fn()
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

  browserClient = createBrowserClient<any>(supabaseUrl, supabaseAnonKey, {
    auth: {
      lock: navigatorLockFallback,
    },
  })
  return browserClient
})()

// Helper to check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey && hasValidSupabaseUrl &&
    supabaseUrl !== 'https://placeholder.supabase.co')
}
