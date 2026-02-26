import type { SerpApiListing } from './provider-serpapi';

export interface EvidenceSnapshot {
  listingUrl: string;
  title?: string;
  source?: string;
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
  image?: string;
  thumbnail?: string;
  kind: string;
}

export const normalizeEvidenceSnapshot = (listing: SerpApiListing): EvidenceSnapshot => {
  return {
    listingUrl: listing.link,
    title: listing.title,
    source: listing.source,
    sellerName: listing.sellerName,
    priceValue: listing.priceValue,
    currency: listing.currency,
    priceText: listing.priceText,
    rating: listing.rating,
    reviewsCount: listing.reviewsCount,
    inStock: listing.inStock,
    condition: listing.condition,
    position: listing.position,
    confidence: listing.confidence,
    image: listing.image,
    thumbnail: listing.thumbnail,
    kind: listing.kind,
  };
};

export const buildEvidenceBundle = (
  listing: SerpApiListing,
  payloads: Record<string, any>[]
): { normalized: Record<string, unknown>; raw: Record<string, unknown> } => {
  const normalized = {
    snapshot: normalizeEvidenceSnapshot(listing),
    payload_count: payloads.length,
  };

  const raw = {
    listing: listing.raw,
    provider_payloads: payloads,
  };

  return { normalized, raw };
};
