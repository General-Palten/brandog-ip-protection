const SERPAPI_SEARCH_URL = 'https://serpapi.com/search.json';

export type SerpApiListingKind = 'visual' | 'exact' | 'product';

export interface SerpApiListing {
  kind: SerpApiListingKind;
  link: string;
  title?: string;
  source?: string;
  image?: string;
  thumbnail?: string;
  sellerName?: string;
  priceValue?: number;
  currency?: string;
  priceText?: string;
  rating?: number;
  reviewsCount?: number;
  inStock?: boolean;
  condition?: string;
  position?: number;
  confidence?: number;
  raw: Record<string, unknown>;
}

export interface SerpApiSearchCall {
  endpoint: string;
  ok: boolean;
  status: number;
  payload: Record<string, any>;
  error?: string;
  latencyMs: number;
  query: Record<string, string>;
}

interface SerpApiRequestOptions {
  endpoint: string;
  query: Record<string, string>;
}

const normalizeUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return undefined;
  }
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toBooleanFromAvailability = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  const text = value.trim().toLowerCase();
  if (!text) return undefined;
  if (['in stock', 'available', 'available now', 'instock'].includes(text)) return true;
  if (['out of stock', 'unavailable', 'sold out'].includes(text)) return false;
  return undefined;
};

const readPrice = (
  rawPrice: unknown,
  extractedPrice: unknown,
  currencyRaw: unknown
): { value?: number; currency?: string; text?: string } => {
  const priceText = typeof rawPrice === 'string' ? rawPrice.trim() || undefined : undefined;

  if (rawPrice && typeof rawPrice === 'object') {
    const p = rawPrice as Record<string, unknown>;
    const value = toNumber(p.extracted_value ?? p.value ?? p.amount ?? extractedPrice);
    const currency = typeof (p.currency || currencyRaw) === 'string'
      ? String(p.currency || currencyRaw).trim().toUpperCase() || undefined
      : undefined;
    const text = typeof p.raw === 'string'
      ? p.raw
      : priceText;
    return { value, currency, text };
  }

  return {
    value: toNumber(extractedPrice ?? rawPrice),
    currency: typeof currencyRaw === 'string' ? currencyRaw.trim().toUpperCase() || undefined : undefined,
    text: priceText,
  };
};

const pickString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const pickPosition = (row: Record<string, unknown>): number | undefined => {
  return toNumber(row.position ?? row.rank ?? row.index);
};

const inferConfidence = (kind: SerpApiListingKind, row: Record<string, unknown>): number => {
  const explicit = toNumber(row.score ?? row.match_score ?? row.confidence);
  if (typeof explicit === 'number') {
    if (explicit <= 1) return Math.max(0, Math.min(1, explicit));
    return Math.max(0, Math.min(1, explicit / 100));
  }

  if (kind === 'exact') return 0.95;
  if (kind === 'visual') return 0.8;
  return 0.7;
};

const listingFromRow = (kind: SerpApiListingKind, rowRaw: unknown): SerpApiListing | null => {
  if (!rowRaw || typeof rowRaw !== 'object') return null;
  const row = rowRaw as Record<string, unknown>;

  const link = normalizeUrl(row.link ?? row.url ?? row.product_link ?? row.store_link ?? row.thumbnail_link);
  if (!link) return null;

  const { value: priceValue, currency, text: priceText } = readPrice(
    row.price,
    row.extracted_price ?? row.extracted_value,
    row.currency
  );

  const rating = toNumber(row.rating ?? row.stars);
  const reviewsCount = toNumber(row.reviews ?? row.reviews_count ?? row.review_count);
  const inStock = row.in_stock === undefined
    ? toBooleanFromAvailability(row.availability)
    : (typeof row.in_stock === 'boolean' ? row.in_stock : toBooleanFromAvailability(row.in_stock));

  const title = pickString(row.title ?? row.product_title);
  const source = pickString(row.source ?? row.domain ?? row.platform);
  const sellerName = pickString(row.seller ?? row.seller_name ?? row.store_name ?? source);
  const image = normalizeUrl(row.image ?? row.original_image);
  const thumbnail = normalizeUrl(row.thumbnail ?? row.thumbnail_url);
  const condition = pickString(row.condition);
  const position = pickPosition(row);
  const confidence = inferConfidence(kind, row);

  return {
    kind,
    link,
    title,
    source,
    image,
    thumbnail,
    sellerName,
    priceValue,
    currency,
    priceText,
    rating,
    reviewsCount,
    inStock,
    condition,
    position,
    confidence,
    raw: row,
  };
};

const collectRows = (payload: Record<string, any>): Array<{ kind: SerpApiListingKind; row: unknown }> => {
  const rows: Array<{ kind: SerpApiListingKind; row: unknown }> = [];

  const visual = Array.isArray(payload.visual_matches) ? payload.visual_matches : [];
  for (const row of visual) rows.push({ kind: 'visual', row });

  const exact = Array.isArray(payload.exact_matches) ? payload.exact_matches : [];
  for (const row of exact) rows.push({ kind: 'exact', row });

  const productsArrays = [
    Array.isArray(payload.products) ? payload.products : [],
    Array.isArray(payload.inline_products) ? payload.inline_products : [],
    Array.isArray(payload.products_results) ? payload.products_results : [],
    Array.isArray(payload.shopping_results) ? payload.shopping_results : [],
    Array.isArray(payload.product_results) ? payload.product_results : [],
  ];

  for (const arr of productsArrays) {
    for (const row of arr) rows.push({ kind: 'product', row });
  }

  return rows;
};

export const mergeListingsByUrl = (rows: SerpApiListing[]): SerpApiListing[] => {
  const byUrl = new Map<string, SerpApiListing>();

  for (const row of rows) {
    const existing = byUrl.get(row.link);
    if (!existing) {
      byUrl.set(row.link, row);
      continue;
    }

    const merged: SerpApiListing = {
      ...existing,
      ...row,
      kind: existing.kind === 'exact' || row.kind === 'exact'
        ? 'exact'
        : (existing.kind === 'visual' || row.kind === 'visual' ? 'visual' : 'product'),
      title: row.title || existing.title,
      source: row.source || existing.source,
      image: row.image || existing.image,
      thumbnail: row.thumbnail || existing.thumbnail,
      sellerName: row.sellerName || existing.sellerName,
      priceValue: row.priceValue ?? existing.priceValue,
      currency: row.currency || existing.currency,
      priceText: row.priceText || existing.priceText,
      rating: row.rating ?? existing.rating,
      reviewsCount: row.reviewsCount ?? existing.reviewsCount,
      inStock: row.inStock ?? existing.inStock,
      condition: row.condition || existing.condition,
      position: row.position ?? existing.position,
      confidence: Math.max(existing.confidence ?? 0, row.confidence ?? 0),
      raw: {
        ...existing.raw,
        ...row.raw,
      },
    };

    byUrl.set(row.link, merged);
  }

  return Array.from(byUrl.values());
};

export const parseSerpApiListings = (payload: Record<string, any>): SerpApiListing[] => {
  const parsed: SerpApiListing[] = [];
  for (const item of collectRows(payload)) {
    const mapped = listingFromRow(item.kind, item.row);
    if (mapped) parsed.push(mapped);
  }
  return mergeListingsByUrl(parsed);
};

const executeSerpApiSearch = async ({
  endpoint,
  query,
}: SerpApiRequestOptions): Promise<SerpApiSearchCall> => {
  const params = new URLSearchParams(query);
  const started = Date.now();
  let status = 0;
  try {
    const response = await fetch(`${SERPAPI_SEARCH_URL}?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    status = response.status;
    const payload = await response.json().catch(() => ({}));
    return {
      endpoint,
      ok: response.ok,
      status,
      payload,
      error: response.ok ? undefined : (typeof payload?.error === 'string' ? payload.error : undefined),
      latencyMs: Date.now() - started,
      query,
    };
  } catch (error: any) {
    return {
      endpoint,
      ok: false,
      status,
      payload: {},
      error: error?.message || 'SerpApi request failed',
      latencyMs: Date.now() - started,
      query,
    };
  }
};

export const searchLensAll = async (imageUrl: string, apiKey: string): Promise<SerpApiSearchCall> => {
  return executeSerpApiSearch({
    endpoint: 'lens_all',
    query: {
      engine: 'google_lens',
      type: 'all',
      url: imageUrl,
      api_key: apiKey,
    },
  });
};

export const searchLensProducts = async (imageUrl: string, apiKey: string): Promise<SerpApiSearchCall> => {
  const first = await executeSerpApiSearch({
    endpoint: 'lens_products',
    query: {
      engine: 'google_lens',
      type: 'products',
      url: imageUrl,
      api_key: apiKey,
    },
  });

  if (first.ok) return first;

  const message = (first.error || '').toLowerCase();
  const shouldFallback = message.includes('engine') || message.includes('invalid') || message.includes('parameter');
  if (!shouldFallback) return first;

  const second = await executeSerpApiSearch({
    endpoint: 'lens_products',
    query: {
      engine: 'google_lens_products',
      url: imageUrl,
      api_key: apiKey,
    },
  });

  return second.ok ? second : first;
};

export const extractFollowupSerpApiLinks = (payload: Record<string, any>, limit = 2): string[] => {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const sources = [
    ...(Array.isArray(payload.products) ? payload.products : []),
    ...(Array.isArray(payload.inline_products) ? payload.inline_products : []),
    ...(Array.isArray(payload.products_results) ? payload.products_results : []),
    ...(Array.isArray(payload.shopping_results) ? payload.shopping_results : []),
  ];

  for (const row of sources) {
    if (!row || typeof row !== 'object') continue;
    const link = pickString((row as Record<string, unknown>).serpapi_link);
    if (!link || seen.has(link)) continue;
    if (!/^https:\/\/serpapi\.com\//i.test(link)) continue;
    seen.add(link);
    candidates.push(link);
    if (candidates.length >= Math.max(0, limit)) break;
  }

  return candidates;
};

export const fetchSerpApiFollowupLink = async (
  serpApiLink: string,
  apiKey: string
): Promise<SerpApiSearchCall> => {
  const url = new URL(serpApiLink);
  url.searchParams.set('api_key', apiKey);
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const started = Date.now();
  let status = 0;
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    status = response.status;
    const payload = await response.json().catch(() => ({}));
    return {
      endpoint: 'immersive_product',
      ok: response.ok,
      status,
      payload,
      error: response.ok ? undefined : (typeof payload?.error === 'string' ? payload.error : undefined),
      latencyMs: Date.now() - started,
      query,
    };
  } catch (error: any) {
    return {
      endpoint: 'immersive_product',
      ok: false,
      status,
      payload: {},
      error: error?.message || 'SerpApi follow-up request failed',
      latencyMs: Date.now() - started,
      query,
    };
  }
};
