// Reverse image search client supporting Google Vision, SerpApi Google Lens, and OpenWebNinja.

import { VisionSearchResponse, VisionSearchResult, VisionWebEntity } from '../types';
import { getVisionConfig, isServerManagedSerpApiEnabled, isServerManagedRapidApiEnabled, type ImageSearchProvider } from './api-config';
import { parseSerpApiListings } from './provider-serpapi';
import { searchReverseImage, mapReverseImageToVisionShape } from './provider-openwebninja-reverse-image';

const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';
const SERPAPI_PROXY_URL = '/api/serpapi/search.json';
const SERPAPI_ENGINE = 'google_lens';
const SERPAPI_DEFAULT_TYPE = 'all';
const SERPAPI_TEST_IMAGE_URL = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg';
const SERPAPI_REQUEST_URL: string = SERPAPI_PROXY_URL;
const SERPAPI_NO_RESULTS_PATTERN = /hasn't returned any results|did not return any results|no results/i;
const SERPAPI_CREDENTIAL_PATTERN = /invalid api key|missing api key|unauthorized|forbidden|access denied|not authorized/i;
const SERPAPI_QUOTA_PATTERN = /run out|insufficient|quota|limit|billing/i;

interface VisionApiRequest {
  requests: {
    image: {
      content: string; // base64 encoded image
    };
    features: {
      type: string;
      maxResults?: number;
    }[];
  }[];
}

interface VisionApiResponse {
  responses: {
    webDetection?: {
      webEntities?: {
        entityId: string;
        description: string;
        score: number;
      }[];
      fullMatchingImages?: {
        url: string;
      }[];
      partialMatchingImages?: {
        url: string;
      }[];
      pagesWithMatchingImages?: {
        url: string;
        pageTitle?: string;
        fullMatchingImages?: { url: string }[];
        partialMatchingImages?: { url: string }[];
      }[];
      visuallySimilarImages?: {
        url: string;
      }[];
    };
    error?: {
      code: number;
      message: string;
    };
  }[];
}

interface SerpApiLensRelatedContent {
  title?: string;
  query?: string;
}

interface SerpApiLensResponse {
  error?: string;
  related_content?: SerpApiLensRelatedContent[];
  [key: string]: any;
}

const OPENWEBNINJA_PROXY_URL = '/api/openwebninja/reverse_image_search/reverse-image-search';
const OPENWEBNINJA_TEST_IMAGE_URL = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg';

interface SearchByImageOptions {
  imageUrl?: string;
  maxResults?: number;
  providerOverride?: ImageSearchProvider;
  apiKeyOverride?: string;
}

const dedupeUrls = (urls: Array<string | undefined>): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const url of urls) {
    const value = (url || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
};

const emptyVisionSearchResponse = (): VisionSearchResponse => ({
  pagesWithMatchingImages: [],
  fullMatchingImages: [],
  partialMatchingImages: [],
  visuallySimilarImages: [],
  webEntities: [],
});

const isDirectSerpApiRequest = (): boolean => {
  return SERPAPI_REQUEST_URL.startsWith('https://serpapi.com');
};

const appendSerpApiAuth = (params: URLSearchParams, apiKey: string): void => {
  const trimmedKey = apiKey.trim();
  if (trimmedKey) {
    params.set('api_key', trimmedKey);
    return;
  }

  // If using a backend/proxy endpoint, the key may be injected server-side.
  if (isServerManagedSerpApiEnabled() || !isDirectSerpApiRequest()) {
    return;
  }

  throw new Error('SerpApi key missing. Add a key in Settings or configure a server-side proxy key.');
};

const isSerpApiNoResultsError = (message?: string): boolean => {
  return SERPAPI_NO_RESULTS_PATTERN.test((message || '').trim());
};

const isSerpApiCredentialOrQuotaError = (message?: string): boolean => {
  const text = (message || '').trim();
  return SERPAPI_CREDENTIAL_PATTERN.test(text) || SERPAPI_QUOTA_PATTERN.test(text);
};

const resolveApiKey = (
  provider: ImageSearchProvider,
  options: SearchByImageOptions,
  config: ReturnType<typeof getVisionConfig>
): string => {
  const override = (options.apiKeyOverride || '').trim();
  if (override) return override;

  // OpenWebNinja uses server-side RAPIDAPI_KEY via proxy, no client key needed
  if (provider === 'openwebninja') return '';

  if (provider === 'serpapi_lens') {
    return (config.serpApiKey || config.apiKey || '').trim();
  }

  return (config.googleVisionApiKey || config.apiKey || '').trim();
};

const mapSerpApiResponseToVisionShape = (payload: SerpApiLensResponse): VisionSearchResponse => {
  const listings = parseSerpApiListings(payload as Record<string, any>);

  const pageMap = new Map<string, VisionSearchResult>();

  for (const listing of listings) {
    const pageUrl = (listing.link || '').trim();
    if (!pageUrl) continue;

    const fullImages = listing.kind === 'exact'
      ? []
      : dedupeUrls([listing.image, listing.thumbnail]);
    const partialImages = listing.kind === 'exact'
      ? dedupeUrls([listing.image, listing.thumbnail])
      : [];

    const existing = pageMap.get(pageUrl);
    const merged: VisionSearchResult = {
      url: pageUrl,
      pageTitle: listing.title || listing.source || existing?.pageTitle,
      fullMatchingImages: dedupeUrls([...(existing?.fullMatchingImages || []), ...fullImages]),
      partialMatchingImages: dedupeUrls([...(existing?.partialMatchingImages || []), ...partialImages]),
      score: listing.confidence ?? existing?.score,
      source: listing.source || existing?.source,
      sellerName: listing.sellerName || existing?.sellerName,
      priceValue: listing.priceValue ?? existing?.priceValue,
      currency: listing.currency || existing?.currency,
      priceText: listing.priceText || existing?.priceText,
      rating: listing.rating ?? existing?.rating,
      reviewsCount: listing.reviewsCount ?? existing?.reviewsCount,
      inStock: listing.inStock ?? existing?.inStock,
      condition: listing.condition || existing?.condition,
      position: listing.position ?? existing?.position,
      confidence: listing.confidence ?? existing?.confidence,
      rawEvidence: {
        ...(existing?.rawEvidence || {}),
        ...(listing.raw || {}),
      },
    };
    pageMap.set(pageUrl, merged);
  }

  const fullMatchingImages = dedupeUrls(
    listings
      .filter((item) => item.kind !== 'exact')
      .map((item) => item.image || item.thumbnail)
  )
    .map(url => ({ url }));
  const partialMatchingImages = dedupeUrls(
    listings
      .filter((item) => item.kind === 'exact')
      .map((item) => item.image || item.thumbnail)
  )
    .map(url => ({ url }));
  const visuallySimilarImages = dedupeUrls(
    listings
      .filter((item) => item.kind === 'visual' || item.kind === 'product')
      .map((item) => item.thumbnail || item.image)
  )
    .map(url => ({ url }));

  const webEntities: VisionWebEntity[] = (payload.related_content || [])
    .map((item, index) => ({
      entityId: `serpapi_related_${index}`,
      description: (item.title || item.query || '').trim(),
      score: Math.max(0.1, 1 - index * 0.05),
    }))
    .filter(item => item.description.length > 0);

  return {
    pagesWithMatchingImages: Array.from(pageMap.values()),
    fullMatchingImages,
    partialMatchingImages,
    visuallySimilarImages,
    webEntities,
  };
};

const mergeVisionSearchResponses = (
  primary: VisionSearchResponse,
  secondary: VisionSearchResponse
): VisionSearchResponse => {
  const pageMap = new Map<string, VisionSearchResult>();
  for (const page of [...primary.pagesWithMatchingImages, ...secondary.pagesWithMatchingImages]) {
    const existing = pageMap.get(page.url);
    if (!existing) {
      pageMap.set(page.url, page);
      continue;
    }

    pageMap.set(page.url, {
      ...existing,
      ...page,
      pageTitle: page.pageTitle || existing.pageTitle,
      fullMatchingImages: dedupeUrls([...(existing.fullMatchingImages || []), ...(page.fullMatchingImages || [])]),
      partialMatchingImages: dedupeUrls([...(existing.partialMatchingImages || []), ...(page.partialMatchingImages || [])]),
      score: page.score ?? existing.score,
      source: page.source || existing.source,
      sellerName: page.sellerName || existing.sellerName,
      priceValue: page.priceValue ?? existing.priceValue,
      currency: page.currency || existing.currency,
      priceText: page.priceText || existing.priceText,
      rating: page.rating ?? existing.rating,
      reviewsCount: page.reviewsCount ?? existing.reviewsCount,
      inStock: page.inStock ?? existing.inStock,
      condition: page.condition || existing.condition,
      position: page.position ?? existing.position,
      confidence: page.confidence ?? existing.confidence,
      rawEvidence: {
        ...(existing.rawEvidence || {}),
        ...(page.rawEvidence || {}),
      },
    });
  }

  return {
    pagesWithMatchingImages: Array.from(pageMap.values()),
    fullMatchingImages: dedupeUrls([
      ...primary.fullMatchingImages.map(img => img.url),
      ...secondary.fullMatchingImages.map(img => img.url),
    ]).map((url) => ({ url })),
    partialMatchingImages: dedupeUrls([
      ...primary.partialMatchingImages.map(img => img.url),
      ...secondary.partialMatchingImages.map(img => img.url),
    ]).map((url) => ({ url })),
    visuallySimilarImages: dedupeUrls([
      ...primary.visuallySimilarImages.map(img => img.url),
      ...secondary.visuallySimilarImages.map(img => img.url),
    ]).map((url) => ({ url })),
    webEntities: [...primary.webEntities, ...secondary.webEntities]
      .filter(entity => entity.description)
      .filter((entity, index, arr) =>
        arr.findIndex(item => item.description.toLowerCase() === entity.description.toLowerCase()) === index
      ),
  };
};

const searchWithGoogleVision = async (apiKey: string, imageBase64: string, maxResults: number): Promise<VisionSearchResponse> => {
  const requestBody: VisionApiRequest = {
    requests: [
      {
        image: {
          content: imageBase64
        },
        features: [
          {
            type: 'WEB_DETECTION',
            maxResults,
          }
        ]
      }
    ]
  };

  const response = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Vision API Error:', errorData);
    const errorMsg = errorData.error?.message || `Vision API error: ${response.status} ${response.statusText}`;
    const errorStatus = errorData.error?.status || '';
    throw new Error(
      errorStatus ? `${errorStatus}: ${errorMsg}` : errorMsg
    );
  }

  const data: VisionApiResponse = await response.json();

  if (data.responses[0]?.error) {
    throw new Error(data.responses[0].error.message);
  }

  const webDetection = data.responses[0]?.webDetection;

  if (!webDetection) {
    return emptyVisionSearchResponse();
  }

  const pagesWithMatchingImages: VisionSearchResult[] = (webDetection.pagesWithMatchingImages || []).map(page => ({
    url: page.url,
    pageTitle: page.pageTitle,
    fullMatchingImages: (page.fullMatchingImages || []).map(img => img.url),
    partialMatchingImages: (page.partialMatchingImages || []).map(img => img.url)
  }));

  const fullMatchingImages = webDetection.fullMatchingImages || [];
  const partialMatchingImages = webDetection.partialMatchingImages || [];
  const visuallySimilarImages = webDetection.visuallySimilarImages || [];

  const webEntities: VisionWebEntity[] = (webDetection.webEntities || [])
    .filter(entity => entity.description)
    .map(entity => ({
      entityId: entity.entityId,
      description: entity.description,
      score: entity.score
    }));

  return {
    pagesWithMatchingImages,
    fullMatchingImages,
    partialMatchingImages,
    visuallySimilarImages,
    webEntities
  };
};

const searchWithSerpApiLens = async (apiKey: string, imageUrl?: string): Promise<VisionSearchResponse> => {
  if (!imageUrl) {
    throw new Error('SerpApi Google Lens requires an image URL. Upload the asset to storage and retry.');
  }

  const params = new URLSearchParams({
    engine: SERPAPI_ENGINE,
    type: SERPAPI_DEFAULT_TYPE,
    url: imageUrl,
  });
  appendSerpApiAuth(params, apiKey);

  let response: Response;
  try {
    response = await fetch(`${SERPAPI_REQUEST_URL}?${params.toString()}`, {
      method: 'GET',
    });
  } catch {
    throw new Error(
      'SerpApi request failed (likely network/proxy). Verify the Next.js route handler at /api/serpapi and server key configuration.'
    );
  }

  const data: SerpApiLensResponse = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = data.error || `SerpApi error: ${response.status} ${response.statusText}`;
    throw new Error(errorMessage);
  }

  if (data.error) {
    if (isSerpApiNoResultsError(data.error)) {
      return emptyVisionSearchResponse();
    }
    throw new Error(data.error);
  }

  let merged = mapSerpApiResponseToVisionShape(data);

  // Best-effort second pass to capture product-tab fields.
  try {
    const productParams = new URLSearchParams({
      engine: SERPAPI_ENGINE,
      type: 'products',
      url: imageUrl,
    });
    appendSerpApiAuth(productParams, apiKey);
    const productResponse = await fetch(`${SERPAPI_REQUEST_URL}?${productParams.toString()}`, {
      method: 'GET',
    });
    if (productResponse.ok) {
      const productData: SerpApiLensResponse = await productResponse.json().catch(() => ({}));
      if (!productData.error || isSerpApiNoResultsError(productData.error)) {
        const productsShape = mapSerpApiResponseToVisionShape(productData);
        merged = mergeVisionSearchResponses(merged, productsShape);
      }
    }
  } catch {
    // Keep primary response if products enrichment fails.
  }

  return merged;
};

const searchWithOpenWebNinja = async (imageUrl?: string, maxResults = 50): Promise<VisionSearchResponse> => {
  if (!imageUrl) {
    throw new Error('OpenWebNinja Reverse Image Search requires an image URL. Upload the asset to storage and retry.');
  }

  // Call via the proxy to keep RAPIDAPI_KEY server-side
  const params = new URLSearchParams({
    url: imageUrl,
    limit: String(maxResults),
    safe_search: 'off',
  });

  let response: Response;
  try {
    response = await fetch(`${OPENWEBNINJA_PROXY_URL}?${params.toString()}`, {
      method: 'GET',
    });
  } catch {
    throw new Error(
      'OpenWebNinja request failed (likely network/proxy). Verify the Next.js route handler at /api/openwebninja and RAPIDAPI_KEY configuration.'
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = data.error || `OpenWebNinja error: ${response.status} ${response.statusText}`;
    throw new Error(errorMessage);
  }

  if (data.status && data.status !== 'OK') {
    throw new Error(data.message || data.error || 'OpenWebNinja search returned an error');
  }

  return mapReverseImageToVisionShape(data);
};

export async function searchByImage(imageBase64: string, options: SearchByImageOptions = {}): Promise<VisionSearchResponse> {
  const config = getVisionConfig();
  const provider: ImageSearchProvider = options.providerOverride || config.provider;
  const apiKey = resolveApiKey(provider, options, config);

  const maxResults = options.maxResults || 20;

  if (provider === 'openwebninja') {
    if (!isServerManagedRapidApiEnabled()) {
      throw new Error('OpenWebNinja is not configured. Set RAPIDAPI_KEY and NEXT_PUBLIC_RAPIDAPI_CONFIGURED=true.');
    }
    return searchWithOpenWebNinja(options.imageUrl, maxResults);
  }

  if (provider === 'serpapi_lens') {
    if (!apiKey && !isServerManagedSerpApiEnabled() && isDirectSerpApiRequest()) {
      throw new Error('SerpApi key is missing. Configure a server-side key or add a key in Settings.');
    }
    return searchWithSerpApiLens(apiKey, options.imageUrl);
  }

  if (!apiKey) {
    throw new Error('Google Vision key is missing. Add a key in Settings -> Integrations.');
  }

  return searchWithGoogleVision(apiKey, imageBase64, maxResults);
}

export async function testVisionApiConnection(): Promise<boolean> {
  const config = getVisionConfig();

  if (!config.isConfigured) {
    return false;
  }

  if (config.provider === 'openwebninja') {
    try {
      const params = new URLSearchParams({
        url: OPENWEBNINJA_TEST_IMAGE_URL,
        limit: '1',
        safe_search: 'off',
      });
      const response = await fetch(`${OPENWEBNINJA_PROXY_URL}?${params.toString()}`, {
        method: 'GET',
      });
      if (!response.ok) return false;
      const data = await response.json().catch(() => ({}));
      return data.status === 'OK' || Array.isArray(data.data);
    } catch {
      return false;
    }
  }

  if (config.provider === 'serpapi_lens') {
    try {
      const params = new URLSearchParams({
        engine: SERPAPI_ENGINE,
        type: SERPAPI_DEFAULT_TYPE,
        url: SERPAPI_TEST_IMAGE_URL,
      });
      appendSerpApiAuth(params, config.apiKey);

      const response = await fetch(`${SERPAPI_REQUEST_URL}?${params.toString()}`, {
        method: 'GET',
      });
      const data: SerpApiLensResponse = await response.json().catch(() => ({}));

      if (!response.ok) {
        return false;
      }
      if (!data.error) {
        return true;
      }
      if (isSerpApiNoResultsError(data.error)) {
        return true;
      }
      return !isSerpApiCredentialOrQuotaError(data.error);
    } catch {
      return false;
    }
  }

  // Test with a minimal request - a tiny 1x1 white pixel
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  try {
    const response = await fetch(`${VISION_API_URL}?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            image: { content: testImageBase64 },
            features: [{ type: 'WEB_DETECTION', maxResults: 1 }]
          }
        ]
      })
    });

    return response.ok;
  } catch {
    return false;
  }
}
