import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';
import { createProviderToken, hashProviderToken } from '@/lib/provider-token';
import type { PlatformType } from '@/lib/database.types';

const CLAIM_LIMIT = 10;
const MAX_JOBS_PER_RUN = 50;
const MAX_RETRY_ATTEMPTS = 10;
const TOKEN_TTL_SECONDS = 120;
const NO_MATCH_STALE_THRESHOLD = 3;
const MAX_MATCHES_PER_SCAN = 25;

const DEFAULT_SCAN_SETTINGS = {
  maxScansPerDay: 250,
  maxSpendUsdPerDay: 25,
  maxParallelScans: 3,
  highRiskIntervalHours: 168, // weekly
  mediumRiskIntervalHours: 336, // biweekly
  lowRiskIntervalHours: 720, // monthly
  staleIntervalHours: 720,
  retryDelayHours: 6,
  serpapiEstimatedCostUsd: 0.01,
};

const PUBLIC_APP_URL = (process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || '').trim();
const serpApiKey = (process.env.SERPAPI_API_KEY || '').trim();
const workerSecret = (process.env.SCAN_WORKER_SECRET || '').trim();

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
  highRiskIntervalHours: number;
  mediumRiskIntervalHours: number;
  lowRiskIntervalHours: number;
  staleIntervalHours: number;
  retryDelayHours: number;
  serpapiEstimatedCostUsd: number;
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

const computeNextScanAt = (
  settings: ScanSettings,
  matchesFound: number,
  noMatchStreak: number
): string => {
  if (matchesFound >= 5) return addHours(settings.highRiskIntervalHours);
  if (matchesFound > 0) return addHours(settings.mediumRiskIntervalHours);
  if (noMatchStreak >= NO_MATCH_STALE_THRESHOLD) return addHours(settings.staleIntervalHours);
  return addHours(settings.lowRiskIntervalHours);
};

const loadScanSettings = async (brandId: string): Promise<ScanSettings> => {
  const supabase: any = getSupabaseService();
  const { data } = await supabase
    .from('scan_settings')
    .select(`
      max_scans_per_day,
      max_spend_usd_per_day,
      max_parallel_scans,
      high_risk_interval_hours,
      medium_risk_interval_hours,
      low_risk_interval_hours,
      stale_interval_hours,
      retry_delay_hours,
      serpapi_estimated_cost_usd
    `)
    .eq('brand_id', brandId)
    .maybeSingle();

  if (!data) {
    return { ...DEFAULT_SCAN_SETTINGS };
  }

  return {
    maxScansPerDay: Number(data.max_scans_per_day ?? DEFAULT_SCAN_SETTINGS.maxScansPerDay),
    maxSpendUsdPerDay: Number(data.max_spend_usd_per_day ?? DEFAULT_SCAN_SETTINGS.maxSpendUsdPerDay),
    maxParallelScans: Number(data.max_parallel_scans ?? DEFAULT_SCAN_SETTINGS.maxParallelScans),
    highRiskIntervalHours: Number(data.high_risk_interval_hours ?? DEFAULT_SCAN_SETTINGS.highRiskIntervalHours),
    mediumRiskIntervalHours: Number(data.medium_risk_interval_hours ?? DEFAULT_SCAN_SETTINGS.mediumRiskIntervalHours),
    lowRiskIntervalHours: Number(data.low_risk_interval_hours ?? DEFAULT_SCAN_SETTINGS.lowRiskIntervalHours),
    staleIntervalHours: Number(data.stale_interval_hours ?? DEFAULT_SCAN_SETTINGS.staleIntervalHours),
    retryDelayHours: Number(data.retry_delay_hours ?? DEFAULT_SCAN_SETTINGS.retryDelayHours),
    serpapiEstimatedCostUsd: Number(data.serpapi_estimated_cost_usd ?? DEFAULT_SCAN_SETTINGS.serpapiEstimatedCostUsd),
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

const recordBudgetUsage = async (brandId: string, scanIncrement: number, spendIncrementUsd: number): Promise<void> => {
  if (scanIncrement <= 0 && spendIncrementUsd <= 0) return;
  const supabase: any = getSupabaseService();
  await supabase.rpc('record_scan_budget_usage', {
    p_brand_id: brandId,
    p_scan_increment: Math.max(0, scanIncrement),
    p_spend_increment: Math.max(0, spendIncrementUsd),
  });
};

const getNoMatchStreak = async (assetId: string): Promise<number> => {
  const supabase: any = getSupabaseService();
  const { data } = await supabase
    .from('scan_events')
    .select('status, matches_found')
    .eq('asset_id', assetId)
    .order('started_at', { ascending: false })
    .limit(NO_MATCH_STALE_THRESHOLD);

  if (!data || data.length === 0) return 0;

  let streak = 0;
  for (const row of data) {
    if (row.status !== 'success') break;
    if ((row.matches_found || 0) > 0) break;
    streak += 1;
  }
  return streak;
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

export async function POST(req: NextRequest) {
  if (workerSecret) {
    const provided = req.headers.get('x-cron-secret');
    if (!provided || provided !== workerSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!serpApiKey) {
    return NextResponse.json({ error: 'Missing SERPAPI_API_KEY' }, { status: 500 });
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
    const whitelistDomains = await loadWhitelistDomains(brand.id);

    const estimatedCost = Math.max(0, settings.serpapiEstimatedCostUsd);
    const remainingScans = Math.max(0, settings.maxScansPerDay - budget.scansExecuted);
    const remainingSpendUsd = Math.max(0, settings.maxSpendUsdPerDay - budget.spendUsd);
    const remainingBySpend = estimatedCost > 0
      ? Math.floor(remainingSpendUsd / estimatedCost)
      : remainingScans;
    const budgetCapacity = Math.max(0, Math.min(remainingScans, remainingBySpend));
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

      if (job.scan_provider !== 'serpapi_lens') {
        const finishedAt = nowIso();
        await supabase
          .from('assets')
          .update({
            scan_status: 'queued',
            next_scan_at: addHours(settings.lowRiskIntervalHours),
            last_scanned_at: finishedAt,
            last_scan_error: 'Deferred by server worker because provider is not serpapi_lens.',
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
            error_message: 'Provider not supported by server Lens worker',
            metadata: {
              worker: 'server_cron',
              reason: 'provider_deferred',
              idempotencyKey,
            },
          });
        skipped += 1;
        continue;
      }

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
              last_scan_error: 'Failed to create signed storage URL for SerpApi',
            })
            .eq('id', job.id);
          await supabase
            .from('scan_events')
            .insert({
              brand_id: job.brand_id,
              asset_id: job.id,
              provider: 'serpapi_lens',
              status: 'failed',
              started_at: startedAt,
              finished_at: finishedAt,
              matches_found: 0,
              duplicates_skipped: 0,
              invalid_results: 0,
              failed_results: 1,
              estimated_cost_usd: 0,
              error_message: 'Failed to create signed storage URL for SerpApi',
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
            provider: 'serpapi_lens',
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
            provider: 'serpapi_lens',
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
              provider: 'serpapi_lens',
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

      const params = new URLSearchParams({
        engine: 'google_lens',
        type: 'all',
        url: providerUrl,
        api_key: serpApiKey,
      });

      let status: 'success' | 'failed' = 'failed';
      let errorMessage: string | null = null;
      let matchesFound = 0;
      let duplicatesSkipped = 0;
      let invalidResults = 0;
      let failedResults = 0;

      try {
        const resp = await fetch(`https://serpapi.com/search.json?${params.toString()}`, { method: 'GET' });
        const payload = await resp.json().catch(() => ({}));

        await recordBudgetUsage(job.brand_id, 1, estimatedCost);

        if (!resp.ok) {
          errorMessage = payload.error || `SerpApi error ${resp.status}`;
        } else {
          const visualMatches = Array.isArray(payload.visual_matches) ? payload.visual_matches : [];
          const exactMatches = Array.isArray(payload.exact_matches) ? payload.exact_matches : [];
          const combined = [
            ...visualMatches.map((m: any) => ({ ...m, __kind: 'visual' as const })),
            ...exactMatches.map((m: any) => ({ ...m, __kind: 'exact' as const })),
          ].slice(0, MAX_MATCHES_PER_SCAN);

          const seenLinks = new Set<string>();
          for (const match of combined) {
            const normalizedLink = normalizeUrl(match.link || match.url);
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
              continue;
            }

            const similarity = match.__kind === 'exact' ? 90 : 70;
            const copycatImage = normalizeUrl(match.image || match.thumbnail || undefined);
            const sellerName = (match.title || match.source || domain || '').toString().slice(0, 255);
            const platform = mapPlatform(domain);

            const { data: inserted, error: insertError } = await supabase
              .from('infringements')
              .insert({
                brand_id: job.brand_id,
                original_asset_id: job.id,
                copycat_image_url: copycatImage,
                similarity_score: similarity,
                detection_provider: 'serpapi_lens',
                detection_method: 'google_lens',
                source_fingerprint: job.fingerprint || null,
                platform,
                infringing_url: normalizedLink,
                seller_name: sellerName || null,
                country: 'Unknown',
                site_visitors: 0,
                revenue_lost: 0,
                whois_registrar: 'Unknown Registrar',
                whois_creation_date: 'Not available',
                whois_registrant_country: 'Unknown',
                hosting_provider: 'Unknown',
                hosting_ip_address: 'Not resolved',
                status: 'pending_review',
              })
              .select('id')
              .single();

            if (insertError || !inserted) {
              failedResults += 1;
              continue;
            }

            await createTakedownForInfringement(inserted.id);
            matchesFound += 1;
          }

          status = 'success';
        }
      } catch (err: any) {
        errorMessage = err?.message || 'SerpApi request failed';
        await recordBudgetUsage(job.brand_id, 1, estimatedCost);
      }

      const noMatchStreak = matchesFound > 0 ? 0 : (await getNoMatchStreak(job.id)) + 1;
      const finishedAt = nowIso();
      const nextScanAt = status === 'success'
        ? computeNextScanAt(settings, matchesFound, noMatchStreak)
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
          provider: 'serpapi_lens',
          status,
          started_at: startedAt,
          finished_at: finishedAt,
          matches_found: matchesFound,
          duplicates_skipped: duplicatesSkipped,
          invalid_results: invalidResults,
          failed_results: failedResults,
          estimated_cost_usd: estimatedCost,
          error_message: errorMessage,
          metadata: {
            worker: 'server_cron',
            provider_url: providerUrl,
            noMatchStreak,
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
