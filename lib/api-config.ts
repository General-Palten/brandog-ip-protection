// API configuration management

const STORAGE_KEY = 'brandog_vision_config';

export interface VisionConfig {
  apiKey: string;
  isConfigured: boolean;
}

export function getVisionConfig(): VisionConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {
        apiKey: '',
        isConfigured: false
      };
    }

    const parsed = JSON.parse(stored);
    return {
      apiKey: parsed.apiKey || '',
      isConfigured: !!(parsed.apiKey && parsed.apiKey.length > 0)
    };
  } catch {
    return {
      apiKey: '',
      isConfigured: false
    };
  }
}

export function saveVisionConfig(apiKey: string): void {
  const config = {
    apiKey,
    isConfigured: !!(apiKey && apiKey.length > 0)
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearVisionConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isVisionConfigured(): boolean {
  return getVisionConfig().isConfigured;
}
