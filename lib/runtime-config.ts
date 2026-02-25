export const isBypassAuthEnabled = (): boolean => {
  return process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';
};

export const getBypassRole = (): 'admin' | 'brand' => {
  return process.env.NEXT_PUBLIC_BYPASS_ROLE === 'admin' ? 'admin' : 'brand';
};

export const isSupabaseEnvConfigured = (): boolean => {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
};
