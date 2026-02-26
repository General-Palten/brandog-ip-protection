export interface CadencePolicy {
  baseIntervalDays: number;
  foundIntervalDays: number;
  lookbackScans: number;
}

const clampInt = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  const rounded = Math.round(value);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
};

export const normalizeCadencePolicy = (policy: Partial<CadencePolicy> | null | undefined): CadencePolicy => {
  return {
    baseIntervalDays: clampInt(policy?.baseIntervalDays ?? 14, 1, 365),
    foundIntervalDays: clampInt(policy?.foundIntervalDays ?? 3, 1, 365),
    lookbackScans: clampInt(policy?.lookbackScans ?? 5, 1, 50),
  };
};

export const toNextScanAt = (intervalDays: number): string => {
  const clamped = clampInt(intervalDays, 1, 365);
  return new Date(Date.now() + clamped * 24 * 60 * 60 * 1000).toISOString();
};

export const hasFindingsInLookback = (
  recentMatchesFound: number[],
  lookbackScans: number
): boolean => {
  const lookback = clampInt(lookbackScans, 1, 50);
  return recentMatchesFound.slice(0, lookback).some((count) => count > 0);
};

export const computeFixedCadenceNextScanAt = (
  policyInput: Partial<CadencePolicy> | null | undefined,
  recentMatchesFound: number[]
): string => {
  const policy = normalizeCadencePolicy(policyInput);
  const hasRecentFindings = hasFindingsInLookback(recentMatchesFound, policy.lookbackScans);
  return toNextScanAt(hasRecentFindings ? policy.foundIntervalDays : policy.baseIntervalDays);
};
