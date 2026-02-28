// OpenWebNinja Social Links Search provider.
// Finds social profiles across platforms for seller identification.

import { callOpenWebNinja } from './openwebninja-client';
import type { SerpApiSearchCall } from './provider-serpapi';

export interface SocialProfile {
  platform: string;
  url: string;
}

interface SocialLinksApiResponse {
  status: string;
  request_id?: string;
  data?: Record<string, string[]>;
}

export async function searchSocialLinks(
  query: string,
  apiKey: string,
  options?: { socialNetworks?: string }
): Promise<{ profiles: SocialProfile[]; latencyMs: number; ok: boolean; error?: string }> {
  const params: Record<string, string> = { query };
  if (options?.socialNetworks) params.social_networks = options.socialNetworks;

  const result = await callOpenWebNinja<SocialLinksApiResponse>({
    service: 'social_links',
    path: '/search-social-links',
    params,
    apiKey,
  });

  if (!result.ok || !result.data?.data || typeof result.data.data !== 'object') {
    return { profiles: [], latencyMs: result.latencyMs, ok: result.ok, error: result.error };
  }

  const profiles: SocialProfile[] = [];
  const seen = new Set<string>();

  for (const [platform, urls] of Object.entries(result.data.data)) {
    if (!Array.isArray(urls)) continue;
    for (const url of urls) {
      const trimmed = (url || '').trim();
      if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
      seen.add(trimmed.toLowerCase());
      profiles.push({ platform, url: trimmed });
    }
  }

  return { profiles, latencyMs: result.latencyMs, ok: true };
}

export function toSocialLinksSearchCallShape(
  result: { ok: boolean; latencyMs: number; error?: string },
  profiles: SocialProfile[],
  query: string
): SerpApiSearchCall {
  return {
    endpoint: 'openwebninja_social_links',
    ok: result.ok,
    status: result.ok ? 200 : 0,
    payload: { profiles_count: profiles.length } as unknown as Record<string, any>,
    error: result.error,
    latencyMs: result.latencyMs,
    query: { query, service: 'social_links' },
  };
}

function inferPlatform(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('facebook.com')) return 'facebook';
  if (lower.includes('instagram.com')) return 'instagram';
  if (lower.includes('tiktok.com')) return 'tiktok';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter';
  if (lower.includes('linkedin.com')) return 'linkedin';
  if (lower.includes('youtube.com')) return 'youtube';
  if (lower.includes('pinterest.com')) return 'pinterest';
  if (lower.includes('github.com')) return 'github';
  if (lower.includes('snapchat.com')) return 'snapchat';
  return 'other';
}
