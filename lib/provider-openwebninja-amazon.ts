// OpenWebNinja Amazon Data provider.
// Seller profiles, product details, and reviews from Amazon.

import { callOpenWebNinja } from './openwebninja-client';

export interface AmazonProductDetails {
  asin: string;
  product_title: string;
  product_price?: string;
  product_original_price?: string;
  product_star_rating?: string;
  product_num_ratings?: number;
  product_url?: string;
  product_photo?: string;
  product_photos?: string[];
  is_best_seller?: boolean;
  is_amazon_choice?: boolean;
  seller_name?: string;
  seller_id?: string;
  fulfilled_by_amazon?: boolean;
  product_availability?: string;
  product_description?: string;
}

export interface AmazonSellerProfile {
  seller_id: string;
  seller_name: string;
  seller_rating?: number;
  seller_num_ratings?: number;
  seller_description?: string;
  seller_country?: string;
  business_name?: string;
  business_address?: string;
}

export interface AmazonProductReview {
  review_id: string;
  review_title: string;
  review_text: string;
  review_star_rating: string;
  review_author: string;
  review_date: string;
  is_verified_purchase?: boolean;
}

export async function getProductDetails(
  asin: string,
  apiKey: string,
  country = 'US'
): Promise<{ data: AmazonProductDetails | null; latencyMs: number; ok: boolean; error?: string }> {
  const result = await callOpenWebNinja<{ status: string; data: AmazonProductDetails }>({
    service: 'amazon_data',
    path: '/product-details',
    params: { asin, country },
    apiKey,
  });

  return {
    data: result.ok ? result.data?.data || null : null,
    latencyMs: result.latencyMs,
    ok: result.ok,
    error: result.error,
  };
}

export async function getSellerProfile(
  sellerId: string,
  apiKey: string,
  country = 'US'
): Promise<{ data: AmazonSellerProfile | null; latencyMs: number; ok: boolean; error?: string }> {
  const result = await callOpenWebNinja<{ status: string; data: AmazonSellerProfile }>({
    service: 'amazon_data',
    path: '/seller-profile',
    params: { seller_id: sellerId, country },
    apiKey,
  });

  return {
    data: result.ok ? result.data?.data || null : null,
    latencyMs: result.latencyMs,
    ok: result.ok,
    error: result.error,
  };
}

export async function getProductReviews(
  asin: string,
  apiKey: string,
  options?: { country?: string; limit?: number }
): Promise<{ data: AmazonProductReview[]; latencyMs: number; ok: boolean; error?: string }> {
  const params: Record<string, string> = { asin };
  if (options?.country) params.country = options.country;
  if (options?.limit) params.limit = String(options.limit);

  const result = await callOpenWebNinja<{ status: string; data: { reviews: AmazonProductReview[] } }>({
    service: 'amazon_data',
    path: '/product-reviews',
    params,
    apiKey,
  });

  return {
    data: result.ok ? result.data?.data?.reviews || [] : [],
    latencyMs: result.latencyMs,
    ok: result.ok,
    error: result.error,
  };
}

/** Extract ASIN from an Amazon URL. Returns null if not an Amazon URL or ASIN not found. */
export function extractAsinFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('amazon')) return null;

    // Patterns: /dp/ASIN, /gp/product/ASIN, /product/ASIN
    const patterns = [
      /\/dp\/([A-Z0-9]{10})/i,
      /\/gp\/product\/([A-Z0-9]{10})/i,
      /\/product\/([A-Z0-9]{10})/i,
    ];

    for (const pattern of patterns) {
      const match = parsed.pathname.match(pattern);
      if (match) return match[1].toUpperCase();
    }

    return null;
  } catch {
    return null;
  }
}

/** Extract Amazon domain country code (US, UK, DE, etc.) */
export function extractAmazonCountry(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('.co.uk')) return 'UK';
    if (host.includes('.de')) return 'DE';
    if (host.includes('.fr')) return 'FR';
    if (host.includes('.it')) return 'IT';
    if (host.includes('.es')) return 'ES';
    if (host.includes('.ca')) return 'CA';
    if (host.includes('.com.au')) return 'AU';
    if (host.includes('.co.jp') || host.includes('.jp')) return 'JP';
    if (host.includes('.in')) return 'IN';
    if (host.includes('.com.br')) return 'BR';
    return 'US';
  } catch {
    return 'US';
  }
}
