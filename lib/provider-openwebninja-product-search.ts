// OpenWebNinja Product Search provider.
// Multi-source product aggregation via Google Shopping.

import { callOpenWebNinja } from './openwebninja-client';
import type { SerpApiListing } from './provider-serpapi';

export interface ProductOffer {
  store_name: string;
  store_rating?: number;
  offer_page_url: string;
  price: string;
  shipping?: string;
  tax?: string;
  on_sale?: boolean;
  product_condition?: string;
}

export interface ProductResult {
  product_id: string;
  product_title: string;
  product_description?: string;
  product_photos?: string[];
  product_rating?: number;
  product_num_reviews?: number;
  product_num_offers?: number;
  typical_price_range?: string[];
  offer?: ProductOffer;
}

export interface ProductSearchResponse {
  status: string;
  request_id: string;
  data: ProductResult[];
}

export async function searchProducts(
  query: string,
  apiKey: string,
  options?: { country?: string; limit?: number }
): Promise<{ response: ProductSearchResponse; latencyMs: number; ok: boolean; error?: string }> {
  const params: Record<string, string> = { q: query };
  if (options?.country) params.country = options.country;
  if (options?.limit) params.limit = String(options.limit);

  const result = await callOpenWebNinja<ProductSearchResponse>({
    service: 'product_search',
    path: '/search-v2',
    params,
    apiKey,
  });

  return {
    response: result.data,
    latencyMs: result.latencyMs,
    ok: result.ok,
    error: result.error,
  };
}

export async function getProductOffers(
  productId: string,
  apiKey: string
): Promise<{ response: Record<string, any>; latencyMs: number; ok: boolean; error?: string }> {
  const result = await callOpenWebNinja({
    service: 'product_search',
    path: '/product-offers-v2',
    params: { product_id: productId },
    apiKey,
  });

  return {
    response: result.data,
    latencyMs: result.latencyMs,
    ok: result.ok,
    error: result.error,
  };
}

const parsePrice = (priceStr: string | undefined): { value?: number; currency?: string; text?: string } => {
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

export function mapProductsToListings(products: ProductResult[]): SerpApiListing[] {
  const listings: SerpApiListing[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const offer = p.offer;
    const link = offer?.offer_page_url;
    if (!link) continue;

    const price = parsePrice(offer?.price);

    listings.push({
      kind: 'product',
      link,
      title: p.product_title,
      source: offer?.store_name,
      image: p.product_photos?.[0],
      sellerName: offer?.store_name,
      priceValue: price.value,
      currency: price.currency,
      priceText: price.text,
      rating: p.product_rating,
      reviewsCount: p.product_num_reviews,
      condition: offer?.product_condition,
      position: i + 1,
      confidence: 0.7,
      raw: p as unknown as Record<string, unknown>,
    });
  }

  return listings;
}
