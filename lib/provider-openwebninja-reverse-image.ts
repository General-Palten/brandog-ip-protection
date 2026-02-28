// OpenWebNinja Reverse Image Search provider.
// Replaces SerpApi Google Lens and Google Vision for brand image detection.

import { callOpenWebNinja, type OpenWebNinjaCallResult } from './openwebninja-client';
import type { VisionSearchResponse, VisionSearchResult, VisionWebEntity } from '../types';
import type { SerpApiListing, SerpApiSearchCall } from './provider-serpapi';

// ---------------------------------------------------------------------------
// Response types (from OpenWebNinja Reverse Image Search API)
// ---------------------------------------------------------------------------

export interface ReverseImageResult {
  title: string;
  link: string;
  domain: string;
  logo: string | null;
  date: string | null;
  image: string | null;
  image_width: number | null;
  image_height: number | null;
}

export interface ReverseImageResponse {
  status: string;
  request_id: string;
  parameters: {
    url: string;
    safe_search: string;
    limit: number;
  };
  data: ReverseImageResult[];
}

// ---------------------------------------------------------------------------
// Search function
// ---------------------------------------------------------------------------

export async function searchReverseImage(
  imageUrl: string,
  apiKey: string,
  limit = 50
): Promise<{ response: ReverseImageResponse; latencyMs: number; status: number; ok: boolean; error?: string }> {
  const result = await callOpenWebNinja<ReverseImageResponse>({
    service: 'reverse_image_search',
    path: '/reverse-image-search',
    params: {
      url: imageUrl,
      limit: String(limit),
      safe_search: 'off',
    },
    apiKey,
  });

  return {
    response: result.data,
    latencyMs: result.latencyMs,
    status: result.status,
    ok: result.ok,
    error: result.error,
  };
}

// ---------------------------------------------------------------------------
// Map to VisionSearchResponse (backward compat with frontend)
// ---------------------------------------------------------------------------

const normalizeUrl = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return undefined;
  }
};

export function mapReverseImageToVisionShape(response: ReverseImageResponse): VisionSearchResponse {
  const data = Array.isArray(response?.data) ? response.data : [];

  const pagesWithMatchingImages: VisionSearchResult[] = [];
  const fullMatchingImageUrls: string[] = [];

  for (const item of data) {
    const pageUrl = normalizeUrl(item.link);
    if (!pageUrl) continue;

    const imageUrl = normalizeUrl(item.image);
    const fullMatchingImages = imageUrl ? [imageUrl] : [];
    if (imageUrl) fullMatchingImageUrls.push(imageUrl);

    pagesWithMatchingImages.push({
      url: pageUrl,
      pageTitle: item.title || undefined,
      fullMatchingImages,
      partialMatchingImages: [],
      score: 0.8,
      source: item.domain || undefined,
      confidence: 0.8,
    });
  }

  const seen = new Set<string>();
  const fullMatchingImages = fullMatchingImageUrls
    .filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .map((url) => ({ url }));

  return {
    pagesWithMatchingImages,
    fullMatchingImages,
    partialMatchingImages: [],
    visuallySimilarImages: [],
    webEntities: [],
  };
}

// ---------------------------------------------------------------------------
// Map to SerpApiListing[] (backward compat with scan worker pipeline)
// ---------------------------------------------------------------------------

export function mapReverseImageToListings(response: ReverseImageResponse): SerpApiListing[] {
  const data = Array.isArray(response?.data) ? response.data : [];
  const listings: SerpApiListing[] = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const link = normalizeUrl(item.link);
    if (!link) continue;

    listings.push({
      kind: 'visual',
      link,
      title: item.title || undefined,
      source: item.domain || undefined,
      image: normalizeUrl(item.image) || undefined,
      thumbnail: normalizeUrl(item.logo) || undefined,
      confidence: 0.8,
      position: i + 1,
      raw: item as unknown as Record<string, unknown>,
    });
  }

  return listings;
}

// ---------------------------------------------------------------------------
// Adapter: produce a SerpApiSearchCall-compatible object for telemetry
// ---------------------------------------------------------------------------

export function toSearchCallShape(
  result: { ok: boolean; status: number; latencyMs: number; error?: string },
  response: ReverseImageResponse,
  imageUrl: string
): SerpApiSearchCall {
  return {
    endpoint: 'openwebninja_reverse_image',
    ok: result.ok,
    status: result.status,
    payload: response as unknown as Record<string, any>,
    error: result.error,
    latencyMs: result.latencyMs,
    query: { url: imageUrl, service: 'reverse_image_search' },
  };
}
