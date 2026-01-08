// Google Cloud Vision API client for reverse image search

import { VisionSearchResponse, VisionSearchResult, VisionWebEntity } from '../types';
import { getVisionConfig } from './api-config';

const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';

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

export async function searchByImage(imageBase64: string): Promise<VisionSearchResponse> {
  const config = getVisionConfig();

  if (!config.isConfigured) {
    throw new Error('Vision API not configured. Please add your API key in Settings.');
  }

  const requestBody: VisionApiRequest = {
    requests: [
      {
        image: {
          content: imageBase64
        },
        features: [
          {
            type: 'WEB_DETECTION',
            maxResults: 20
          }
        ]
      }
    ]
  };

  const response = await fetch(`${VISION_API_URL}?key=${config.apiKey}`, {
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
    return {
      pagesWithMatchingImages: [],
      fullMatchingImages: [],
      partialMatchingImages: [],
      webEntities: []
    };
  }

  // Transform the response
  const pagesWithMatchingImages: VisionSearchResult[] = (webDetection.pagesWithMatchingImages || []).map(page => ({
    url: page.url,
    pageTitle: page.pageTitle,
    fullMatchingImages: (page.fullMatchingImages || []).map(img => img.url),
    partialMatchingImages: (page.partialMatchingImages || []).map(img => img.url)
  }));

  const fullMatchingImages = webDetection.fullMatchingImages || [];
  const partialMatchingImages = webDetection.partialMatchingImages || [];

  const webEntities: VisionWebEntity[] = (webDetection.webEntities || [])
    .filter(entity => entity.description) // Only include entities with descriptions
    .map(entity => ({
      entityId: entity.entityId,
      description: entity.description,
      score: entity.score
    }));

  return {
    pagesWithMatchingImages,
    fullMatchingImages,
    partialMatchingImages,
    webEntities
  };
}

export async function testVisionApiConnection(): Promise<boolean> {
  const config = getVisionConfig();

  if (!config.isConfigured) {
    return false;
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
