import React, { useState, useRef } from 'react';
import { Shield, Building2, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const OnboardingScreen: React.FC = () => {
  const { createBrand, setCurrentBrandId, user, refreshBrands } = useAuth();
  const [brandName, setBrandName] = useState('');
  const isSubmitting = useRef(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim() || isCreating || isSubmitting.current) return;

    isSubmitting.current = true;
    setIsCreating(true);
    setError(null);

    try {
      const { data, error: createError } = await withTimeout(
        createBrand(brandName.trim(), websiteUrl.trim() || undefined),
        25000,
        'Brand creation request timed out. Please try again.'
      );

      if (createError) {
        // If AbortError, check if brand was actually created by refreshing
        if (createError.name === 'AbortError' || createError.message?.includes('aborted')) {
          void refreshBrands().catch(() => undefined);
          return;
        }
        setError(createError.message || 'Failed to create brand');
      } else if (data) {
        // createBrand already updates brands state and fires a background
        // refresh — no need to await refreshBrands() which would block the
        // UI on a redundant round-trip.
        setCurrentBrandId(data.id);
      }
    } catch (err: any) {
      // If AbortError, check if brand was actually created
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
        void refreshBrands().catch(() => undefined);
        setError('Brand creation request was interrupted. Retry once.');
        return;
      }
      if (typeof err?.message === 'string' && err.message.toLowerCase().includes('timed out')) {
        setError('Brand creation timed out. Please try again.');
      } else {
        setError('Failed to create brand. Please try again.');
      }
    } finally {
      setIsCreating(false);
      isSubmitting.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Logo / Brand */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center">
            <Shield className="text-primary" size={28} />
          </div>
        </div>
        <h1 className="text-3xl font-serif font-medium text-primary mb-2">Welcome to Brandog</h1>
        <p className="text-secondary text-sm">Let's set up your first brand to get started</p>
      </div>

      {/* Onboarding Card */}
      <div className="w-full max-w-md">
        <div className="bg-surface/30 border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Building2 size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-primary">Create Your Brand</h2>
              <p className="text-xs text-secondary">This will be your protected brand profile</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">
                Brand Name *
              </label>
              <input
                autoFocus
                type="text"
                required
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors"
                placeholder="e.g. My Awesome Brand"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                disabled={isCreating}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">
                Website URL (optional)
              </label>
              <input
                type="text"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors"
                placeholder="e.g. mybrand.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                disabled={isCreating}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isCreating || !brandName.trim()}
              className="w-full py-2.5 px-4 bg-primary text-background rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating Brand...
                </>
              ) : (
                <>
                  Get Started
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-secondary/60 mt-6">
          Signed in as {user?.email}
        </p>
      </div>
    </div>
  );
};

export default OnboardingScreen;
