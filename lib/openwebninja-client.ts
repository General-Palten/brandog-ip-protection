// Shared HTTP client for all OpenWebNinja API calls.
// Handles auth headers, error classification, latency tracking, and retries.

import { getServiceDefinition, type OpenWebNinjaService } from './provider-registry';

export interface OpenWebNinjaCallOptions {
  service: OpenWebNinjaService;
  path: string;
  params: Record<string, string>;
  apiKey: string;
  /** Override the base URL (useful for testing or custom endpoints) */
  baseUrlOverride?: string;
}

export interface OpenWebNinjaCallResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
  latencyMs: number;
  baseUrl: string;
  path: string;
}

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isRetryableStatus = (status: number): boolean =>
  status === 429 || status === 502 || status === 503 || status === 504;

/**
 * Execute a GET request to an OpenWebNinja API endpoint.
 */
export async function callOpenWebNinja<T = Record<string, unknown>>(
  options: OpenWebNinjaCallOptions
): Promise<OpenWebNinjaCallResult<T>> {
  const definition = getServiceDefinition(options.service);
  const baseUrl = options.baseUrlOverride || definition?.apiBaseUrl;
  if (!baseUrl) {
    return {
      ok: false,
      status: 0,
      data: {} as T,
      error: `Unknown service: ${options.service}`,
      latencyMs: 0,
      baseUrl: '',
      path: options.path,
    };
  }

  if (!options.apiKey) {
    return {
      ok: false,
      status: 0,
      data: {} as T,
      error: 'OpenWebNinja API key is not configured',
      latencyMs: 0,
      baseUrl,
      path: options.path,
    };
  }

  const url = new URL(`${baseUrl}${options.path}`);
  for (const [key, value] of Object.entries(options.params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    'x-api-key': options.apiKey,
    Accept: 'application/json',
  };

  let lastResult: OpenWebNinjaCallResult<T> | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAY_MS * attempt);
    }

    const started = Date.now();
    let status = 0;

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      status = response.status;
      const body = await response.json().catch(() => ({}));
      const latencyMs = Date.now() - started;

      lastResult = {
        ok: response.ok,
        status,
        data: body as T,
        error: response.ok ? undefined : extractErrorMessage(body, status),
        latencyMs,
        baseUrl,
        path: options.path,
      };

      if (response.ok || !isRetryableStatus(status)) {
        return lastResult;
      }
    } catch (err: any) {
      lastResult = {
        ok: false,
        status,
        data: {} as T,
        error: err?.message || 'Network request failed',
        latencyMs: Date.now() - started,
        baseUrl,
        path: options.path,
      };
    }
  }

  return lastResult!;
}

/**
 * Execute a POST request (used by Web Unblocker).
 */
export async function postOpenWebNinja<T = Record<string, unknown>>(
  options: OpenWebNinjaCallOptions & { body?: Record<string, unknown> }
): Promise<OpenWebNinjaCallResult<T>> {
  const definition = getServiceDefinition(options.service);
  const baseUrl = options.baseUrlOverride || definition?.apiBaseUrl;
  if (!baseUrl) {
    return {
      ok: false,
      status: 0,
      data: {} as T,
      error: `Unknown service: ${options.service}`,
      latencyMs: 0,
      baseUrl: '',
      path: options.path,
    };
  }

  if (!options.apiKey) {
    return {
      ok: false,
      status: 0,
      data: {} as T,
      error: 'OpenWebNinja API key is not configured',
      latencyMs: 0,
      baseUrl,
      path: options.path,
    };
  }

  const url = new URL(`${baseUrl}${options.path}`);
  for (const [key, value] of Object.entries(options.params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    'x-api-key': options.apiKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const started = Date.now();
  let status = 0;

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    status = response.status;
    const body = await response.json().catch(() => ({}));

    return {
      ok: response.ok,
      status,
      data: body as T,
      error: response.ok ? undefined : extractErrorMessage(body, status),
      latencyMs: Date.now() - started,
      baseUrl,
      path: options.path,
    };
  } catch (err: any) {
    return {
      ok: false,
      status,
      data: {} as T,
      error: err?.message || 'Network request failed',
      latencyMs: Date.now() - started,
      baseUrl,
      path: options.path,
    };
  }
}

function extractErrorMessage(body: any, status: number): string {
  if (typeof body?.message === 'string') return body.message;
  if (typeof body?.error === 'string') return body.error;
  if (typeof body?.detail === 'string') return body.detail;
  return `API error: ${status}`;
}

/** Check if an error indicates invalid/missing key */
export function isCredentialError(result: OpenWebNinjaCallResult): boolean {
  return result.status === 401 || result.status === 403;
}

/** Check if an error indicates quota exceeded */
export function isQuotaError(result: OpenWebNinjaCallResult): boolean {
  return result.status === 429;
}
