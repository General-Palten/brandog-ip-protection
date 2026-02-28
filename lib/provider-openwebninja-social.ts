// OpenWebNinja Social Links Search provider.
// Finds social profiles across platforms for seller identification.

import { callOpenWebNinja } from './openwebninja-client';

export interface SocialProfile {
  platform: string;
  url: string;
  name?: string;
}

interface SocialLinksApiResponse {
  status: string;
  request_id?: string;
  data?: Array<{
    platform?: string;
    url?: string;
    name?: string;
    [key: string]: unknown;
  }>;
}

export async function searchSocialLinks(
  query: string,
  apiKey: string,
  options?: { limit?: number }
): Promise<{ profiles: SocialProfile[]; latencyMs: number; ok: boolean; error?: string }> {
  const params: Record<string, string> = { query };
  if (options?.limit) params.limit = String(options.limit);

  const result = await callOpenWebNinja<SocialLinksApiResponse>({
    service: 'social_links',
    path: '/search-social-links',
    params,
    apiKey,
  });

  if (!result.ok || !Array.isArray(result.data?.data)) {
    return { profiles: [], latencyMs: result.latencyMs, ok: result.ok, error: result.error };
  }

  const profiles: SocialProfile[] = [];
  const seen = new Set<string>();

  for (const item of result.data.data) {
    const url = (item.url || '').trim();
    if (!url || seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());

    profiles.push({
      platform: item.platform || inferPlatform(url),
      url,
      name: item.name || undefined,
    });
  }

  return { profiles, latencyMs: result.latencyMs, ok: true };
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
