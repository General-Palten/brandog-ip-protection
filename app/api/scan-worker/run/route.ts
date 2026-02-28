import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';
import { createProviderToken, hashProviderToken } from '@/lib/provider-token';
import {
  extractFollowupSerpApiLinks,
  fetchSerpApiFollowupLink,
  mergeListingsByUrl,
  parseSerpApiListings,
  searchLensAll,
  searchLensProducts,
  type SerpApiListing,
  type SerpApiSearchCall,
} from '@/lib/provider-serpapi';
import {
  searchReverseImage,
  mapReverseImageToListings,
  toSearchCallShape,
} from '@/lib/provider-openwebninja-reverse-image';
import { searchProducts, mapProductsToListings } from '@/lib/provider-openwebninja-product-search';
import { getVisualMatches, mapVisualMatchesToListings, toLensSearchCallShape } from '@/lib/provider-openwebninja-amazon';
import { searchAmazonProducts, mapAmazonProductsToListings, toAmazonSearchCallShape } from '@/lib/provider-openwebninja-amazon-data';
import { scrapeWebsiteContacts, toContactsSearchCallShape } from '@/lib/provider-openwebninja-contacts';
import { searchSocialLinks, toSocialLinksSearchCallShape } from '@/lib/provider-openwebninja-social';
import { scoreRevenue, type RevenueScoringOrder } from '@/lib/revenue-scoring';
import { computeFixedCadenceNextScanAt } from '@/lib/scan-cadence';
import { buildEvidenceBundle, normalizeEvidenceSnapshot } from '@/lib/evidence-normalizer';
import type { PlatformType } from '@/lib/database.types';

const CLAIM_LIMIT = 10;
const MAX_JOBS_PER_RUN = 50;
const MAX_RETRY_ATTEMPTS = 10;
const TOKEN_TTL_SECONDS = 120;
const MAX_MATCHES_PER_SCAN = 25;
const MAX_OPENROUTER_SCORES_PER_SCAN = 3;
const SERPAPI_LENS_PROVIDER = 'serpapi_lens';
const OPENWEBNINJA_PROVIDER = 'openwebninja';

const DEFAULT_SCAN_SETTINGS = {
  maxScansPerDay: 250,
  maxSpendUsdPerDay: 25,
  maxParallelScans: 3,
  retryDelayHours: 6,
  serpapiEstimatedCostUsd: 0.01,
  baseIntervalDays: 14,
  foundIntervalDays: 3,
  lookbackScans: 5,
  revenueScoringOrder: 'openrouter_first' as RevenueScoringOrder,
  openrouterModel: 'arcee-ai/trinity-large-preview:free',
  openrouterMaxTokens: 500,
  maxProviderCallsPerScan: 3,
  maxSpendUsdPerMonth: 250,
  // OpenWebNinja service toggles
  activeScanProvider: 'openwebninja' as 'serpapi_lens' | 'openwebninja',
  enableReverseImageSearch: true,
  enableProductSearch: false,
  enableLensData: false,
  enableRealtimeAmazon: false,
  enableWebsiteContacts: false,
  enableSocialLinks: false,
  enableWebUnblocker: false,
  reverseImageSearchCostUsd: 0.0025,
  productSearchCostUsd: 0.0025,
  lensDataCostUsd: 0.0025,
  realtimeAmazonCostUsd: 0.0025,
  websiteContactsCostUsd: 0.0025,
  socialLinksCostUsd: 0.0025,
  webUnblockerCostUsd: 0.0005,
};

const PUBLIC_APP_URL = (process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || '').trim();
const serpApiKey = (process.env.SERPAPI_API_KEY || '').trim();
const openWebNinjaApiKey = (process.env.OPENWEBNINJA_API_KEY || '').trim();
const workerSecret = (process.env.SCAN_WORKER_SECRET || '').trim();
const openRouterApiKey = (process.env.OPENROUTER_API_KEY || '').trim();
const envOpenRouterModel = (process.env.OPENROUTER_MODEL || '').trim();
const defaultOpenRouterModel = envOpenRouterModel || 'arcee-ai/trinity-large-preview:free';

type Job = {
  id: string;
  brand_id: string;
  name: string;
  storage_path: string;
  fingerprint: string | null;
  scan_provider: string | null;
  scan_attempts: number;
};

type ScanSettings = {
  maxScansPerDay: number;
  maxSpendUsdPerDay: number;
  maxParallelScans: number;
  retryDelayHours: number;
  serpapiEstimatedCostUsd: number;
  baseIntervalDays: number;
  foundIntervalDays: number;
  lookbackScans: number;
  revenueScoringOrder: RevenueScoringOrder;
  openrouterModel: string;
  openrouterMaxTokens: number;
  maxProviderCallsPerScan: number;
  maxSpendUsdPerMonth: number;
  // OpenWebNinja service toggles
  activeScanProvider: 'serpapi_lens' | 'openwebninja';
  enableReverseImageSearch: boolean;
  enableProductSearch: boolean;
  enableLensData: boolean;
  enableRealtimeAmazon: boolean;
  enableWebsiteContacts: boolean;
  enableSocialLinks: boolean;
  enableWebUnblocker: boolean;
  reverseImageSearchCostUsd: number;
  productSearchCostUsd: number;
  lensDataCostUsd: number;
  realtimeAmazonCostUsd: number;
  websiteContactsCostUsd: number;
  socialLinksCostUsd: number;
  webUnblockerCostUsd: number;
};

const nowIso = (): string => new Date().toISOString();
const addHours = (hours: number): string => new Date(Date.now() + Math.max(1, hours) * 60 * 60 * 1000).toISOString();

const resolvePublicOrigin = (request: NextRequest): string => {
  if (PUBLIC_APP_URL) return PUBLIC_APP_URL.replace(/\/+$/, '');
  return request.nextUrl.origin.replace(/\/+$/, '');
};

const isPrivateHost = (origin: string): boolean => {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true;
    if (host.endsWith('.local')) return true;
    if (host.startsWith('10.') || host.startsWith('192.168.')) return true;
    const parts = host.split('.');
    if (parts.length === 4 && parts.every(part => /^\d+$/.test(part))) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      if (a === 172 && b >= 16 && b <= 31) return true;
    }
    return false;
  } catch {
    return true;
  }
};

const normalizeUrl = (value: string | undefined): string | null => {
  const raw = (value || '').trim();
  if (!raw) return null;
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
};

const normalizeDomain = (value: string | undefined): string | null => {
  const url = normalizeUrl(value);
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
};

const mapPlatform = (domain: string): PlatformType => {
  if (domain.includes('instagram')) return 'Instagram';
  if (domain.includes('facebook') || domain.includes('meta')) return 'Meta Ads';
  if (domain.includes('tiktok')) return 'TikTok Shop';
  if (domain.includes('amazon')) return 'Amazon';
  if (domain.includes('aliexpress') || domain.includes('alibaba')) return 'AliExpress';
  if (domain.includes('ebay')) return 'eBay';
  if (domain.includes('shopify') || domain.includes('myshopify')) return 'Shopify';
  return 'Website';
};

const isMissingTableError = (error: { code?: string; message?: string } | null | undefined): boolean => {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || message.includes('relation') && message.includes('does not exist')
    || message.includes('schema cache');
};

const isMissingColumnError = (error: { code?: string; message?: string } | null | undefined): boolean => {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return error.code === '42703'
    || error.code === 'PGRST204'
    || message.includes('column') && message.includes('does not exist');
};

const isNoResultsError = (message: string | undefined): boolean => {
  const text = (message || '').toLowerCase();
  return text.includes('no results')
    || text.includes("hasn't returned any results")
    || text.includes('did not return any results');
};

const estimateSimilarityFromListing = (listing: SerpApiListing): number => {
  if (listing.kind === 'exact') return 92;
  if (listing.kind === 'visual') return 80;
  return 72;
};

const estimateSiteVisitors = (listing: SerpApiListing, similarityScore: number): number => {
  const reviews = typeof listing.reviewsCount === 'number' ? Math.max(0, listing.reviewsCount) : 0;
  const rating = typeof listing.rating === 'number' ? Math.max(0, Math.min(5, listing.rating)) : 0;
  const position = typeof listing.position === 'number' ? Math.max(1, listing.position) : 20;
  const base = 250 + Math.min(30000, reviews * 4);
  const ratingFactor = 0.75 + (rating / 8);
  const positionFactor = position <= 3 ? 1.4 : position <= 10 ? 1.05 : 0.8;
  const similarityFactor = 0.7 + Math.min(0.3, similarityScore / 100);
  return Math.max(100, Math.round(base * ratingFactor * positionFactor * similarityFactor));
};

const hashSourceUrl = (url: string): string => {
  return createHash('sha256').update(url).digest('hex');
};

const loadScanSettings = async (brandId: string): Promise<ScanSettings> => {
  const supabase: any = getSupabaseService();
  const { data } = await supabase
    .from('scan_settings')
    .select(`
      max_scans_per_day,
      max_spend_usd_per_day,
      max_parallel_scans,
      retry_delay_hours,
      serpapi_estimated_cost_usd,
      base_interval_days,
      found_interval_days,
      lookback_scans,
      revenue_scoring_order,
      openrouter_model,
      openrouter_max_tokens,
      max_provider_calls_per_scan,
      max_spend_usd_per_month,
      active_scan_provider,
      enable_reverse_image_search,
      enable_product_search,
      enable_amazon_data,
      enable_realtime_amazon,
      enable_website_contacts,
      enable_social_links,
      enable_web_unblocker,
      reverse_image_search_cost_usd,
      product_search_cost_usd,
      amazon_data_cost_usd,
      realtime_amazon_cost_usd,
      website_contacts_cost_usd,
      social_links_cost_usd,
      web_unblocker_cost_usd
    `)
    .eq('brand_id', brandId)
    .maybeSingle();

  if (!data) {
    return { ...DEFAULT_SCAN_SETTINGS };
  }

  const scoringOrderRaw = (data.revenue_scoring_order || DEFAULT_SCAN_SETTINGS.revenueScoringOrder) as string;
  const scoringOrder: RevenueScoringOrder = scoringOrderRaw === 'deterministic_first'
    ? 'deterministic_first'
    : 'openrouter_first';
  const configuredModel = (data.openrouter_model || '').toString().trim();
  const normalizedModel = !configuredModel || configuredModel === 'openai/gpt-4o-mini'
    ? DEFAULT_SCAN_SETTINGS.openrouterModel
    : configuredModel;
  const effectiveModel = envOpenRouterModel || normalizedModel || defaultOpenRouterModel;

  const activeScanProvider = data.active_scan_provider === 'serpapi_lens' ? 'serpapi_lens' as const : 'openwebninja' as const;

  return {
    maxScansPerDay: Number(data.max_scans_per_day ?? DEFAULT_SCAN_SETTINGS.maxScansPerDay),
    maxSpendUsdPerDay: Number(data.max_spend_usd_per_day ?? DEFAULT_SCAN_SETTINGS.maxSpendUsdPerDay),
    maxParallelScans: Number(data.max_parallel_scans ?? DEFAULT_SCAN_SETTINGS.maxParallelScans),
    retryDelayHours: Number(data.retry_delay_hours ?? DEFAULT_SCAN_SETTINGS.retryDelayHours),
    serpapiEstimatedCostUsd: Number(data.serpapi_estimated_cost_usd ?? DEFAULT_SCAN_SETTINGS.serpapiEstimatedCostUsd),
    baseIntervalDays: Number(data.base_interval_days ?? DEFAULT_SCAN_SETTINGS.baseIntervalDays),
    foundIntervalDays: Number(data.found_interval_days ?? DEFAULT_SCAN_SETTINGS.foundIntervalDays),
    lookbackScans: Number(data.lookback_scans ?? DEFAULT_SCAN_SETTINGS.lookbackScans),
    revenueScoringOrder: scoringOrder,
    openrouterModel: effectiveModel,
    openrouterMaxTokens: Number(data.openrouter_max_tokens ?? DEFAULT_SCAN_SETTINGS.openrouterMaxTokens),
    maxProviderCallsPerScan: Number(data.max_provider_calls_per_scan ?? DEFAULT_SCAN_SETTINGS.maxProviderCallsPerScan),
    maxSpendUsdPerMonth: Number(data.max_spend_usd_per_month ?? DEFAULT_SCAN_SETTINGS.maxSpendUsdPerMonth),
    activeScanProvider,
    enableReverseImageSearch: data.enable_reverse_image_search ?? DEFAULT_SCAN_SETTINGS.enableReverseImageSearch,
    enableProductSearch: data.enable_product_search ?? DEFAULT_SCAN_SETTINGS.enableProductSearch,
    enableLensData: data.enable_amazon_data ?? DEFAULT_SCAN_SETTINGS.enableLensData,
    enableRealtimeAmazon: data.enable_realtime_amazon ?? DEFAULT_SCAN_SETTINGS.enableRealtimeAmazon,
    enableWebsiteContacts: data.enable_website_contacts ?? DEFAULT_SCAN_SETTINGS.enableWebsiteContacts,
    enableSocialLinks: data.enable_social_links ?? DEFAULT_SCAN_SETTINGS.enableSocialLinks,
    enableWebUnblocker: data.enable_web_unblocker ?? DEFAULT_SCAN_SETTINGS.enableWebUnblocker,
    reverseImageSearchCostUsd: Number(data.reverse_image_search_cost_usd ?? DEFAULT_SCAN_SETTINGS.reverseImageSearchCostUsd),
    productSearchCostUsd: Number(data.product_search_cost_usd ?? DEFAULT_SCAN_SETTINGS.productSearchCostUsd),
    lensDataCostUsd: Number(data.amazon_data_cost_usd ?? DEFAULT_SCAN_SETTINGS.lensDataCostUsd),
    realtimeAmazonCostUsd: Number(data.realtime_amazon_cost_usd ?? DEFAULT_SCAN_SETTINGS.realtimeAmazonCostUsd),
    websiteContactsCostUsd: Number(data.website_contacts_cost_usd ?? DEFAULT_SCAN_SETTINGS.websiteContactsCostUsd),
    socialLinksCostUsd: Number(data.social_links_cost_usd ?? DEFAULT_SCAN_SETTINGS.socialLinksCostUsd),
    webUnblockerCostUsd: Number(data.web_unblocker_cost_usd ?? DEFAULT_SCAN_SETTINGS.webUnblockerCostUsd),
  };
};

const loadDailyBudgetUsage = async (brandId: string): Promise<{ scansExecuted: number; spendUsd: number }> => {
  const supabase: any = getSupabaseService();
  const budgetDate = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('scan_budget_daily')
    .select('scans_executed, spend_usd')
    .eq('brand_id', brandId)
    .eq('budget_date', budgetDate)
    .maybeSingle();

  return {
    scansExecuted: Number(data?.scans_executed ?? 0),
    spendUsd: Number(data?.spend_usd ?? 0),
  };
};

const loadMonthlySpendUsage = async (brandId: string): Promise<number> => {
  const supabase: any = getSupabaseService();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const monthEnd = now.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('scan_budget_daily')
    .select('spend_usd')
    .eq('brand_id', brandId)
    .gte('budget_date', monthStart)
    .lte('budget_date', monthEnd);

  if (error || !data) return 0;
  return data.reduce((sum: number, row: { spend_usd?: number }) => sum + Number(row.spend_usd || 0), 0);
};

const recordBudgetUsage = async (brandId: string, scanIncrement: number, spendIncrementUsd: number): Promise<void> => {
  if (scanIncrement <= 0 && spendIncrementUsd <= 0) return;
  const supabase: any = getSupabaseService();
  await supabase.rpc('record_scan_budget_usage', {
    p_brand_id: brandId,
    p_scan_increment: Math.max(0, scanIncrement),
    p_spend_increment: Math.max(0, spendIncrementUsd),
  });
};

const loadRecentMatchHistory = async (assetId: string, limit: number): Promise<number[]> => {
  const safeLimit = Math.max(0, Math.min(limit, 50));
  if (safeLimit <= 0) return [];
  const supabase: any = getSupabaseService();
  const { data, error } = await supabase
    .from('scan_events')
    .select('matches_found')
    .eq('asset_id', assetId)
    .eq('status', 'success')
    .order('started_at', { ascending: false })
    .limit(safeLimit);

  if (error || !data) return [];
  return data.map((row: { matches_found?: number }) => Number(row.matches_found || 0));
};

const loadWhitelistDomains = async (brandId: string): Promise<Set<string>> => {
  const supabase: any = getSupabaseService();
  const { data } = await supabase
    .from('whitelist')
    .select('domain')
    .eq('brand_id', brandId);

  const domains = new Set<string>();
  for (const row of data || []) {
    const normalized = normalizeDomain(row.domain || undefined);
    if (normalized) domains.add(normalized);
  }
  return domains;
};

const createTakedownForInfringement = async (infringementId: string): Promise<void> => {
  const supabase: any = getSupabaseService();
  const { data: existing } = await supabase
    .from('takedown_requests')
    .select('id')
    .eq('infringement_id', infringementId)
    .limit(1)
    .maybeSingle();

  if (existing) return;

  const { data: takedown } = await supabase
    .from('takedown_requests')
    .insert({
      infringement_id: infringementId,
      status: 'pending_review',
    })
    .select('id')
    .single();

  if (!takedown) return;

  await supabase
    .from('case_updates')
    .insert({
      takedown_id: takedown.id,
      update_type: 'custom',
      message: 'Automated detection queued this case for company review.',
      created_by: 'system',
    });
};

const recordProviderRun = async (
  brandId: string,
  assetId: string,
  call: SerpApiSearchCall,
  estimatedCostUsd: number,
  providerName?: string
): Promise<string | null> => {
  const supabase: any = getSupabaseService();
  const { data, error } = await supabase
    .from('provider_search_runs')
    .insert({
      brand_id: brandId,
      asset_id: assetId,
      provider: providerName || SERPAPI_LENS_PROVIDER,
      endpoint: call.endpoint,
      request_meta: call.query,
      response_status: call.status || null,
      response_time_ms: call.latencyMs,
      estimated_cost_usd: estimatedCostUsd,
      error: call.error || null,
    })
    .select('id')
    .single();

  if (error) {
    if (!isMissingTableError(error)) {
      console.error('Failed to write provider_search_runs:', error);
    }
    return null;
  }

  return data?.id || null;
};

const persistEvidenceAndOffers = async (
  infringementId: string,
  assetId: string,
  listing: SerpApiListing,
  providerPayloads: Record<string, any>[],
  providerRunId: string | null,
  score: Awaited<ReturnType<typeof scoreRevenue>>
): Promise<void> => {
  const supabase: any = getSupabaseService();
  const snapshot = normalizeEvidenceSnapshot(listing);
  const { normalized, raw } = buildEvidenceBundle(listing, providerPayloads);

  const { error: offerError } = await supabase
    .from('listing_offers')
    .upsert(
      {
        infringement_id: infringementId,
        listing_url: listing.link,
        seller_name: listing.sellerName || listing.source || null,
        store_name: listing.source || null,
        price_value: listing.priceValue ?? null,
        currency: listing.currency || null,
        price_text: listing.priceText || null,
        rating: listing.rating ?? null,
        reviews_count: listing.reviewsCount ?? null,
        in_stock: listing.inStock ?? null,
        condition: listing.condition || null,
        position: listing.position ?? null,
        confidence: listing.confidence ?? null,
        last_seen_at: nowIso(),
        is_active: true,
        metadata: snapshot,
      },
      { onConflict: 'infringement_id,listing_url' }
    );

  if (offerError && !isMissingTableError(offerError)) {
    console.error('Failed to write listing_offers:', offerError);
  }

  const { error: evidenceError } = await supabase
    .from('infringement_evidence')
    .insert({
      infringement_id: infringementId,
      asset_id: assetId,
      provider_run_id: providerRunId,
      evidence_version: 1,
      normalized_json: normalized,
      raw_json: raw,
      source_url_hash: hashSourceUrl(listing.link),
    });

  if (evidenceError && !isMissingTableError(evidenceError)) {
    console.error('Failed to write infringement_evidence:', evidenceError);
  }

  const { error: scoreError } = await supabase
    .from('revenue_scores')
    .insert({
      infringement_id: infringementId,
      model_provider: score.modelProvider,
      model_name: score.modelName || null,
      scoring_order: score.modelProvider === 'openrouter' ? 'openrouter_first' : 'deterministic_first',
      fallback_used: score.fallbackUsed,
      revenue_at_risk_usd: score.revenueAtRiskUsd,
      confidence: score.confidence,
      score_json: score.scoreJson,
      explainability_json: score.explainabilityJson,
    });

  if (scoreError && !isMissingTableError(scoreError)) {
    console.error('Failed to write revenue_scores:', scoreError);
  }
};

export async function POST(req: NextRequest) {
  if (workerSecret) {
    const provided = req.headers.get('x-cron-secret');
    if (!provided || provided !== workerSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!serpApiKey && !openWebNinjaApiKey) {
    return NextResponse.json({ error: 'Missing OPENWEBNINJA_API_KEY (or legacy SERPAPI_API_KEY)' }, { status: 500 });
  }

  const supabase: any = getSupabaseService();
  const { data: brands, error: brandsError } = await supabase
    .from('brands')
    .select('id')
    .limit(2000);

  if (brandsError) {
    return NextResponse.json({ error: 'Failed to load brands' }, { status: 500 });
  }

  const publicOrigin = resolvePublicOrigin(req);
  let processed = 0;
  const results: Array<{
    brandId: string;
    claimed: number;
    success: number;
    failed: number;
    skipped: number;
    deadLettered: number;
    budgetSkipped: number;
  }> = [];

  for (const brand of brands || []) {
    if (processed >= MAX_JOBS_PER_RUN) break;

    const settings = await loadScanSettings(brand.id);
    const budget = await loadDailyBudgetUsage(brand.id);
    const monthlySpend = await loadMonthlySpendUsage(brand.id);
    const whitelistDomains = await loadWhitelistDomains(brand.id);

    const isOpenWebNinja = settings.activeScanProvider === 'openwebninja' && openWebNinjaApiKey;
    const perProviderCallCost = isOpenWebNinja
      ? Math.max(0, settings.reverseImageSearchCostUsd)
      : Math.max(0, settings.serpapiEstimatedCostUsd);
    const estimatedCallsPerScan = isOpenWebNinja
      ? 1  // OpenWebNinja returns results in a single call
      : Math.max(1, Math.min(settings.maxProviderCallsPerScan, 10));
    const estimatedCost = perProviderCallCost * estimatedCallsPerScan;
    const remainingScans = Math.max(0, settings.maxScansPerDay - budget.scansExecuted);
    const remainingSpendUsd = Math.max(0, settings.maxSpendUsdPerDay - budget.spendUsd);
    const remainingMonthlySpendUsd = Math.max(0, settings.maxSpendUsdPerMonth - monthlySpend);
    const remainingBySpend = estimatedCost > 0
      ? Math.floor(remainingSpendUsd / estimatedCost)
      : remainingScans;
    const remainingByMonthlySpend = estimatedCost > 0
      ? Math.floor(remainingMonthlySpendUsd / estimatedCost)
      : remainingScans;
    const budgetCapacity = Math.max(0, Math.min(remainingScans, remainingBySpend, remainingByMonthlySpend));
    const runCapacity = Math.max(0, MAX_JOBS_PER_RUN - processed);
    const claimCapacity = Math.max(0, Math.min(CLAIM_LIMIT, settings.maxParallelScans, budgetCapacity, runCapacity));

    if (claimCapacity <= 0) {
      results.push({
        brandId: brand.id,
        claimed: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        deadLettered: 0,
        budgetSkipped: 0,
      });
      continue;
    }

    const { count: dueCount } = await supabase
      .from('assets')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand.id)
      .eq('type', 'image')
      .in('scan_status', ['queued', 'failed', 'success'])
      .not('next_scan_at', 'is', null)
      .lte('next_scan_at', nowIso());

    const { data: claimed, error: claimError } = await supabase.rpc('claim_due_asset_scans', {
      p_brand_id: brand.id,
      p_limit: claimCapacity,
    });

    if (claimError || !claimed || claimed.length === 0) {
      continue;
    }

    let success = 0;
    let failed = 0;
    let skipped = 0;
    let deadLettered = 0;

    for (const job of claimed as Job[]) {
      if (processed >= MAX_JOBS_PER_RUN) break;
      processed += 1;

      const idempotencyKey = `${job.id}:${job.scan_attempts}`;
      const startedAt = nowIso();

      if (job.scan_attempts > MAX_RETRY_ATTEMPTS) {
        const finishedAt = nowIso();
        await supabase
          .from('assets')
          .update({
            scan_status: 'failed',
            next_scan_at: null,
            last_scanned_at: finishedAt,
            last_scan_error: `Dead-lettered after ${job.scan_attempts} attempts`,
          })
          .eq('id', job.id);

        await supabase
          .from('scan_events')
          .insert({
            brand_id: job.brand_id,
            asset_id: job.id,
            provider: job.scan_provider || 'unknown',
            status: 'skipped',
            started_at: startedAt,
            finished_at: finishedAt,
            matches_found: 0,
            duplicates_skipped: 0,
            invalid_results: 0,
            failed_results: 0,
            estimated_cost_usd: 0,
            error_message: 'Dead-lettered due to retry exhaustion',
            metadata: {
              worker: 'server_cron',
              reason: 'dead_letter',
              idempotencyKey,
            },
          });
        deadLettered += 1;
        continue;
      }

      const activeProvider = isOpenWebNinja ? OPENWEBNINJA_PROVIDER : SERPAPI_LENS_PROVIDER;
      const supportedProviders = [SERPAPI_LENS_PROVIDER, OPENWEBNINJA_PROVIDER, null, ''];
      if (job.scan_provider && !supportedProviders.includes(job.scan_provider)) {
        const finishedAt = nowIso();
        await supabase
          .from('assets')
          .update({
            scan_status: 'queued',
            next_scan_at: addHours(settings.baseIntervalDays * 24),
            last_scanned_at: finishedAt,
            last_scan_error: `Deferred by server worker because provider '${job.scan_provider}' is not supported.`,
          })
          .eq('id', job.id);

        await supabase
          .from('scan_events')
          .insert({
            brand_id: job.brand_id,
            asset_id: job.id,
            provider: job.scan_provider || 'unknown',
            status: 'skipped',
            started_at: startedAt,
            finished_at: finishedAt,
            matches_found: 0,
            duplicates_skipped: 0,
            invalid_results: 0,
            failed_results: 0,
            estimated_cost_usd: 0,
            error_message: 'Provider not supported by server worker',
            metadata: {
              worker: 'server_cron',
              reason: 'provider_deferred',
              idempotencyKey,
            },
          });
        skipped += 1;
        continue;
      }

      const tokenProvider = isOpenWebNinja ? OPENWEBNINJA_PROVIDER as 'openwebninja' : SERPAPI_LENS_PROVIDER as 'serpapi_lens';
      let providerUrl = '';
      if (isPrivateHost(publicOrigin)) {
        const { data: signed, error: signedError } = await supabase.storage
          .from('assets')
          .createSignedUrl(job.storage_path, TOKEN_TTL_SECONDS);
        if (signedError || !signed?.signedUrl) {
          const finishedAt = nowIso();
          await supabase
            .from('assets')
            .update({
              scan_status: 'failed',
              last_scanned_at: finishedAt,
              next_scan_at: addHours(settings.retryDelayHours),
              last_scan_error: 'Failed to create signed storage URL',
            })
            .eq('id', job.id);
          await supabase
            .from('scan_events')
            .insert({
              brand_id: job.brand_id,
              asset_id: job.id,
              provider: activeProvider,
              status: 'failed',
              started_at: startedAt,
              finished_at: finishedAt,
              matches_found: 0,
              duplicates_skipped: 0,
              invalid_results: 0,
              failed_results: 1,
              estimated_cost_usd: 0,
              error_message: 'Failed to create signed storage URL',
              metadata: {
                worker: 'server_cron',
                reason: 'signed_url_error',
                idempotencyKey,
              },
            });
          failed += 1;
          continue;
        }
        providerUrl = signed.signedUrl;
      } else {
        const token = createProviderToken(
          {
            assetId: job.id,
            brandId: job.brand_id,
            provider: tokenProvider,
          },
          TOKEN_TTL_SECONDS
        );
        const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString();
        const { error: tokenLedgerError } = await supabase
          .from('provider_fetch_tokens')
          .upsert({
            token_hash: hashProviderToken(token),
            asset_id: job.id,
            brand_id: job.brand_id,
            provider: tokenProvider,
            expires_at: tokenExpiresAt,
            max_fetches: 5,
            fetch_count: 0,
            revoked: false,
            created_by: null,
          });
        if (tokenLedgerError) {
          const finishedAt = nowIso();
          await supabase
            .from('assets')
            .update({
              scan_status: 'failed',
              last_scanned_at: finishedAt,
              next_scan_at: addHours(settings.retryDelayHours),
              last_scan_error: 'Provider token ledger write failed',
            })
            .eq('id', job.id);
          await supabase
            .from('scan_events')
            .insert({
              brand_id: job.brand_id,
              asset_id: job.id,
              provider: activeProvider,
              status: 'failed',
              started_at: startedAt,
              finished_at: finishedAt,
              matches_found: 0,
              duplicates_skipped: 0,
              invalid_results: 0,
              failed_results: 1,
              estimated_cost_usd: 0,
              error_message: 'Provider token ledger write failed',
              metadata: {
                worker: 'server_cron',
                reason: 'provider_token_ledger_error',
                idempotencyKey,
              },
            });
          failed += 1;
          continue;
        }
        providerUrl = `${publicOrigin}/api/provider-fetch/${token}`;
      }

      let status: 'success' | 'failed' = 'failed';
      let errorMessage: string | null = null;
      let matchesFound = 0;
      let matchesObserved = 0;
      let duplicatesSkipped = 0;
      let invalidResults = 0;
      let failedResults = 0;
      let providerCallsMade = 0;
      let openRouterScoresUsed = 0;
      const providerCalls: Array<{ call: SerpApiSearchCall; runId: string | null }> = [];

      try {
        let mergedListings: SerpApiListing[] = [];

        if (isOpenWebNinja) {
          // ─── OpenWebNinja path ───
          const reverseResult = await searchReverseImage(providerUrl, openWebNinjaApiKey, 50);
          const reverseCall = toSearchCallShape(reverseResult, reverseResult.response, providerUrl);
          providerCallsMade += 1;
          providerCalls.push({
            call: reverseCall,
            runId: await recordProviderRun(job.brand_id, job.id, reverseCall, settings.reverseImageSearchCostUsd, OPENWEBNINJA_PROVIDER),
          });

          if (!reverseResult.ok) {
            errorMessage = reverseResult.error || 'OpenWebNinja reverse image search failed';
          } else {
            let listings = mapReverseImageToListings(reverseResult.response);

            // Optional: Product Search enrichment
            if (settings.enableProductSearch && openWebNinjaApiKey && listings.length > 0) {
              try {
                const topTitle = listings[0]?.title;
                if (topTitle) {
                  const productResult = await searchProducts(topTitle, openWebNinjaApiKey, { limit: 10 });
                  providerCallsMade += 1;
                  if (productResult.ok && Array.isArray(productResult.response?.data)) {
                    const productListings = mapProductsToListings(productResult.response.data);
                    listings = mergeListingsByUrl([...listings, ...productListings]);
                  }
                }
              } catch { /* Product enrichment is best-effort */ }
            }

            // Optional: Real-Time Lens Data visual matches
            if (settings.enableLensData && openWebNinjaApiKey) {
              try {
                const lensResult = await getVisualMatches(providerUrl, openWebNinjaApiKey);
                providerCallsMade += 1;
                const lensCall = toLensSearchCallShape(lensResult, lensResult.data, providerUrl);
                providerCalls.push({
                  call: lensCall,
                  runId: await recordProviderRun(job.brand_id, job.id, lensCall, settings.lensDataCostUsd, OPENWEBNINJA_PROVIDER),
                });
                if (lensResult.ok && lensResult.data.length > 0) {
                  const lensListings = mapVisualMatchesToListings(lensResult.data);
                  listings = mergeListingsByUrl([...listings, ...lensListings]);
                }
              } catch { /* Lens enrichment is best-effort */ }
            }

            // Optional: Real-Time Amazon Data search
            if (settings.enableRealtimeAmazon && openWebNinjaApiKey && listings.length > 0) {
              try {
                const topTitle = listings[0]?.title;
                if (topTitle) {
                  const amazonResult = await searchAmazonProducts(topTitle, openWebNinjaApiKey);
                  providerCallsMade += 1;
                  const amazonProducts = amazonResult.data?.data?.products || [];
                  const amazonCall = toAmazonSearchCallShape(amazonResult, amazonProducts.length, topTitle);
                  providerCalls.push({
                    call: amazonCall,
                    runId: await recordProviderRun(job.brand_id, job.id, amazonCall, settings.realtimeAmazonCostUsd, OPENWEBNINJA_PROVIDER),
                  });
                  if (amazonResult.ok && amazonProducts.length > 0) {
                    const amazonListings = mapAmazonProductsToListings(amazonProducts);
                    listings = mergeListingsByUrl([...listings, ...amazonListings]);
                  }
                }
              } catch { /* Amazon enrichment is best-effort */ }
            }

            mergedListings = listings.slice(0, MAX_MATCHES_PER_SCAN);

            // Optional: Website Contacts enrichment (scrape contact info from top listing domains)
            if (settings.enableWebsiteContacts && openWebNinjaApiKey && mergedListings.length > 0) {
              try {
                const topDomains = new Set<string>();
                for (const l of mergedListings) {
                  try { topDomains.add(new URL(l.link).hostname.replace(/^www\./, '')); } catch { /* skip */ }
                  if (topDomains.size >= 3) break;
                }
                for (const domain of topDomains) {
                  const contactsResult = await scrapeWebsiteContacts(domain, openWebNinjaApiKey, { matchEmailDomain: true });
                  providerCallsMade += 1;
                  const contactsCall = toContactsSearchCallShape(contactsResult, contactsResult.contacts, domain);
                  providerCalls.push({
                    call: contactsCall,
                    runId: await recordProviderRun(job.brand_id, job.id, contactsCall, settings.websiteContactsCostUsd, OPENWEBNINJA_PROVIDER),
                  });
                }
              } catch { /* Contacts enrichment is best-effort */ }
            }

            // Optional: Social Links enrichment (find social profiles for top sellers)
            if (settings.enableSocialLinks && openWebNinjaApiKey && mergedListings.length > 0) {
              try {
                const sellerQuery = mergedListings[0]?.sellerName || mergedListings[0]?.source;
                if (sellerQuery) {
                  const socialResult = await searchSocialLinks(sellerQuery, openWebNinjaApiKey);
                  providerCallsMade += 1;
                  const socialCall = toSocialLinksSearchCallShape(socialResult, socialResult.profiles, sellerQuery);
                  providerCalls.push({
                    call: socialCall,
                    runId: await recordProviderRun(job.brand_id, job.id, socialCall, settings.socialLinksCostUsd, OPENWEBNINJA_PROVIDER),
                  });
                }
              } catch { /* Social enrichment is best-effort */ }
            }

            if (mergedListings.length === 0) {
              status = 'success';
            }
          }
        } else {
          // ─── Legacy SerpApi path ───
          const maxProviderCalls = Math.max(1, Math.min(settings.maxProviderCallsPerScan, 10));

          const lensAll = await searchLensAll(providerUrl, serpApiKey);
          providerCallsMade += 1;
          providerCalls.push({
            call: lensAll,
            runId: await recordProviderRun(job.brand_id, job.id, lensAll, perProviderCallCost),
          });

          if (maxProviderCalls > 1) {
            const lensProducts = await searchLensProducts(providerUrl, serpApiKey);
            providerCallsMade += 1;
            providerCalls.push({
              call: lensProducts,
              runId: await recordProviderRun(job.brand_id, job.id, lensProducts, perProviderCallCost),
            });
          }

          if (maxProviderCalls > 2) {
            const sourcePayload = providerCalls.find((entry) => entry.call.ok && entry.call.payload)?.call.payload || {};
            const followupLinks = extractFollowupSerpApiLinks(sourcePayload, maxProviderCalls - 2);
            for (const link of followupLinks) {
              const followup = await fetchSerpApiFollowupLink(link, serpApiKey);
              providerCallsMade += 1;
              providerCalls.push({
                call: followup,
                runId: await recordProviderRun(job.brand_id, job.id, followup, perProviderCallCost),
              });
            }
          }

          const usableCalls = providerCalls.filter(({ call }) => {
            if (!call.ok) return false;
            const payloadError = typeof call.payload?.error === 'string' ? call.payload.error : '';
            return !payloadError || isNoResultsError(payloadError);
          });

          if (usableCalls.length === 0) {
            const firstFailure = providerCalls.find(({ call }) => !call.ok || call.payload?.error);
            const reason = firstFailure?.call.error
              || (typeof firstFailure?.call.payload?.error === 'string' ? firstFailure?.call.payload?.error : '')
              || 'SerpApi request failed';

            if (isNoResultsError(reason)) {
              status = 'success';
            } else {
              errorMessage = reason;
            }
          } else {
            mergedListings = mergeListingsByUrl(
              usableCalls.flatMap(({ call }) => parseSerpApiListings(call.payload || {}))
            ).slice(0, MAX_MATCHES_PER_SCAN);
          }
        }

        if (mergedListings.length > 0) {

          const seenLinks = new Set<string>();
          const providerPayloads = providerCalls
            .filter(({ call }) => call.ok || call.payload)
            .map(({ call }) => call.payload || {});
          const defaultProviderRunId = providerCalls.find((entry) => entry.runId)?.runId || null;
          const detectionMethod = isOpenWebNinja ? 'reverse_image_search' : 'google_lens';

          for (const listing of mergedListings) {
            const normalizedLink = normalizeUrl(listing.link);
            if (!normalizedLink) {
              invalidResults += 1;
              continue;
            }
            if (seenLinks.has(normalizedLink)) {
              duplicatesSkipped += 1;
              continue;
            }
            seenLinks.add(normalizedLink);

            const domain = normalizeDomain(normalizedLink);
            if (!domain) {
              invalidResults += 1;
              continue;
            }
            if (whitelistDomains.has(domain)) {
              duplicatesSkipped += 1;
              continue;
            }

            matchesObserved += 1;
            const similarity = estimateSimilarityFromListing(listing);
            const copycatImage = normalizeUrl(listing.image || listing.thumbnail || undefined);
            const sellerName = (listing.sellerName || listing.title || listing.source || domain || '').toString().slice(0, 255);
            const platform = mapPlatform(domain);
            const siteVisitors = estimateSiteVisitors(listing, similarity);

            const allowOpenRouterForMatch = Boolean(openRouterApiKey)
              && settings.revenueScoringOrder === 'openrouter_first'
              && openRouterScoresUsed < MAX_OPENROUTER_SCORES_PER_SCAN;
            const score = await scoreRevenue(
              [{
                link: normalizedLink,
                platform,
                priceValue: listing.priceValue,
                currency: listing.currency,
                rating: listing.rating,
                reviewsCount: listing.reviewsCount,
                inStock: listing.inStock,
                position: listing.position,
                confidence: listing.confidence,
                similarityScore: similarity,
              }],
              {
                order: allowOpenRouterForMatch ? settings.revenueScoringOrder : 'deterministic_first',
                openRouterApiKey: allowOpenRouterForMatch ? openRouterApiKey : '',
                model: settings.openrouterModel || defaultOpenRouterModel,
                maxTokens: settings.openrouterMaxTokens,
              }
            );
            if (score.modelProvider === 'openrouter') {
              openRouterScoresUsed += 1;
            }

            const evidenceSnapshot = normalizeEvidenceSnapshot(listing);
            const { data: existing } = await supabase
              .from('infringements')
              .select('id, status')
              .eq('brand_id', job.brand_id)
              .eq('infringing_url', normalizedLink)
              .in('status', ['detected', 'pending_review', 'in_progress'])
              .limit(1)
              .maybeSingle();

            if (existing) {
              duplicatesSkipped += 1;
              const { error: updateError } = await supabase
                .from('infringements')
                .update({
                  copycat_image_url: copycatImage,
                  similarity_score: similarity,
                  seller_name: sellerName || null,
                  primary_listing_price_value: listing.priceValue ?? null,
                  primary_listing_currency: listing.currency || null,
                  primary_seller_name: sellerName || null,
                  primary_rating: listing.rating ?? null,
                  primary_reviews_count: listing.reviewsCount ?? null,
                  primary_in_stock: listing.inStock ?? null,
                  primary_condition: listing.condition || null,
                  primary_listing_position: listing.position ?? null,
                  revenue_score_version: `${score.modelProvider}:${score.modelName || 'v1'}`,
                  revenue_confidence: score.confidence,
                  revenue_at_risk_usd: score.revenueAtRiskUsd,
                  revenue_lost: score.revenueAtRiskUsd,
                  site_visitors: siteVisitors,
                  last_evidence_at: nowIso(),
                  evidence_snapshot: evidenceSnapshot,
                  detection_provider: activeProvider,
                  detection_method: detectionMethod,
                  source_fingerprint: job.fingerprint || null,
                })
                .eq('id', existing.id);

              if (updateError && isMissingColumnError(updateError)) {
                await supabase
                  .from('infringements')
                  .update({
                    copycat_image_url: copycatImage,
                    similarity_score: similarity,
                    seller_name: sellerName || null,
                    revenue_lost: score.revenueAtRiskUsd,
                    site_visitors: siteVisitors,
                    detection_provider: SERPAPI_LENS_PROVIDER,
                    detection_method: 'google_lens',
                    source_fingerprint: job.fingerprint || null,
                  })
                  .eq('id', existing.id);
              }

              await persistEvidenceAndOffers(
                existing.id,
                job.id,
                listing,
                providerPayloads,
                defaultProviderRunId,
                score
              );
              continue;
            }

            const { data: inserted, error: insertError } = await supabase
              .from('infringements')
              .insert({
                brand_id: job.brand_id,
                original_asset_id: job.id,
                copycat_image_url: copycatImage,
                similarity_score: similarity,
                detection_provider: SERPAPI_LENS_PROVIDER,
                detection_method: 'google_lens',
                source_fingerprint: job.fingerprint || null,
                platform,
                infringing_url: normalizedLink,
                seller_name: sellerName || null,
                primary_listing_price_value: listing.priceValue ?? null,
                primary_listing_currency: listing.currency || null,
                primary_seller_name: sellerName || null,
                primary_rating: listing.rating ?? null,
                primary_reviews_count: listing.reviewsCount ?? null,
                primary_in_stock: listing.inStock ?? null,
                primary_condition: listing.condition || null,
                primary_listing_position: listing.position ?? null,
                country: 'Unknown',
                site_visitors: siteVisitors,
                revenue_lost: score.revenueAtRiskUsd,
                revenue_score_version: `${score.modelProvider}:${score.modelName || 'v1'}`,
                revenue_confidence: score.confidence,
                revenue_at_risk_usd: score.revenueAtRiskUsd,
                last_evidence_at: nowIso(),
                evidence_snapshot: evidenceSnapshot,
                whois_registrar: 'Unknown Registrar',
                whois_creation_date: 'Not available',
                whois_registrant_country: 'Unknown',
                hosting_provider: 'Unknown',
                hosting_ip_address: 'Not resolved',
                status: 'pending_review',
              })
              .select('id')
              .single();

            let insertedRow = inserted;
            let finalInsertError = insertError;

            if ((insertError || !insertedRow) && isMissingColumnError(insertError)) {
              const { data: fallbackInserted, error: fallbackInsertError } = await supabase
                .from('infringements')
                .insert({
                  brand_id: job.brand_id,
                  original_asset_id: job.id,
                  copycat_image_url: copycatImage,
                  similarity_score: similarity,
                  detection_provider: activeProvider,
                  detection_method: detectionMethod,
                  source_fingerprint: job.fingerprint || null,
                  platform,
                  infringing_url: normalizedLink,
                  seller_name: sellerName || null,
                  country: 'Unknown',
                  site_visitors: siteVisitors,
                  revenue_lost: score.revenueAtRiskUsd,
                  whois_registrar: 'Unknown Registrar',
                  whois_creation_date: 'Not available',
                  whois_registrant_country: 'Unknown',
                  hosting_provider: 'Unknown',
                  hosting_ip_address: 'Not resolved',
                  status: 'pending_review',
                })
                .select('id')
                .single();
              insertedRow = fallbackInserted;
              finalInsertError = fallbackInsertError;
            }

            if (finalInsertError || !insertedRow) {
              failedResults += 1;
              continue;
            }

            await createTakedownForInfringement(insertedRow.id);
            await persistEvidenceAndOffers(
              insertedRow.id,
              job.id,
              listing,
              providerPayloads,
              defaultProviderRunId,
              score
            );
            matchesFound += 1;
          }

          status = 'success';
        }
      } catch (err: any) {
        errorMessage = err?.message || `${activeProvider} request failed`;
      } finally {
        if (providerCallsMade > 0) {
          const scanCost = Number((providerCallsMade * perProviderCallCost).toFixed(4));
          await recordBudgetUsage(job.brand_id, 1, scanCost);
        }
      }

      const recentMatches = status === 'success'
        ? await loadRecentMatchHistory(job.id, Math.max(0, settings.lookbackScans - 1))
        : [];
      const findingSignal = Math.max(matchesFound, matchesObserved);
      const finishedAt = nowIso();
      const nextScanAt = status === 'success'
        ? computeFixedCadenceNextScanAt(
            {
              baseIntervalDays: settings.baseIntervalDays,
              foundIntervalDays: settings.foundIntervalDays,
              lookbackScans: settings.lookbackScans,
            },
            [findingSignal, ...recentMatches]
          )
        : addHours(settings.retryDelayHours);

      await supabase
        .from('assets')
        .update({
          scan_status: status,
          last_scanned_at: finishedAt,
          next_scan_at: nextScanAt,
          last_scan_error: status === 'failed' ? errorMessage : null,
        })
        .eq('id', job.id);

      await supabase
        .from('scan_events')
        .insert({
          brand_id: job.brand_id,
          asset_id: job.id,
          provider: activeProvider,
          status,
          started_at: startedAt,
          finished_at: finishedAt,
          matches_found: matchesFound,
          duplicates_skipped: duplicatesSkipped,
          invalid_results: invalidResults,
          failed_results: failedResults,
          estimated_cost_usd: Number((providerCallsMade * perProviderCallCost).toFixed(4)),
          error_message: errorMessage,
          metadata: {
            worker: 'server_cron',
            provider_url: providerUrl,
            provider_calls_made: providerCallsMade,
            observed_matches: matchesObserved,
            openrouter_scores_used: openRouterScoresUsed,
            active_provider: activeProvider,
            idempotencyKey,
          },
        });

      if (status === 'success') success += 1;
      else failed += 1;
    }

    const budgetSkipped = Math.max(0, Number(dueCount || 0) - claimCapacity);
    results.push({
      brandId: brand.id,
      claimed: claimed.length,
      success,
      failed,
      skipped,
      deadLettered,
      budgetSkipped,
    });
  }

  return NextResponse.json(
    {
      processed,
      results,
    },
    { status: 200 }
  );
}
