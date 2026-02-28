// OpenWebNinja Web Unblocker provider.
// Fetches complete HTML from any URL with JS rendering and rotating proxies.
// Used for re-crawling listings to monitor status changes and re-listings.

import { postOpenWebNinja } from './openwebninja-client';

export interface FetchPageResult {
  html: string;
  statusCode: number;
  latencyMs: number;
  ok: boolean;
  error?: string;
}

interface UnblockerApiResponse {
  status?: string;
  html?: string;
  result?: string;
  [key: string]: unknown;
}

export async function fetchPageHtml(
  targetUrl: string,
  apiKey: string,
  options?: { renderJs?: boolean }
): Promise<FetchPageResult> {
  const params: Record<string, string> = {
    url: targetUrl,
  };
  if (options?.renderJs !== false) {
    params.render_js = 'true';
  }

  const result = await postOpenWebNinja<UnblockerApiResponse>({
    service: 'web_unblocker',
    path: '/',
    params,
    apiKey,
    body: { url: targetUrl, render_js: options?.renderJs !== false },
  });

  const html = result.data?.html || result.data?.result || '';

  return {
    html: typeof html === 'string' ? html : '',
    statusCode: result.status,
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
