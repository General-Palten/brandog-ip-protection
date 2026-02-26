import React, { useState } from 'react'
import { Shield, Mail, Lock, User, ArrowRight, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

type AuthMode = 'login' | 'signup' | 'forgot-password'

const mapFriendlyAuthError = (message: string, mode: AuthMode): string => {
  const raw = (message || '').trim()
  const lower = raw.toLowerCase()

  if (lower.includes('invalid login credentials')) {
    return 'Email or password is incorrect. If this is a new account, confirm your email first.'
  }

  if (lower.includes('email not confirmed') || lower.includes('email address not confirmed')) {
    return 'Please confirm your email address first, then try signing in.'
  }

  if (lower.includes('signup is disabled')) {
    return 'Sign-up is currently disabled in Supabase Authentication settings.'
  }

  if (lower.includes('password should be at least')) {
    return 'Password must be at least 6 characters.'
  }

  if (mode === 'login' && !raw) {
    return 'Sign-in failed. Please verify your email and password.'
  }

  return raw || 'Authentication failed. Please try again.'
}

const AuthScreen: React.FC = () => {
  const { signIn, signUp, resetPassword, isConfigured } = useAuth()

  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    console.log('Form submitted, mode:', mode)

    try {
      const normalizedEmail = email.trim().toLowerCase()
      if (mode === 'login') {
        console.log('Attempting sign in with:', email)
        const { error } = await signIn(normalizedEmail, password)
        console.log('Sign in result:', error ? error.message : 'Success')
        if (error) {
          setError(mapFriendlyAuthError(error.message, mode))
        }
      } else if (mode === 'signup') {
        if (!fullName.trim()) {
          setError('Please enter your full name')
          setLoading(false)
          return
        }
        const { error } = await signUp(normalizedEmail, password, fullName)
        if (error) {
          setError(mapFriendlyAuthError(error.message, mode))
        } else {
          setSuccess('Check your email to confirm your account')
          setMode('login')
        }
      } else if (mode === 'forgot-password') {
        const { error } = await resetPassword(normalizedEmail)
        if (error) {
          setError(mapFriendlyAuthError(error.message, mode))
        } else {
          setSuccess('Password reset email sent. Check your inbox.')
          setMode('login')
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Show configuration warning if Supabase is not set up
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center">
              <Shield className="text-primary" size={28} />
            </div>
          </div>
          <h1 className="text-3xl font-serif font-medium text-primary mb-2 text-center">Brandog</h1>
          <p className="text-secondary text-sm text-center mb-8">IP Protection Platform</p>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-yellow-500 mt-0.5 shrink-0" size={20} />
              <div>
                <h3 className="font-medium text-yellow-500 mb-1">Supabase Not Configured</h3>
                <p className="text-sm text-secondary">
                  To enable authentication, add these variables to your <code className="bg-surface px-1 rounded">.env.local</code> file:
                </p>
                <pre className="mt-2 text-xs bg-surface p-2 rounded overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key`}
                </pre>
              </div>
            </div>
          </div>

          <p className="text-xs text-secondary text-center">
            Get your credentials from the{' '}
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Supabase Dashboard
            </a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center">
            <Shield className="text-primary" size={28} />
          </div>
        </div>
        <h1 className="text-3xl font-serif font-medium text-primary mb-2 text-center">Brandog</h1>
        <p className="text-secondary text-sm text-center mb-8">IP Protection Platform</p>

        {/* Auth Form */}
        <div className="bg-surface/30 border border-border rounded-lg p-6">
          <h2 className="text-lg font-medium text-primary mb-6">
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'forgot-password' && 'Reset your password'}
          </h2>

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-2">
              <CheckCircle className="text-green-500 mt-0.5 shrink-0" size={16} />
              <p className="text-sm text-green-500">{success}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={16} />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name (signup only) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm text-secondary mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-primary placeholder:text-secondary/50 focus:outline-none focus:border-primary/50 transition-colors"
                    required
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm text-secondary mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-primary placeholder:text-secondary/50 focus:outline-none focus:border-primary/50 transition-colors"
                  required
                />
              </div>
            </div>

            {/* Password (not for forgot-password) */}
            {mode !== 'forgot-password' && (
              <div>
                <label className="block text-sm text-secondary mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-primary placeholder:text-secondary/50 focus:outline-none focus:border-primary/50 transition-colors"
                    required
                    minLength={6}
                  />
                </div>
                {mode === 'signup' && (
                  <p className="text-xs text-secondary mt-1">Must be at least 6 characters</p>
                )}
              </div>
            )}

            {/* Forgot Password Link (login only) */}
            {mode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot-password')
                    setError('')
                    setSuccess('')
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-background font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  {mode === 'login' && 'Sign In'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'forgot-password' && 'Send Reset Link'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Mode Switch */}
          <div className="mt-6 pt-6 border-t border-border text-center">
            {mode === 'login' && (
              <p className="text-sm text-secondary">
                Don't have an account?{' '}
                <button
                  onClick={() => {
                    setMode('signup')
                    setError('')
                    setSuccess('')
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Sign up
                </button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-sm text-secondary">
                Already have an account?{' '}
                <button
                  onClick={() => {
                    setMode('login')
                    setError('')
                    setSuccess('')
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </p>
            )}
            {mode === 'forgot-password' && (
              <p className="text-sm text-secondary">
                Remember your password?{' '}
                <button
                  onClick={() => {
                    setMode('login')
                    setError('')
                    setSuccess('')
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-xs text-secondary/60 text-center">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}

export default AuthScreen
