// Reverse image search provider configuration (local browser storage).

import { isSerpApiServerKeyEnabled } from './runtime-config';

const STORAGE_KEY = 'brandog_image_search_config';
const LEGACY_STORAGE_KEY = 'brandog_vision_config';

export type ImageSearchProvider = 'google_vision' | 'serpapi_lens';

export interface VisionConfig {
  provider: ImageSearchProvider;
  apiKey: string; // Active provider key (for backward compatibility with existing code)
  googleVisionApiKey: string;
  serpApiKey: string;
  isConfigured: boolean;
}

// Use runtime config for server-managed SERPAPI flag (supports runtime env vars)
const getServerManagedFlag = (): boolean => isSerpApiServerKeyEnabled();

// Auto-select SERPAPI when server key is configured, otherwise fall back to Google Vision
const getDefaultProvider = (): ImageSearchProvider =>
  getServerManagedFlag() ? 'serpapi_lens' : 'google_vision';

const getActiveKey = (
  provider: ImageSearchProvider,
  googleVisionApiKey: string,
  serpApiKey: string
): string => {
  return provider === 'serpapi_lens' ? serpApiKey : googleVisionApiKey;
};

const isProviderConfigured = (
  provider: ImageSearchProvider,
  googleVisionApiKey: string,
  serpApiKey: string
): boolean => {
  if (provider === 'serpapi_lens') {
    return serpApiKey.length > 0 || getServerManagedFlag();
  }

  return googleVisionApiKey.length > 0;
};

export function getVisionConfig(): VisionConfig {
  const serverManaged = getServerManagedFlag();
  const defaultProvider = getDefaultProvider();

  try {
    const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!stored) {
      // No local config - check if server-managed SERPAPI is available
      return {
        provider: defaultProvider,
        apiKey: '',
        googleVisionApiKey: '',
        serpApiKey: '',
        isConfigured: serverManaged,
      };
    }

    const parsed = JSON.parse(stored) as {
      provider?: ImageSearchProvider;
      apiKey?: string;
      googleVisionApiKey?: string;
      serpApiKey?: string;
    };

    const provider = parsed.provider === 'serpapi_lens' ? 'serpapi_lens' : defaultProvider;
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
      isConfigured: getServerManagedFlag(),
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
