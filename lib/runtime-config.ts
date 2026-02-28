/**
 * Runtime configuration that works both server-side and client-side.
 *
 * Server-side: Reads directly from process.env (works at runtime)
 * Client-side: Reads from window.__RUNTIME_CONFIG__ injected by the server
 */

export interface RuntimeConfig {
  bypassAuth: boolean;
  bypassRole: 'admin' | 'brand';
  serpApiServerKey: boolean;
  rapidApiConfigured: boolean;
}

// Server-side: read directly from env vars
export function getServerRuntimeConfig(): RuntimeConfig {
  return {
    bypassAuth: process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true',
    bypassRole: process.env.NEXT_PUBLIC_BYPASS_ROLE === 'admin' ? 'admin' : 'brand',
    serpApiServerKey: process.env.NEXT_PUBLIC_SERPAPI_SERVER_KEY === 'true',
    rapidApiConfigured: process.env.NEXT_PUBLIC_RAPIDAPI_CONFIGURED === 'true',
  };
}

// Client-side: read from injected window variable
function getClientRuntimeConfig(): RuntimeConfig {
  if (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__) {
    return (window as any).__RUNTIME_CONFIG__ as RuntimeConfig;
  }

  // Fallback to build-time env vars if server injection hasn't happened
  return {
    bypassAuth: process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true',
    bypassRole: process.env.NEXT_PUBLIC_BYPASS_ROLE === 'admin' ? 'admin' : 'brand',
    serpApiServerKey: process.env.NEXT_PUBLIC_SERPAPI_SERVER_KEY === 'true',
    rapidApiConfigured: process.env.NEXT_PUBLIC_RAPIDAPI_CONFIGURED === 'true',
  };
}

// Universal getter - works on both server and client
function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined') {
    // Server-side
    return getServerRuntimeConfig();
  }
  // Client-side
  return getClientRuntimeConfig();
}

export const isBypassAuthEnabled = (): boolean => {
  return getRuntimeConfig().bypassAuth;
};

export const getBypassRole = (): 'admin' | 'brand' => {
  return getRuntimeConfig().bypassRole;
};

export const isSerpApiServerKeyEnabled = (): boolean => {
  return getRuntimeConfig().serpApiServerKey;
};

export const isRapidApiConfigured = (): boolean => {
  return getRuntimeConfig().rapidApiConfigured;
};

export const isSupabaseEnvConfigured = (): boolean => {
  const url = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anon = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return Boolean(
    url && anon && isLikelyHttpUrl(url)
  );
};
import { isLikelyHttpUrl, sanitizeEnvValue } from './supabase-env';
