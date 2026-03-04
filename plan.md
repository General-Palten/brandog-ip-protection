# OpenWebNinja Integration Plan — Brandog

## Overview

Replace SerpApi + Google Vision with OpenWebNinja APIs via RapidAPI, and add new enrichment capabilities (Product Search, Amazon Data, Website Contacts, Social Links, Web Unblocker). All services are individually toggleable per brand.

---

## Phase 0: Provider Registry Architecture

Build a generic provider registry that makes every OpenWebNinja service a pluggable module with activate/deactivate controls.

### 0.1 — New file: `lib/provider-registry.ts`

Central registry that defines all available providers, their metadata, and toggle state.

```typescript
export type OpenWebNinjaService =
  | 'reverse_image_search'   // Core — replaces SerpApi + Google Vision
  | 'product_search'         // Enrichment — multi-source product data
  | 'amazon_data'            // Enrichment — Amazon-specific seller/product
  | 'website_contacts'       // Enforcement — contact info for takedowns
  | 'social_links'           // Intelligence — cross-platform seller linking
  | 'web_unblocker';         // Monitoring — re-crawl listings

export interface ServiceDefinition {
  key: OpenWebNinjaService;
  label: string;
  description: string;
  category: 'core' | 'enrichment' | 'enforcement' | 'monitoring';
  rapidApiHost: string;
  defaultEnabled: boolean;
  estimatedCostUsd: number;  // per request
}

export const SERVICE_CATALOG: ServiceDefinition[] = [
  {
    key: 'reverse_image_search',
    label: 'Reverse Image Search',
    description: 'Find where brand images appear across the web',
    category: 'core',
    rapidApiHost: 'reverse-image-search1.p.rapidapi.com',
    defaultEnabled: true,
    estimatedCostUsd: 0.0025,
  },
  {
    key: 'product_search',
    label: 'Product Search',
    description: 'Enrich matches with multi-source product data (Google Shopping)',
    category: 'enrichment',
    rapidApiHost: 'real-time-product-search.p.rapidapi.com',
    defaultEnabled: false,
    estimatedCostUsd: 0.0025,
  },
  {
    key: 'amazon_data',
    label: 'Amazon Data',
    description: 'Seller profiles, reviews, and product details from Amazon',
    category: 'enrichment',
    rapidApiHost: 'real-time-amazon-data.p.rapidapi.com',
    defaultEnabled: false,
    estimatedCostUsd: 0.0025,
  },
  {
    key: 'website_contacts',
    label: 'Website Contacts',
    description: 'Auto-extract emails and contact info for takedown notices',
    category: 'enforcement',
    rapidApiHost: 'website-contacts-scraper.p.rapidapi.com',
    defaultEnabled: false,
    estimatedCostUsd: 0.0025,
  },
  {
    key: 'social_links',
    label: 'Social Links',
    description: 'Find seller social profiles across platforms',
    category: 'monitoring',
    rapidApiHost: 'social-links-search.p.rapidapi.com',
    defaultEnabled: false,
    estimatedCostUsd: 0.0025,
  },
  {
    key: 'web_unblocker',
    label: 'Web Unblocker',
    description: 'Re-crawl listings to monitor status changes and re-listings',
    category: 'monitoring',
    rapidApiHost: 'web-unblocker1.p.rapidapi.com',
    defaultEnabled: false,
    estimatedCostUsd: 0.0005,
  },
];
```

### 0.2 — New file: `lib/openwebninja-client.ts`

Shared HTTP client for all OpenWebNinja/RapidAPI calls. Single place for auth, error handling, retries, and telemetry.

```typescript
// Shared fetch wrapper for all RapidAPI calls
// - Injects x-rapidapi-key + x-rapidapi-host headers
// - Handles rate limits (429) with exponential backoff
// - Records to provider_search_runs table
// - Returns typed responses with latency tracking
export async function callOpenWebNinja<T>(options: {
  host: string;
  path: string;
  params: Record<string, string>;
  apiKey: string;
  brandId: string;
  assetId?: string;
  endpoint: string;        // For telemetry: 'reverse_image', 'product_search', etc.
  estimatedCostUsd: number;
}): Promise<{ data: T; latencyMs: number; status: number }>
```

### 0.3 — Database: `scan_settings` table extension

Add per-service toggle columns and a single RapidAPI key field:

```sql
ALTER TABLE scan_settings ADD COLUMN IF NOT EXISTS
  rapidapi_key_configured BOOLEAN DEFAULT FALSE,
  -- Service toggles (per brand)
  enable_reverse_image_search BOOLEAN DEFAULT TRUE,
  enable_product_search BOOLEAN DEFAULT FALSE,
  enable_amazon_data BOOLEAN DEFAULT FALSE,
  enable_website_contacts BOOLEAN DEFAULT FALSE,
  enable_social_links BOOLEAN DEFAULT FALSE,
  enable_web_unblocker BOOLEAN DEFAULT FALSE,
  -- Cost estimates per service (overrideable)
  reverse_image_search_cost_usd DECIMAL(10,6) DEFAULT 0.0025,
  product_search_cost_usd DECIMAL(10,6) DEFAULT 0.0025,
  amazon_data_cost_usd DECIMAL(10,6) DEFAULT 0.0025,
  website_contacts_cost_usd DECIMAL(10,6) DEFAULT 0.0025,
  social_links_cost_usd DECIMAL(10,6) DEFAULT 0.0025,
  web_unblocker_cost_usd DECIMAL(10,6) DEFAULT 0.0005;
```

### 0.4 — Environment variables

```env
# Replace old vars:
# SERPAPI_API_KEY          → RAPIDAPI_KEY
# GEMINI_API_KEY           → (removed, Google Vision no longer needed)
# NEXT_PUBLIC_SERPAPI_SERVER_KEY → NEXT_PUBLIC_RAPIDAPI_CONFIGURED

RAPIDAPI_KEY=your_rapidapi_key_here
NEXT_PUBLIC_RAPIDAPI_CONFIGURED=true
```

### 0.5 — Update `lib/api-config.ts`

- Add `'openwebninja'` to `ImageSearchProvider` type
- Update `getVisionConfig()` to support OpenWebNinja as a provider
- Update `isServerManagedSerpApiEnabled()` → generalize to `isServerManagedProviderEnabled()`
- Keep backward compat with existing SerpApi/Vision configs during transition

### 0.6 — Update `lib/runtime-config.ts`

- Replace `serpApiServerKey` with `rapidApiConfigured` in `RuntimeConfig`
- Update env var references

### 0.7 — Update `provider_fetch_tokens` table

- Expand provider CHECK constraint: `CHECK (provider IN ('serpapi_lens', 'openwebninja'))`
- Or simply remove the constraint and allow any string

### 0.8 — Update `provider_search_runs` table

- The `provider` and `endpoint` columns are already TEXT, no schema change needed
- New provider values: `'openwebninja_reverse_image'`, `'openwebninja_product_search'`, etc.
- New endpoint values: `'reverse-image-search'`, `'search'`, `'product-details'`, etc.

---

## Phase 1: Reverse Image Search (Core — replaces SerpApi + Google Vision)

### 1.1 — New file: `lib/provider-openwebninja-reverse-image.ts`

The core provider module for reverse image search.

**API Details:**
- Host: `reverse-image-search1.p.rapidapi.com`
- Endpoint: `GET /reverse-image-search`
- Params: `url` (image URL, required), `limit` (number of results), `safe_search` ("off" | "blur")
- Response: `{ status, request_id, parameters, data: [{ title, link, domain, logo, date, image, image_width, image_height }] }`

**Functions to implement:**
```typescript
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
  data: ReverseImageResult[];
}

// Main search function
export async function searchReverseImage(imageUrl: string, apiKey: string, limit?: number): Promise<{
  response: ReverseImageResponse;
  latencyMs: number;
}>

// Map to existing VisionSearchResponse format for backward compat
export function mapReverseImageToVisionShape(response: ReverseImageResponse): VisionSearchResponse

// Map to SerpApiListing[] format for scan worker compat
export function mapReverseImageToListings(response: ReverseImageResponse): SerpApiListing[]
```

**Key mapping logic:**
- `data[].link` → `VisionSearchResult.url`
- `data[].title` → `VisionSearchResult.pageTitle`
- `data[].domain` → `VisionSearchResult.source`
- `data[].image` → `VisionSearchResult.fullMatchingImages[0]`
- All results get `confidence: 0.8` (visual match default)
- `data[].link` → `SerpApiListing.link`, kind: `'visual'`

### 1.2 — Update `lib/vision-api.ts`

- Add `searchWithOpenWebNinja(apiKey: string, imageUrl: string, limit?: number)` function
- Update `searchByImage()` dispatch to handle `'openwebninja'` provider
- Update `testVisionApiConnection()` to test OpenWebNinja endpoint
- Keep existing SerpApi and Google Vision paths for backward compat (but deprecated)

### 1.3 — New API route: `app/api/openwebninja/[...path]/route.ts`

Replace the SerpApi proxy with a generic OpenWebNinja proxy:
- Accepts any OpenWebNinja service path
- Injects `RAPIDAPI_KEY` from server env
- Routes to the correct RapidAPI host based on the path prefix
- Returns raw response

### 1.4 — Update `app/api/assets/[assetId]/provider-image-url/route.ts`

- Accept `provider: 'openwebninja'` in addition to `'serpapi_lens'`
- Token generation logic stays the same (HMAC-signed, time-limited)
- Update provider CHECK in token creation

### 1.5 — Update `app/api/scan-worker/run/route.ts`

This is the biggest change. The worker currently calls:
1. `searchLensAll()` → Replace with `searchReverseImage()`
2. `searchLensProducts()` → Replace with Product Search API (Phase 2) or skip if disabled
3. `fetchSerpApiFollowupLink()` → No longer needed (OpenWebNinja returns flat results)

**Changes:**
- Replace SerpApi call chain with single `searchReverseImage()` call
- Parse response via `mapReverseImageToListings()`
- Keep all downstream logic (dedup, whitelist, revenue scoring, evidence, infringements) unchanged
- Update `RAPIDAPI_KEY` env var check instead of `SERPAPI_API_KEY`
- Update telemetry: provider = `'openwebninja_reverse_image'`, endpoint = `'reverse-image-search'`
- Update cost estimate to use `reverse_image_search_cost_usd` from scan_settings

### 1.6 — Update `components/SearchResultsModal.tsx`

- Update provider selection to show "OpenWebNinja" option
- Update search flow to use new provider
- Results display stays the same (consumes normalized `VisionSearchResponse`)

### 1.7 — Update `context/DashboardContext.tsx`

- Update provider constants: add `OPENWEBNINJA_PROVIDER = 'openwebninja'`
- Update `providerToSearchProvider()` mapping
- Update `createInfringementFromSearch()` to record `detection_provider: 'openwebninja'`

### 1.8 — Update `types.ts`

- Add `'openwebninja'` to `ImageSearchProvider` union type
- Keep existing `VisionSearchResponse` and `VisionSearchResult` unchanged (they're the normalized format)

---

## Phase 2: Product Search (Enrichment)

### 2.1 — New file: `lib/provider-openwebninja-product-search.ts`

**API Details:**
- Host: `real-time-product-search.p.rapidapi.com`
- Likely endpoints: `GET /search`, `GET /product/{id}`, `GET /product/{id}/offers`, `GET /product/{id}/reviews`
- Params: `q` (query string), `country`, `language`, `limit`, `sort_by`, `product_condition`
- Response includes: product_id, product_title, product_description, product_photos, product_rating, product_num_reviews, typical_price_range, offers (store_name, price, shipping, condition)

**Functions:**
```typescript
export async function searchProducts(query: string, apiKey: string, options?: {
  country?: string;
  limit?: number;
}): Promise<ProductSearchResponse>

export async function getProductOffers(productId: string, apiKey: string): Promise<ProductOffersResponse>

// Map product offers to SerpApiListing format for scan worker
export function mapProductToListings(products: ProductResult[]): SerpApiListing[]
```

**Integration point:** Called by scan worker AFTER reverse image search, using matched product titles as queries. Only runs if `enable_product_search` is true in scan_settings.

### 2.2 — Update scan worker

Add product enrichment step between image search and infringement creation:
```
1. Reverse Image Search → get visual matches
2. IF enable_product_search:
   For top N matches with product-like domains (amazon, ebay, etc.):
     Call Product Search with match title
     Merge enriched commerce data (price, seller, reviews) into listings
3. Dedup, whitelist, score, create infringements (unchanged)
```

---

## Phase 3: Amazon Data (Enrichment)

### 3.1 — New file: `lib/provider-openwebninja-amazon.ts`

**API Details:**
- Host: `real-time-amazon-data.p.rapidapi.com`
- Endpoints: `GET /product-details`, `GET /product-offers`, `GET /product-reviews`, `GET /seller-profile`, `GET /seller-reviews`, `GET /search`
- Params vary by endpoint: `asin`, `country`, `seller_id`, `query`, etc.

**Functions:**
```typescript
export async function getAmazonProductDetails(asin: string, apiKey: string, country?: string)
export async function getAmazonSellerProfile(sellerId: string, apiKey: string, country?: string)
export async function getAmazonProductReviews(asin: string, apiKey: string, options?: { limit?: number })
export async function searchAmazonProducts(query: string, apiKey: string, options?: { country?: string; limit?: number })
```

**Integration point:** Called by scan worker when an infringement URL is on Amazon. Extracts ASIN from URL, fetches seller profile and product details. Enriches `listing_offers` and `infringement_evidence` with detailed Amazon data.

### 3.2 — Update scan worker

Add Amazon enrichment step:
```
After infringement creation, IF enable_amazon_data:
  For each new infringement on Amazon:
    Extract ASIN from URL
    Fetch product details + seller profile
    Update listing_offers with seller data
    Store enriched evidence
```

---

## Phase 4: Website Contacts (Enforcement)

### 4.1 — New file: `lib/provider-openwebninja-contacts.ts`

**API Details:**
- Host: `website-contacts-scraper.p.rapidapi.com`
- Endpoint: `GET /get-contacts` (likely, parameter: `domain`)
- Returns: emails, phone numbers, social profile URLs

**Functions:**
```typescript
export interface WebsiteContacts {
  emails: string[];
  phones: string[];
  socialLinks: { platform: string; url: string }[];
}

export async function scrapeWebsiteContacts(domain: string, apiKey: string): Promise<WebsiteContacts>
```

**Integration points:**
1. **Scan worker (post-detection):** When new infringement is created on a non-marketplace domain, auto-scrape contacts and store on the takedown request
2. **Manual trigger:** Button in infringement detail view to fetch contacts on demand
3. **Database:** Add `contact_emails TEXT[]`, `contact_phones TEXT[]`, `contact_social JSONB` to `takedown_requests` table (or a new `infringement_contacts` table)

---

## Phase 5: Social Links (Intelligence)

### 5.1 — New file: `lib/provider-openwebninja-social.ts`

**API Details:**
- Host: `social-links-search.p.rapidapi.com`
- Endpoint: `GET /search-social-links` (likely, parameter: `query`)
- Returns: social profiles (Facebook, Instagram, TikTok, LinkedIn, Twitter, GitHub, YouTube, Pinterest, Snapchat)

**Functions:**
```typescript
export interface SocialProfile {
  platform: string;
  url: string;
  name?: string;
}

export async function searchSocialLinks(query: string, apiKey: string): Promise<SocialProfile[]>
```

**Integration points:**
1. **Scan worker (post-detection):** When seller name is extracted, search for their social profiles
2. **Manual trigger:** Button in infringement detail view
3. **Database:** New `seller_social_profiles` table or JSONB column on `listing_offers`
4. **Cross-reference:** Use social profiles to link sellers across marketplaces (network detection)

---

## Phase 6: Web Unblocker (Monitoring)

### 6.1 — New file: `lib/provider-openwebninja-unblocker.ts`

**API Details:**
- Host: `web-unblocker1.p.rapidapi.com`
- Endpoint: `GET /` or `POST /` with `url` param and optional `render_js=true`
- Returns: raw HTML of the target page

**Functions:**
```typescript
export async function fetchPageHtml(targetUrl: string, apiKey: string, options?: {
  renderJs?: boolean;
}): Promise<{ html: string; statusCode: number }>

// Extract listing status from HTML (in stock, price changed, removed, etc.)
export function parseListingStatus(html: string, platform: string): {
  isActive: boolean;
  currentPrice?: number;
  currentTitle?: string;
}
```

**Integration points:**
1. **New scheduled job:** `app/api/recrawl-worker/run/route.ts` — periodically re-crawls active infringement URLs
2. **Updates:** `listing_offers.is_active`, `listing_offers.last_seen_at`, `listing_offers.price_value`
3. **Alerts:** If a previously taken-down listing reappears, create notification
4. **Database:** Add `last_recrawl_at TIMESTAMPTZ`, `recrawl_status TEXT` to `listing_offers`

---

## Phase 7: Settings UI

### 7.1 — New settings section in `components/views/Settings.tsx`

Add an "Integrations" or "Provider Services" section:

```
┌─────────────────────────────────────────────────────┐
│  Provider Services                                   │
│                                                      │
│  RapidAPI Key: ●●●●●●●●●●●●abc  [Change]           │
│  Status: ✓ Connected                                 │
│                                                      │
│  ┌─── Core ─────────────────────────────────────┐   │
│  │ ✓ Reverse Image Search      $0.0025/req      │   │
│  │   Find infringing listings across the web     │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌─── Enrichment ───────────────────────────────┐   │
│  │ ○ Product Search             $0.0025/req      │   │
│  │   Multi-source product data from Google Shop  │   │
│  │                                               │   │
│  │ ○ Amazon Data                $0.0025/req      │   │
│  │   Seller profiles and product details         │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌─── Enforcement ──────────────────────────────┐   │
│  │ ○ Website Contacts           $0.0025/req      │   │
│  │   Auto-extract emails for takedown notices    │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌─── Monitoring ───────────────────────────────┐   │
│  │ ○ Social Links               $0.0025/req      │   │
│  │   Find seller profiles across platforms       │   │
│  │                                               │   │
│  │ ○ Web Unblocker              $0.0005/req      │   │
│  │   Re-crawl listings for status monitoring     │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Estimated cost per 1,000 scans: $2.50 (core only)  │
│  With all services: ~$6.25                           │
│                                                      │
│  [Save Changes]                                      │
└─────────────────────────────────────────────────────┘
```

- Each toggle writes to the corresponding `enable_*` column in `scan_settings`
- RapidAPI key stored server-side only via `RAPIDAPI_KEY` env var (or in scan_settings encrypted)
- Cost estimator updates live as toggles change

---

## Phase 8: Cleanup & Deprecation

### 8.1 — Files to deprecate (keep but mark deprecated):
- `lib/provider-serpapi.ts` — keep for historical evidence replay, add `@deprecated` JSDoc
- `app/api/serpapi/[...path]/route.ts` — keep route but add deprecation warning header

### 8.2 — Files to update:
- `lib/api-config.ts` — default provider → `'openwebninja'`
- `lib/runtime-config.ts` — new env var references
- `lib/provider-token.ts` — expand provider type to include `'openwebninja'`
- `lib/evidence-normalizer.ts` — no changes needed (works with normalized format)
- `lib/scan-cadence.ts` — no changes needed
- `constants.ts` — update provider-related constants
- `README.md` — update env vars, setup instructions
- `claude.md` / `AGENTS.md` — update architecture docs

### 8.3 — Environment cleanup:
- `SERPAPI_API_KEY` → `RAPIDAPI_KEY`
- `NEXT_PUBLIC_SERPAPI_SERVER_KEY` → `NEXT_PUBLIC_RAPIDAPI_CONFIGURED`
- `GEMINI_API_KEY` → removed
- `LENS_TOKEN_SECRET` → `PROVIDER_TOKEN_SECRET` (already supported as fallback)

### 8.4 — Database migration:
- One migration file covering all schema changes:
  - `scan_settings` new columns (Phase 0.3)
  - `provider_fetch_tokens` constraint update (Phase 0.7)
  - Any new tables for contacts/social data (Phases 4-6)
  - Update defaults for existing rows

---

## Implementation Order

| Step | What | Files touched | Depends on |
|------|------|---------------|------------|
| 1 | Provider registry + shared client | `lib/provider-registry.ts`, `lib/openwebninja-client.ts` | — |
| 2 | Database migration | `supabase/migrations/` | — |
| 3 | Reverse Image Search provider | `lib/provider-openwebninja-reverse-image.ts` | Step 1 |
| 4 | Update vision-api.ts dispatch | `lib/vision-api.ts` | Step 3 |
| 5 | Update api-config + runtime-config | `lib/api-config.ts`, `lib/runtime-config.ts` | Step 1 |
| 6 | New proxy route | `app/api/openwebninja/[...path]/route.ts` | Step 1 |
| 7 | Update provider-image-url route | `app/api/assets/[assetId]/provider-image-url/route.ts` | Step 5 |
| 8 | Update scan worker | `app/api/scan-worker/run/route.ts` | Steps 3-7 |
| 9 | Update SearchResultsModal | `components/SearchResultsModal.tsx` | Steps 4-5 |
| 10 | Update DashboardContext | `context/DashboardContext.tsx` | Steps 4-5 |
| 11 | Update types.ts | `types.ts` | Step 3 |
| 12 | Settings UI (toggles) | `components/views/Settings.tsx` | Step 2 |
| 13 | Product Search provider | `lib/provider-openwebninja-product-search.ts` | Step 1 |
| 14 | Amazon Data provider | `lib/provider-openwebninja-amazon.ts` | Step 1 |
| 15 | Website Contacts provider | `lib/provider-openwebninja-contacts.ts` | Step 1 |
| 16 | Social Links provider | `lib/provider-openwebninja-social.ts` | Step 1 |
| 17 | Web Unblocker provider | `lib/provider-openwebninja-unblocker.ts` | Step 1 |
| 18 | Integrate enrichment services into worker | `app/api/scan-worker/run/route.ts` | Steps 13-17 |
| 19 | Recrawl worker (Web Unblocker) | `app/api/recrawl-worker/run/route.ts` | Step 17 |
| 20 | Cleanup & deprecation | Multiple files | All above |
| 21 | Update docs | `README.md`, `claude.md`, `AGENTS.md` | All above |

---

## Risk Mitigation

1. **Response format uncertainty** — OpenWebNinja's Reverse Image Search returns simpler data than SerpApi (no price, seller, rating in image results). The Product Search API fills this gap. Build the mapping layer to gracefully handle missing fields.

2. **Backward compatibility** — Keep SerpApi/Vision provider code intact but deprecated. Existing evidence and infringement records reference `serpapi_lens` / `google_vision` as provider — these stay as-is in the DB.

3. **API key management** — Single RapidAPI key covers all services. If a service is disabled, no calls are made. Budget tracking per-service prevents surprise costs.

4. **Rate limits** — OpenWebNinja's rate limits vary by plan (1-20 req/sec for most services). The scan worker already has `maxParallelScans` — respect this. Add per-service rate limiting in `openwebninja-client.ts`.

5. **Exact endpoint paths** — RapidAPI docs are client-rendered and hard to scrape. For Product Search, Amazon Data, Contacts, Social Links, and Web Unblocker, the exact endpoint paths need to be confirmed from the RapidAPI playground when you subscribe. The provider modules should be structured so endpoint paths are easy to update.
