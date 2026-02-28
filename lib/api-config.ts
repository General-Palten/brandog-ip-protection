// Reverse image search provider configuration (local browser storage).

import { isSerpApiServerKeyEnabled, isRapidApiConfigured } from './runtime-config';

const STORAGE_KEY = 'brandog_image_search_config';
const LEGACY_STORAGE_KEY = 'brandog_vision_config';

export type ImageSearchProvider = 'google_vision' | 'serpapi_lens' | 'openwebninja';

export interface VisionConfig {
  provider: ImageSearchProvider;
  apiKey: string; // Active provider key (for backward compatibility with existing code)
  googleVisionApiKey: string;
  serpApiKey: string;
  isConfigured: boolean;
}

// Use runtime config for server-managed flags (supports runtime env vars)
const getServerManagedFlag = (): boolean => isSerpApiServerKeyEnabled();
const getRapidApiFlag = (): boolean => isRapidApiConfigured();

// Auto-select provider: OpenWebNinja > SerpApi > Google Vision
const getDefaultProvider = (): ImageSearchProvider => {
  if (getRapidApiFlag()) return 'openwebninja';
  if (getServerManagedFlag()) return 'serpapi_lens';
  return 'google_vision';
};

const getActiveKey = (
  provider: ImageSearchProvider,
  googleVisionApiKey: string,
  serpApiKey: string
): string => {
  // OpenWebNinja uses server-side RAPIDAPI_KEY, no client key needed
  if (provider === 'openwebninja') return '';
  return provider === 'serpapi_lens' ? serpApiKey : googleVisionApiKey;
};

const isProviderConfigured = (
  provider: ImageSearchProvider,
  googleVisionApiKey: string,
  serpApiKey: string
): boolean => {
  if (provider === 'openwebninja') {
    return getRapidApiFlag();
  }

  if (provider === 'serpapi_lens') {
    return serpApiKey.length > 0 || getServerManagedFlag();
  }

  return googleVisionApiKey.length > 0;
};

const VALID_PROVIDERS: ImageSearchProvider[] = ['google_vision', 'serpapi_lens', 'openwebninja'];

const parseProvider = (value: unknown): ImageSearchProvider | null => {
  if (typeof value === 'string' && VALID_PROVIDERS.includes(value as ImageSearchProvider)) {
    return value as ImageSearchProvider;
  }
  return null;
};

export function getVisionConfig(): VisionConfig {
  const serverManaged = getServerManagedFlag();
  const rapidApiConfigured = getRapidApiFlag();
  const defaultProvider = getDefaultProvider();

  try {
    const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!stored) {
      return {
        provider: defaultProvider,
        apiKey: '',
        googleVisionApiKey: '',
        serpApiKey: '',
        isConfigured: rapidApiConfigured || serverManaged,
      };
    }

    const parsed = JSON.parse(stored) as {
      provider?: string;
      apiKey?: string;
      googleVisionApiKey?: string;
      serpApiKey?: string;
    };

    const provider = parseProvider(parsed.provider) || defaultProvider;
    // Legacy migration: older builds only stored `apiKey`.
    const legacyKey = typeof parsed.apiKey === 'string' ? parsed.apiKey : '';
    const googleVisionApiKey = (parsed.googleVisionApiKey || legacyKey || '').trim();
    const serpApiKey = (parsed.serpApiKey || '').trim();
    const apiKey = getActiveKey(provider, googleVisionApiKey, serpApiKey);
    const isConfigured = isProviderConfigured(provider, googleVisionApiKey, serpApiKey);

    return {
      provider,
      apiKey,
      googleVisionApiKey,
      serpApiKey,
      isConfigured,
    };
  } catch {
    return {
      provider: getDefaultProvider(),
      apiKey: '',
      googleVisionApiKey: '',
      serpApiKey: '',
      isConfigured: getRapidApiFlag() || getServerManagedFlag(),
    };
  }
}

export function saveVisionConfig(apiKey: string, provider?: ImageSearchProvider): void {
  const current = getVisionConfig();
  const nextProvider = provider || current.provider || getDefaultProvider();

  const googleVisionApiKey = nextProvider === 'google_vision'
    ? apiKey.trim()
    : current.googleVisionApiKey;
  const serpApiKey = nextProvider === 'serpapi_lens'
    ? apiKey.trim()
    : current.serpApiKey;
  const activeKey = getActiveKey(nextProvider, googleVisionApiKey, serpApiKey);

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    provider: nextProvider,
    googleVisionApiKey,
    serpApiKey,
    apiKey: activeKey,
  }));
}

export function saveVisionProvider(provider: ImageSearchProvider): void {
  const current = getVisionConfig();
  const activeKey = getActiveKey(provider, current.googleVisionApiKey, current.serpApiKey);

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    provider,
    googleVisionApiKey: current.googleVisionApiKey,
    serpApiKey: current.serpApiKey,
    apiKey: activeKey,
  }));
}

export function clearVisionConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isVisionConfigured(): boolean {
  return getVisionConfig().isConfigured;
}

export function isServerManagedSerpApiEnabled(): boolean {
  return getServerManagedFlag();
}

export function isServerManagedRapidApiEnabled(): boolean {
  return getRapidApiFlag();
}
