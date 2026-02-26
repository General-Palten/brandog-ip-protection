import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { isLikelyHttpUrl, sanitizeEnvValue } from './supabase-env';

const SUPABASE_URL = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = sanitizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

let client: SupabaseClient<Database> | null = null;

export const getSupabaseService = (): SupabaseClient<Database> => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !isLikelyHttpUrl(SUPABASE_URL)) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is not set for service client');
  }
  if (client) return client;
  client = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
};
