// Reverse image search client supporting Google Vision and SerpApi Google Lens.

import { VisionSearchResponse, VisionSearchResult, VisionWebEntity } from '../types';
import { getVisionConfig, isServerManagedSerpApiEnabled, type ImageSearchProvider } from './api-config';

const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';
const SERPAPI_URL = 'https://serpapi.com/search.json';
const SERPAPI_DEV_PROXY_URL = '/api/serpapi/search.json';
const SERPAPI_ENGINE = 'google_lens';
const SERPAPI_DEFAULT_TYPE = 'all';
const SERPAPI_TEST_IMAGE_URL = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg';
const SERPAPI_REQUEST_URL = (() => {
  const configuredProxy = (import.meta.env.VITE_SERPAPI_PROXY_URL || '').trim();
  if (configuredProxy) return configuredProxy;
  return import.meta.env.DEV ? SERPAPI_DEV_PROXY_URL : SERPAPI_URL;
})();
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

interface SerpApiLensMatch {
  title?: string;
  link?: string;
  source?: string;
  image?: string;
  thumbnail?: string;
}

interface SerpApiLensRelatedContent {
  title?: string;
  query?: string;
}

interface SerpApiLensResponse {
  error?: string;
  visual_matches?: SerpApiLensMatch[];
  exact_matches?: SerpApiLensMatch[];
  related_content?: SerpApiLensRelatedContent[];
}

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
  return SERPAPI_REQUEST_URL === SERPAPI_URL || SERPAPI_REQUEST_URL.startsWith('https://serpapi.com');
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

  if (provider === 'serpapi_lens') {
    return (config.serpApiKey || config.apiKey || '').trim();
  }

  return (config.googleVisionApiKey || config.apiKey || '').trim();
};

const mapSerpApiResponseToVisionShape = (payload: SerpApiLensResponse): VisionSearchResponse => {
  const visualMatches = payload.visual_matches || [];
  const exactMatches = payload.exact_matches || [];

  const pageMap = new Map<string, VisionSearchResult>();

  for (const match of visualMatches) {
    const pageUrl = (match.link || '').trim();
    if (!pageUrl) continue;

    const fullImages = dedupeUrls([match.image, match.thumbnail]);
    pageMap.set(pageUrl, {
      url: pageUrl,
      pageTitle: match.title || match.source || undefined,
      fullMatchingImages: fullImages,
      partialMatchingImages: [],
    });
  }

  for (const match of exactMatches) {
    const pageUrl = (match.link || '').trim();
    if (!pageUrl) continue;

    const partialImages = dedupeUrls([match.image, match.thumbnail]);
    const existing = pageMap.get(pageUrl);
    if (existing) {
      pageMap.set(pageUrl, {
        ...existing,
        partialMatchingImages: dedupeUrls([...existing.partialMatchingImages, ...partialImages]),
      });
      continue;
    }

    pageMap.set(pageUrl, {
      url: pageUrl,
      pageTitle: match.title || match.source || undefined,
      fullMatchingImages: [],
      partialMatchingImages: partialImages,
    });
  }

  const fullMatchingImages = dedupeUrls(visualMatches.map(match => match.image || match.thumbnail))
    .map(url => ({ url }));
  const partialMatchingImages = dedupeUrls(exactMatches.map(match => match.image || match.thumbnail))
    .map(url => ({ url }));
  const visuallySimilarImages = dedupeUrls(visualMatches.map(match => match.thumbnail || match.image))
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
      'SerpApi request failed (likely CORS/network). In dev, use the local proxy on /api/serpapi; in production, set VITE_SERPAPI_PROXY_URL to your backend proxy endpoint.'
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

  return mapSerpApiResponseToVisionShape(data);
};

export async function searchByImage(imageBase64: string, options: SearchByImageOptions = {}): Promise<VisionSearchResponse> {
  const config = getVisionConfig();
  const provider = options.providerOverride === 'serpapi_lens' ? 'serpapi_lens' : (options.providerOverride || config.provider);
  const apiKey = resolveApiKey(provider, options, config);

  const maxResults = options.maxResults || 20;

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
