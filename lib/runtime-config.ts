export const isBypassAuthEnabled = (): boolean => {
  // Check env var first (embedded at build time)
  if (process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true') {
    return true;
  }

  // Fallback: check URL parameter for demo mode (?bypass=true)
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('bypass') === 'true') {
      return true;
    }
  }

  return false;
};

export const getBypassRole = (): 'admin' | 'brand' => {
  // Check env var first
  if (process.env.NEXT_PUBLIC_BYPASS_ROLE === 'admin') {
    return 'admin';
  }

  // Fallback: check URL parameter (?role=admin or ?role=brand)
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get('role');
    if (roleParam === 'admin') {
      return 'admin';
    }
  }

  return 'brand';
};

export const isSupabaseEnvConfigured = (): boolean => {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
};
