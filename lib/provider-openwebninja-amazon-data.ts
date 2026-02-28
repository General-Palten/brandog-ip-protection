// OpenWebNinja Real-Time Amazon Data provider.
// Search Amazon products, get product details, seller profiles, and offers
// for counterfeit detection and enforcement on Amazon marketplace.

import { callOpenWebNinja } from './openwebninja-client';
import type { SerpApiListing, SerpApiSearchCall } from './provider-serpapi';

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface AmazonProduct {
  asin: string;
  product_title: string;
  product_price: string | null;
  product_original_price: string | null;
  currency: string;
  product_star_rating: string | null;
  product_num_ratings: number | null;
  product_url: string;
  product_photo: string | null;
  product_num_offers: number | null;
  product_minimum_offer_price: string | null;
  is_best_seller: boolean;
  is_amazon_choice: boolean;
  is_prime: boolean;
  sales_volume: string | null;
  delivery: string | null;
  has_variations: boolean;
  product_badge?: string | null;
  product_availability?: string | null;
  brand?: string | null;
}

export interface AmazonSearchResponse {
  status: string;
  request_id: string;
  parameters: Record<string, unknown>;
  data: {
    total_products: number;
    country: string;
    domain: string;
    products: AmazonProduct[];
  };
}

export interface AmazonProductDetail {
  asin: string;
  product_title: string;
  product_price: string | null;
  product_original_price: string | null;
  currency: string;
  product_star_rating: string | null;
  product_num_ratings: number | null;
  product_url: string;
  product_photo: string | null;
  product_num_offers: number | null;
  product_byline?: string | null;
  product_description?: string | null;
  product_information?: Record<string, string>;
  product_photos?: string[];
  brand?: string | null;
  seller_id?: string | null;
  seller_name?: string | null;
}

export interface AmazonProductDetailResponse {
  status: string;
  request_id: string;
  data: AmazonProductDetail;
}

export interface AmazonSellerProfile {
  seller_id: string;
  name: string;
  seller_link: string;
  store_link?: string;
  logo?: string;
  phone?: string;
  business_name?: string;
  business_address?: string;
  rating: number | null;
  ratings_total: number | null;
}

export interface AmazonSellerProfileResponse {
  status: string;
  request_id: string;
  data: AmazonSellerProfile;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function searchAmazonProducts(
  query: string,
  apiKey: string,
  options?: { country?: string; page?: number; sort_by?: string; brand?: string; min_price?: number; max_price?: number }
): Promise<{ data: AmazonSearchResponse | null; latencyMs: number; ok: boolean; error?: string }> {
  const params: Record<string, string> = { query };
  if (options?.country) params.country = options.country;
  if (options?.page) params.page = String(options.page);
  if (options?.sort_by) params.sort_by = options.sort_by;
  if (options?.brand) params.brand = options.brand;
  if (options?.min_price) params.min_price = String(options.min_price);
  if (options?.max_price) params.max_price = String(options.max_price);

  const result = await callOpenWebNinja<AmazonSearchResponse>({
    service: 'realtime_amazon_data',
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

export async function getAmazonProductDetails(
  asin: string,
  apiKey: string,
  options?: { country?: string }
): Promise<{ data: AmazonProductDetailResponse | null; latencyMs: number; ok: boolean; error?: string }> {
  const params: Record<string, string> = { asin };
  if (options?.country) params.country = options.country;

  const result = await callOpenWebNinja<AmazonProductDetailResponse>({
    service: 'realtime_amazon_data',
    path: '/product-details',
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

export async function getAmazonSellerProfile(
  sellerId: string,
  apiKey: string,
  options?: { country?: string }
): Promise<{ data: AmazonSellerProfileResponse | null; latencyMs: number; ok: boolean; error?: string }> {
  const params: Record<string, string> = { seller_id: sellerId };
  if (options?.country) params.country = options.country;

  const result = await callOpenWebNinja<AmazonSellerProfileResponse>({
    service: 'realtime_amazon_data',
    path: '/seller-profile',
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parsePrice = (priceStr: string | null | undefined): { value?: number; currency?: string; text?: string } => {
  if (!priceStr) return {};
  const cleaned = priceStr.replace(/[^0-9.,]/g, '').replace(',', '');
  const value = parseFloat(cleaned);
  const currency = priceStr.startsWith('$') ? 'USD' : priceStr.startsWith('€') ? 'EUR' : priceStr.startsWith('£') ? 'GBP' : undefined;
  return {
    value: Number.isFinite(value) ? value : undefined,
    currency,
    text: priceStr,
  };
};

export function extractAsinFromUrl(url: string): string | null {
  // Match /dp/ASIN or /gp/product/ASIN patterns
  const match = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Map Amazon products → SerpApiListing[] for scan pipeline
// ---------------------------------------------------------------------------

export function mapAmazonProductsToListings(products: AmazonProduct[]): SerpApiListing[] {
  const listings: SerpApiListing[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    if (!p.product_url) continue;

    const price = parsePrice(p.product_price);

    listings.push({
      kind: 'product',
      link: p.product_url,
      title: p.product_title,
      source: 'Amazon',
      image: p.product_photo || undefined,
      priceValue: price.value,
      currency: price.currency || p.currency,
      priceText: price.text,
      rating: p.product_star_rating ? parseFloat(p.product_star_rating) : undefined,
      reviewsCount: p.product_num_ratings || undefined,
      inStock: p.product_availability ? !p.product_availability.toLowerCase().includes('unavailable') : true,
      condition: undefined,
      position: i + 1,
      confidence: 0.7,
      raw: p as unknown as Record<string, unknown>,
    });
  }

  return listings;
}

// ---------------------------------------------------------------------------
// Telemetry adapter
// ---------------------------------------------------------------------------

export function toAmazonSearchCallShape(
  result: { ok: boolean; latencyMs: number; error?: string },
  productCount: number,
  query: string
): SerpApiSearchCall {
  return {
    endpoint: 'openwebninja_amazon_search',
    ok: result.ok,
    status: result.ok ? 200 : 0,
    payload: { products_count: productCount } as unknown as Record<string, any>,
    error: result.error,
    latencyMs: result.latencyMs,
    query: { query, service: 'realtime_amazon_data' },
  };
}
