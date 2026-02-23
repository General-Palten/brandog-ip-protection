import type { InfringementStatus } from '../types';

export const ACTIVE_CASE_STATUSES: InfringementStatus[] = ['detected', 'pending_review', 'in_progress'];
export const RESOLVED_CASE_STATUSES: InfringementStatus[] = ['resolved'];
export const CLOSED_CASE_STATUSES: InfringementStatus[] = ['resolved', 'rejected'];

export function isActiveCaseStatus(status: InfringementStatus): boolean {
  return ACTIVE_CASE_STATUSES.includes(status);
}

export function isResolvedCaseStatus(status: InfringementStatus): boolean {
  return RESOLVED_CASE_STATUSES.includes(status);
}
