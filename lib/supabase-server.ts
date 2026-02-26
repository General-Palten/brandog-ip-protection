import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';
import { isLikelyHttpUrl, sanitizeEnvValue } from '@/lib/supabase-env';

const SUPABASE_URL = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_ANON_KEY = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const FALLBACK_SUPABASE_URL = 'https://placeholder.supabase.co';
const FALLBACK_SUPABASE_ANON = 'placeholder-key';

export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();
  const resolvedUrl = isLikelyHttpUrl(SUPABASE_URL) ? SUPABASE_URL : FALLBACK_SUPABASE_URL;
  const resolvedAnon = SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON;

  return createServerClient<Database>(resolvedUrl, resolvedAnon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // No-op for Server Components where mutating cookies may be restricted.
        }
      },
    },
  });
};
