import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Profile, Brand } from '../lib/database.types'
import { isBypassAuthEnabled } from '../lib/runtime-config'

export interface AuthProfile {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  role: 'brand_owner' | 'admin' | 'lawyer'
}

type BrandsStatus = 'idle' | 'loading' | 'loaded' | 'error'

interface AuthContextType {
  user: User | null
  profile: AuthProfile | null
  session: Session | null
  loading: boolean
  isConfigured: boolean
  // Auth methods
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  updateProfile: (updates: Partial<Pick<AuthProfile, 'fullName' | 'avatarUrl'>>) => Promise<{ error: Error | null }>
  // Role helpers
  isAdmin: boolean
  isBrandOwner: boolean
  isLawyer: boolean
  // Brand helpers
  currentBrand: Brand | null
  brands: Brand[]
  brandsStatus: BrandsStatus
  brandsError: string | null
  setCurrentBrandId: (id: string) => void
  createBrand: (name: string, websiteUrl?: string) => Promise<{ data: Brand | null; error: Error | null }>
  refreshBrands: () => Promise<void>
  retryLoadBrands: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const normalizeBrandSlug = (name: string): string => {
  const normalized = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

  return normalized || 'brand'
}

const normalizeWebsiteUrl = (websiteUrl?: string): string | null => {
  if (!websiteUrl) return null

  const trimmed = websiteUrl.trim()
  if (!trimmed) return null

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    return new URL(withProtocol).toString()
  } catch {
    return trimmed
  }
}

const mapCreateBrandErrorMessage = (message?: string): string => {
  if (!message) return 'Failed to create brand'

  const lower = message.toLowerCase()
  if (lower.includes('relation') && lower.includes('brands') && lower.includes('does not exist')) {
    return 'Database setup is incomplete. Apply the Supabase migrations, then try again.'
  }
  if (lower.includes('violates foreign key') || lower.includes('profiles')) {
    return 'Your profile is not fully initialized yet. Sign out and sign in again, then retry.'
  }
  if (lower.includes('permission denied') || lower.includes('row-level security') || lower.includes('not allowed')) {
    return 'Database permissions are blocking brand creation. Check Supabase RLS policies for the brands table.'
  }

  return message
}

const isAbortLikeError = (error: unknown): boolean => {
  if (!error) return false
  const maybeError = error as { name?: string; message?: string; code?: string }
  const message = (maybeError.message || '').toLowerCase()
  const code = (maybeError.code || '').toLowerCase()
  return maybeError.name === 'AbortError' || message.includes('aborted') || code.includes('aborted')
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const BRAND_DB_TIMEOUT_MS = 30000

const withTimeout = async <T,>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

const buildAuthRedirectUrl = (path: string): string | undefined => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const runtimeOrigin = typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL || '').trim()

  if (!runtimeOrigin) return undefined

  const base = runtimeOrigin.replace(/\/+$/, '')
  return `${base}${normalizedPath}`
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [brands, setBrands] = useState<Brand[]>([])
  const [currentBrandId, setCurrentBrandId] = useState<string | null>(null)
  const [brandsStatus, setBrandsStatus] = useState<BrandsStatus>('idle')
  const [brandsError, setBrandsError] = useState<string | null>(null)
  const authSeqRef = useRef(0)
  const isConfigured = isSupabaseConfigured()
  const bypassAuth = isBypassAuthEnabled()

  // Fetch user profile from database, create if doesn't exist.
  // Retries once on transient abort errors (caused by @supabase/ssr lock contention).
  const fetchProfile = useCallback(async (userId: string, userEmail?: string, userFullName?: string, _retry = 0): Promise<AuthProfile | null> => {
    if (!isConfigured) return null

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // Transient abort — retry once after a short delay
        if (isAbortLikeError(error) && _retry < 1) {
          console.log('Profile fetch aborted, retrying...', error.message)
          await delay(1000)
          return fetchProfile(userId, userEmail, userFullName, _retry + 1)
        }

        console.log('Profile fetch error:', error.code, error.message)
        // Profile doesn't exist - create one
        if (error.code === 'PGRST116') {
          console.log('Profile not found, creating one for:', userId, userEmail)

          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              email: userEmail || '',
              full_name: userFullName || null,
              role: 'brand_owner' as const,
            })
            .select()
            .single()

          if (insertError) {
            console.error('Error creating profile:', insertError.code, insertError.message)
            // FK violation on profiles.id → auth.users.id means the auth session
            // references a user that no longer exists. Signal the caller to sign out.
            if (insertError.code === '23503') {
              const orphanErr = new Error('Orphaned session: user no longer exists in auth.users')
              ;(orphanErr as any).isOrphaned = true
              throw orphanErr
            }
            return null
          }

          return {
            id: newProfile.id,
            email: newProfile.email,
            fullName: newProfile.full_name,
            avatarUrl: newProfile.avatar_url,
            role: newProfile.role as AuthProfile['role'],
          }
        }

        console.error('Error fetching profile:', error.code, error.message)
        return null
      }

      return {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        avatarUrl: data.avatar_url,
        role: data.role as AuthProfile['role'],
      }
    } catch (error) {
      if (isAbortLikeError(error)) {
        if (_retry < 1) {
          console.log('Profile fetch threw abort, retrying...')
          await delay(1000)
          return fetchProfile(userId, userEmail, userFullName, _retry + 1)
        }
        return null
      }
      throw error
    }
  }, [isConfigured])

  // Fetch user's brands.
  // Retries once on transient abort errors (caused by @supabase/ssr lock contention).
  const fetchBrands = useCallback(async (userId: string, _retry = 0) => {
    if (!isConfigured) return

    setBrandsStatus('loading')
    setBrandsError(null)

    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        // Transient abort — retry once after a short delay
        if (isAbortLikeError(error) && _retry < 1) {
          console.log('Brands fetch aborted, retrying...', error.message)
          await delay(1500)
          return fetchBrands(userId, _retry + 1)
        }

        console.error('Error fetching brands:', error)
        setBrandsStatus('error')
        setBrandsError(error.message || 'Failed to load brands')
        // Do NOT call setBrands([]) — keep existing brands in state
        return
      }

      setBrands(data || [])
      setBrandsStatus('loaded')

      // Set first brand as current if none selected
      if (data && data.length > 0) {
        setCurrentBrandId(prev => prev || data[0].id)
      }
    } catch (error) {
      if (isAbortLikeError(error)) {
        if (_retry < 1) {
          console.log('Brands fetch threw abort, retrying...')
          await delay(1500)
          return fetchBrands(userId, _retry + 1)
        }
        // Exhausted retries — surface error so the user can manually retry
        setBrandsStatus('error')
        setBrandsError('Connection interrupted. Please try again.')
        return
      }
      const msg = error instanceof Error ? error.message : 'Failed to load brands'
      setBrandsStatus('error')
      setBrandsError(msg)
    }
  }, [isConfigured])

  // Initialize auth state — uses onAuthStateChange only (Supabase v2 recommended).
  // The INITIAL_SESSION event fires immediately when the listener is set up,
  // so a separate getSession() call is unnecessary and can hang on the
  // @supabase/ssr session lock.
  useEffect(() => {
    let isMounted = true
    let initialised = false

    if (bypassAuth) {
      setLoading(false)
      return
    }

    if (!isConfigured) {
      setLoading(false)
      return
    }

    // Safety timeout - if INITIAL_SESSION never fires or async work hangs, stop loading
    const timeout = setTimeout(() => {
      if (isMounted && !initialised) {
        console.warn('Auth timeout - forcing loading to false')
        setBrandsStatus(prev => (prev === 'idle' || prev === 'loading') ? 'error' : prev)
        setBrandsError(prev => prev || 'Loading timed out. Please try again.')
        setLoading(false)
        initialised = true
      }
    }, 10000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        // Race guard: bump sequence so stale handlers can bail out
        authSeqRef.current += 1
        const mySeq = authSeqRef.current

        setSession(session)
        setUser(session?.user ?? null)

        // Stop the initial loading spinner as soon as we know the auth state.
        // Brand loading is now tracked separately via brandsStatus.
        if (isMounted && !initialised) {
          clearTimeout(timeout)
          setLoading(false)
          initialised = true
        }

        if (session?.user) {
          try {
            const userProfile = await fetchProfile(
              session.user.id,
              session.user.email,
              session.user.user_metadata?.full_name
            )
            // Discard if a newer auth event has fired while we awaited
            if (!isMounted || mySeq !== authSeqRef.current) return
            setProfile(userProfile)
            await fetchBrands(session.user.id)
          } catch (err: any) {
            if (isMounted && mySeq === authSeqRef.current) {
              // Orphaned session — user was deleted from auth.users but a stale
              // JWT still exists in cookies. Force sign-out to clear it.
              if (err?.isOrphaned) {
                console.warn('Orphaned session detected, signing out...')
                void supabase.auth.signOut().catch(() => undefined)
                setUser(null)
                setSession(null)
                setProfile(null)
                setBrands([])
                setBrandsStatus('idle')
                setBrandsError(null)
                setCurrentBrandId(null)
                return
              }
              console.error('Error during auth state change:', err)
              setBrandsStatus(prev => prev === 'idle' ? 'error' : prev)
              setBrandsError(prev => prev || 'Failed to initialize session')
            }
          }
        } else {
          setProfile(null)
          setBrands([])
          setBrandsStatus('idle')
          setBrandsError(null)
          setCurrentBrandId(null)
        }
      }
    )

    return () => {
      isMounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [isConfigured, bypassAuth, fetchProfile, fetchBrands])

  // Sign up
  const signUp = async (email: string, password: string, fullName: string) => {
    if (!isConfigured) {
      return { error: { message: 'Supabase not configured' } as AuthError }
    }

    const emailRedirectTo = buildAuthRedirectUrl('/auth')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo,
      }
    })

    return { error }
  }

  // Sign in
  const signIn = async (email: string, password: string) => {
    if (!isConfigured) {
      return { error: { message: 'Supabase not configured' } as AuthError }
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    return { error }
  }

  // Sign out — always clear local state even if the server call fails (e.g. AbortError)
  const signOut = async () => {
    console.log('Sign out clicked')
    if (!isConfigured) return

    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Sign out error:', error)
      } else {
        console.log('Sign out successful')
      }
    } catch (err) {
      console.error('Sign out exception:', err)
    } finally {
      setUser(null)
      setSession(null)
      setProfile(null)
      setBrands([])
      setBrandsStatus('idle')
      setBrandsError(null)
      setCurrentBrandId(null)
    }
  }

  // Reset password
  const resetPassword = async (email: string) => {
    if (!isConfigured) {
      return { error: { message: 'Supabase not configured' } as AuthError }
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    return { error }
  }

  // Update profile
  const updateProfile = async (updates: Partial<Pick<AuthProfile, 'fullName' | 'avatarUrl'>>) => {
    if (!isConfigured || !user) {
      return { error: new Error('Not authenticated') }
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: updates.fullName,
        avatar_url: updates.avatarUrl,
      })
      .eq('id', user.id)

    if (!error && profile) {
      setProfile({
        ...profile,
        fullName: updates.fullName ?? profile.fullName,
        avatarUrl: updates.avatarUrl ?? profile.avatarUrl,
      })
    }

    return { error: error ? new Error(error.message) : null }
  }

  // Create brand
  const createBrand = async (name: string, websiteUrl?: string) => {
    if (!isConfigured || !user) {
      return { data: null, error: new Error('Not authenticated') }
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      return { data: null, error: new Error('Brand name is required') }
    }

    // Ensure profile exists before creating a brand (owner_id FK references profiles.id).
    let activeProfile = profile
    if (!activeProfile) {
      activeProfile = await withTimeout(
        fetchProfile(
          user.id,
          user.email,
          user.user_metadata?.full_name
        ),
        BRAND_DB_TIMEOUT_MS,
        'Profile initialization'
      )
      if (activeProfile) {
        setProfile(activeProfile)
      }
    }

    if (!activeProfile) {
      return { data: null, error: new Error('Could not initialize your profile. Please sign out and sign in again.') }
    }

    const baseSlug = normalizeBrandSlug(trimmedName)
    const normalizedWebsiteUrl = normalizeWebsiteUrl(websiteUrl)

    try {
      let attempts = 0
      let createdBrand: Brand | null = null
      let lastInsertError: Error | null = null

      while (!createdBrand && attempts < 3) {
        attempts += 1
        const brandId = crypto.randomUUID()
        const slug = `${baseSlug}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

        const { error: insertError } = await withTimeout<any>(
          supabase
            .from('brands')
            .insert({
              id: brandId,
              owner_id: user.id,
              name: trimmedName,
              slug,
              website_url: normalizedWebsiteUrl,
            }),
          BRAND_DB_TIMEOUT_MS,
          'Brand insert'
        )

        if (insertError) {
          // Slug collisions are unlikely but retry safely if they occur.
          if (insertError.code === '23505' && attempts < 3) {
            continue
          }
          lastInsertError = new Error(mapCreateBrandErrorMessage(insertError.message))
          break
        }

        createdBrand = {
          id: brandId,
          owner_id: user.id,
          name: trimmedName,
          slug,
          color: 'green',
          website_url: normalizedWebsiteUrl,
          logo_url: null,
          is_trademarked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      }

      if (!createdBrand) {
        return { data: null, error: lastInsertError || new Error('Failed to create brand') }
      }

      setBrands(prev => {
        if (prev.some(existing => existing.id === createdBrand!.id)) {
          return prev
        }
        return [createdBrand!, ...prev]
      })

      setCurrentBrandId(prev => prev || createdBrand.id)
      void fetchBrands(user.id).catch(() => undefined)

      return { data: createdBrand, error: null }
    } catch (err: any) {
      console.error('Create brand exception:', err)
      return { data: null, error: new Error(mapCreateBrandErrorMessage(err?.message || 'Failed to create brand')) }
    }
  }

  // Refresh brands
  const refreshBrands = async () => {
    if (user) {
      await withTimeout(fetchBrands(user.id), BRAND_DB_TIMEOUT_MS, 'Brand list refresh')
    }
  }

  // Retry loading brands (for error recovery UI)
  const retryLoadBrands = useCallback(async () => {
    if (user) {
      await withTimeout(fetchBrands(user.id), BRAND_DB_TIMEOUT_MS, 'Brand list retry')
    }
  }, [user, fetchBrands])

  // Get current brand
  const currentBrand = brands.find(b => b.id === currentBrandId) || null

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      loading,
      isConfigured,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updateProfile,
      isAdmin: profile?.role === 'admin',
      isBrandOwner: profile?.role === 'brand_owner',
      isLawyer: profile?.role === 'lawyer',
      currentBrand,
      brands,
      brandsStatus,
      brandsError,
      setCurrentBrandId,
      createBrand,
      refreshBrands,
      retryLoadBrands,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
