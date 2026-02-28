// OpenWebNinja Web Unblocker provider.
// Fetches complete HTML from any URL with JS rendering and rotating proxies.
// Used for re-crawling listings to monitor status changes and re-listings.

import { postOpenWebNinja } from './openwebninja-client';

export interface FetchPageResult {
  html: string;
  finalUrl?: string;
  statusCode: number;
  latencyMs: number;
  ok: boolean;
  error?: string;
}

interface UnblockerApiResponse {
  status?: string;
  request_id?: string;
  data?: {
    status?: number;
    final_url?: string;
    headers?: Record<string, string>;
    body?: string;
    [key: string]: unknown;
  };
}

export async function fetchPageHtml(
  targetUrl: string,
  apiKey: string,
  options?: { renderJs?: boolean; waitUntil?: 'domloaded' | 'load' | 'networkidle' }
): Promise<FetchPageResult> {
  const body: Record<string, unknown> = {
    url: targetUrl,
    render_js: options?.renderJs !== false,
  };
  if (options?.waitUntil) body.wait_until = options.waitUntil;

  const result = await postOpenWebNinja<UnblockerApiResponse>({
    service: 'web_unblocker',
    path: '/request',
    params: {},
    apiKey,
    body,
  });

  const html = result.data?.data?.body || '';

  return {
    html: typeof html === 'string' ? html : '',
    finalUrl: result.data?.data?.final_url,
    statusCode: result.data?.data?.status || result.status,
    latencyMs: result.latencyMs,
    ok: result.ok,
    error: result.error,
  };
}

/** Basic heuristic to check if a listing page is still active. */
export function parseListingStatus(html: string, platform: string): {
  isActive: boolean;
  priceMention?: string;
} {
  const lower = html.toLowerCase();

  // Common "removed" signals
  const removedPatterns = [
    'page not found',
    '404',
    'this item is no longer available',
    'this listing has been removed',
    'this product is currently unavailable',
    'no longer available',
    'item has been removed',
    'we can\'t find that page',
    'sorry, this page isn\'t available',
  ];

  for (const pattern of removedPatterns) {
    if (lower.includes(pattern)) {
      return { isActive: false };
    }
  }

  // Look for price mentions as a signal the listing is active
  const priceMatch = html.match(/\$\d+[.,]?\d{0,2}|€\d+[.,]?\d{0,2}|£\d+[.,]?\d{0,2}/);
  const priceMention = priceMatch ? priceMatch[0] : undefined;

  return { isActive: true, priceMention };
}
