// OpenWebNinja Real-Time Lens Data provider.
// Visual matches, object detection, and OCR via Google Lens.

import { callOpenWebNinja } from './openwebninja-client';
import type { SerpApiListing, SerpApiSearchCall } from './provider-serpapi';

export interface LensVisualMatch {
  position: number;
  title: string;
  link: string;
  source: string;
  source_icon?: string;
  thumbnail?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  image?: string;
  image_width?: number;
  image_height?: number;
}

export interface LensSearchResponse {
  status: string;
  request_id: string;
  parameters: {
    url: string;
    language?: string;
    country?: string;
  };
  data: {
    visual_matches?: LensVisualMatch[];
    knowledge_graph?: Record<string, unknown>;
  };
}

export interface LensObjectDetection {
  label: string;
  box: { left: number; top: number; width: number; height: number };
}

export interface LensObjectDetectionResponse {
  status: string;
  request_id: string;
  data: {
    main_detection?: LensObjectDetection;
    detections: LensObjectDetection[];
    detection_count: number;
  };
}

export async function searchLens(
  imageUrl: string,
  apiKey: string,
  options?: { language?: string; country?: string; query?: string }
): Promise<{ data: LensSearchResponse | null; latencyMs: number; ok: boolean; error?: string }> {
  const params: Record<string, string> = { url: imageUrl };
  if (options?.language) params.language = options.language;
  if (options?.country) params.country = options.country;
  if (options?.query) params.query = options.query;

  const result = await callOpenWebNinja<LensSearchResponse>({
    service: 'realtime_lens_data',
    path: '/search',
    params,
    apiKey,
  });

  return {
    data: result.ok ? result.data : null,
    latencyMs: result.latencyMs,
    ok: result.ok,
    error: result.error,
  };
}

export async function getVisualMatches(
  imageUrl: string,
  apiKey: string,
  options?: { language?: string; country?: string; query?: string }
): Promise<{ data: LensVisualMatch[]; latencyMs: number; ok: boolean; error?: string }> {
  const params: Record<string, string> = { url: imageUrl };
  if (options?.language) params.language = options.language;
  if (options?.country) params.country = options.country;
  if (options?.query) params.query = options.query;

  const result = await callOpenWebNinja<{ status: string; data: LensVisualMatch[] }>({
    service: 'realtime_lens_data',
    path: '/visual-matches',
    params,
    apiKey,
  });

  return {
    data: result.ok ? result.data?.data || [] : [],
    latencyMs: result.latencyMs,
    ok: result.ok,
    error: result.error,
  };
}

export async function detectObjects(
  imageUrl: string,
  apiKey: string
): Promise<{ data: LensObjectDetectionResponse | null; latencyMs: number; ok: boolean; error?: string }> {
  const result = await callOpenWebNinja<LensObjectDetectionResponse>({
    service: 'realtime_lens_data',
    path: '/object-detection',
    params: { url: imageUrl },
    apiKey,
  });

  return {
    data: result.ok ? result.data : null,
    latencyMs: result.latencyMs,
    ok: result.ok,
    error: result.error,
  };
}

export async function extractText(
  imageUrl: string,
  apiKey: string,
  language = 'en'
): Promise<{ data: Record<string, unknown> | null; latencyMs: number; ok: boolean; error?: string }> {
  const result = await callOpenWebNinja<{ status: string; data: Record<string, unknown> }>({
    service: 'realtime_lens_data',
    path: '/ocr',
    params: { url: imageUrl, language },
    apiKey,
  });

  return {
    data: result.ok ? result.data?.data || null : null,
    latencyMs: result.latencyMs,
    ok: result.ok,
    error: result.error,
  };
}

// ---------------------------------------------------------------------------
// Map Lens visual matches → SerpApiListing[] for scan pipeline
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

export function mapVisualMatchesToListings(matches: LensVisualMatch[]): SerpApiListing[] {
  const listings: SerpApiListing[] = [];

  for (const match of matches) {
    const link = normalizeUrl(match.link);
    if (!link) continue;

    listings.push({
      kind: 'visual',
      link,
      title: match.title || undefined,
      source: match.source || undefined,
      image: normalizeUrl(match.image) || undefined,
      thumbnail: normalizeUrl(match.thumbnail) || normalizeUrl(match.source_icon) || undefined,
      confidence: 0.75,
      position: match.position,
      raw: match as unknown as Record<string, unknown>,
    });
  }

  return listings;
}

// ---------------------------------------------------------------------------
// Adapter: produce a SerpApiSearchCall-compatible object for telemetry
// ---------------------------------------------------------------------------

export function toLensSearchCallShape(
  result: { ok: boolean; latencyMs: number; error?: string },
  matches: LensVisualMatch[],
  imageUrl: string
): SerpApiSearchCall {
  return {
    endpoint: 'openwebninja_lens_visual_matches',
    ok: result.ok,
    status: result.ok ? 200 : 0,
    payload: { matches_count: matches.length, matches } as unknown as Record<string, any>,
    error: result.error,
    latencyMs: result.latencyMs,
    query: { url: imageUrl, service: 'realtime_lens_data' },
  };
}
