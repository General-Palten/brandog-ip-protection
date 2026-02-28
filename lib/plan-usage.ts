import type { PlanUsage } from '../types';

export interface PlanLimits {
  maxScansPerMonth: number;
  maxAssets: number;
  maxKeywords: number;
  maxTeamSeats: number;
  maxApiCallsPerMonth: number;
  maxStorageBytes: number;
}

export interface CurrentUsage {
  scansThisMonth: number;
  apiCallsThisMonth: number;
  assets: number;
  activeKeywords: number;
  teamSeats: number;
  storageBytes: number;
}

export interface EnforcementResult {
  allowed: boolean;
  reason?: string;
}

const DEFAULT_LIMITS: PlanLimits = {
  maxScansPerMonth: 1000,
  maxAssets: 100,
  maxKeywords: 50,
  maxTeamSeats: 10,
  maxApiCallsPerMonth: 5000,
  maxStorageBytes: 10_737_418_240, // 10 GB
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

export async function loadPlanLimits(supabase: SupabaseAny, brandId: string): Promise<PlanLimits> {
  const { data } = await supabase
    .from('scan_settings')
    .select('max_scans_per_month, max_assets, max_keywords, max_team_seats, max_api_calls_per_month, max_storage_bytes')
    .eq('brand_id', brandId)
    .maybeSingle();

  if (!data) return { ...DEFAULT_LIMITS };

  return {
    maxScansPerMonth: Number(data.max_scans_per_month ?? DEFAULT_LIMITS.maxScansPerMonth),
    maxAssets: Number(data.max_assets ?? DEFAULT_LIMITS.maxAssets),
    maxKeywords: Number(data.max_keywords ?? DEFAULT_LIMITS.maxKeywords),
    maxTeamSeats: Number(data.max_team_seats ?? DEFAULT_LIMITS.maxTeamSeats),
    maxApiCallsPerMonth: Number(data.max_api_calls_per_month ?? DEFAULT_LIMITS.maxApiCallsPerMonth),
    maxStorageBytes: Number(data.max_storage_bytes ?? DEFAULT_LIMITS.maxStorageBytes),
  };
}

export async function loadCurrentUsage(supabase: SupabaseAny, brandId: string): Promise<CurrentUsage> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [scansRes, apiCallsRes, assetsRes, keywordsRes, teamRes, storageRes] = await Promise.all([
    // Scans this month: SUM(scans_executed) from scan_budget_daily
    supabase
      .from('scan_budget_daily')
      .select('scans_executed')
      .eq('brand_id', brandId)
      .gte('budget_date', monthStart)
      .lte('budget_date', today),
    // API calls this month: COUNT(*) from provider_search_runs
    supabase
      .from('provider_search_runs')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .gte('created_at', `${monthStart}T00:00:00Z`),
    // Assets count
    supabase
      .from('assets')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId),
    // Active keywords count
    supabase
      .from('keywords')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('type', 'active'),
    // Team seats: COUNT(*) from brand_members
    supabase
      .from('brand_members')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId),
    // Storage: SUM(file_size) from assets
    supabase
      .from('assets')
      .select('file_size')
      .eq('brand_id', brandId),
  ]);

  const scansThisMonth = (scansRes.data || []).reduce(
    (sum: number, row: { scans_executed?: number }) => sum + Number(row.scans_executed || 0),
    0
  );

  const storageBytes = (storageRes.data || []).reduce(
    (sum: number, row: { file_size?: number | null }) => sum + Number(row.file_size || 0),
    0
  );

  return {
    scansThisMonth,
    apiCallsThisMonth: apiCallsRes.count ?? 0,
    assets: assetsRes.count ?? 0,
    activeKeywords: keywordsRes.count ?? 0,
    teamSeats: teamRes.count ?? 0,
    storageBytes,
  };
}

export async function loadPlanUsage(supabase: SupabaseAny, brandId: string): Promise<PlanUsage> {
  const [limits, usage] = await Promise.all([
    loadPlanLimits(supabase, brandId),
    loadCurrentUsage(supabase, brandId),
  ]);

  return {
    scansUsed: usage.scansThisMonth,
    scansLimit: limits.maxScansPerMonth,
    keywordsMonitored: usage.activeKeywords,
    keywordsLimit: limits.maxKeywords,
    assetsProtected: usage.assets,
    assetsLimit: limits.maxAssets,
    teamSeats: usage.teamSeats,
    teamSeatsLimit: limits.maxTeamSeats,
    apiCalls: usage.apiCallsThisMonth,
    apiCallsLimit: limits.maxApiCallsPerMonth,
    storageUsedGB: +(usage.storageBytes / 1_073_741_824).toFixed(2),
    storageLimitGB: +(limits.maxStorageBytes / 1_073_741_824).toFixed(2),
  };
}

// Enforcement helpers
export function canExecuteScan(usage: CurrentUsage, limits: PlanLimits): EnforcementResult {
  if (usage.scansThisMonth >= limits.maxScansPerMonth) {
    return { allowed: false, reason: `Monthly scan limit reached (${limits.maxScansPerMonth})` };
  }
  return { allowed: true };
}

export function canAddAsset(usage: CurrentUsage, limits: PlanLimits): EnforcementResult {
  if (usage.assets >= limits.maxAssets) {
    return { allowed: false, reason: `Asset limit reached (${limits.maxAssets})` };
  }
  return { allowed: true };
}

export function canAddKeyword(usage: CurrentUsage, limits: PlanLimits): EnforcementResult {
  if (usage.activeKeywords >= limits.maxKeywords) {
    return { allowed: false, reason: `Active keyword limit reached (${limits.maxKeywords})` };
  }
  return { allowed: true };
}

export function canInviteMember(usage: CurrentUsage, limits: PlanLimits): EnforcementResult {
  if (usage.teamSeats >= limits.maxTeamSeats) {
    return { allowed: false, reason: `Team seat limit reached (${limits.maxTeamSeats})` };
  }
  return { allowed: true };
}

export function canMakeApiCall(usage: CurrentUsage, limits: PlanLimits): EnforcementResult {
  if (usage.apiCallsThisMonth >= limits.maxApiCallsPerMonth) {
    return { allowed: false, reason: `Monthly API call limit reached (${limits.maxApiCallsPerMonth})` };
  }
  return { allowed: true };
}

export function canUploadStorage(usage: CurrentUsage, limits: PlanLimits, fileSizeBytes: number): EnforcementResult {
  if (usage.storageBytes + fileSizeBytes > limits.maxStorageBytes) {
    const limitGB = (limits.maxStorageBytes / 1_073_741_824).toFixed(1);
    return { allowed: false, reason: `Storage limit would be exceeded (${limitGB} GB)` };
  }
  return { allowed: true };
}
