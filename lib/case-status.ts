import type { InfringementStatus } from '../types';

export const CANONICAL_INFRINGEMENT_STATUSES: InfringementStatus[] = [
  'detected',
  'pending_review',
  'needs_member_input',
  'in_progress',
  'resolved_success',
  'resolved_partial',
  'resolved_failed',
  'dismissed_by_member',
  'dismissed_by_admin',
];

// Status groupings for different views
export const DETECTION_STATUSES: InfringementStatus[] = ['detected'];
export const PENDING_STATUSES: InfringementStatus[] = ['pending_review', 'needs_member_input'];
export const ENFORCING_STATUSES: InfringementStatus[] = ['in_progress'];
export const TAKEDOWN_STATUSES: InfringementStatus[] = [
  'resolved_success',
  'resolved_partial',
  'resolved_failed',
  'dismissed_by_member',
  'dismissed_by_admin',
];

// Legacy groupings for backwards compatibility
export const ACTIVE_CASE_STATUSES: InfringementStatus[] = [
  'detected',
  'pending_review',
  'needs_member_input',
  'in_progress',
];
export const RESOLVED_CASE_STATUSES: InfringementStatus[] = [
  'resolved_success',
  'resolved_partial',
];
export const CLOSED_CASE_STATUSES: InfringementStatus[] = [
  'resolved_success',
  'resolved_partial',
  'resolved_failed',
  'dismissed_by_member',
  'dismissed_by_admin',
];

export type CaseTransitionAction =
  | 'agent_detection_complete'
  | 'member_request_enforcement'  // Member requests enforcement from Detections
  | 'member_dismiss'              // Member dismisses from Detections
  | 'member_respond'              // Member responds to admin request
  | 'member_withdraw'             // Member withdraws request
  | 'member_request_retry'        // Member requests retry on failed case
  | 'admin_approve'               // Admin approves and starts enforcement
  | 'admin_request_input'         // Admin sends back to member for more info
  | 'admin_dismiss'               // Admin dismisses the case
  | 'admin_resolve_success'       // Admin marks as successfully resolved
  | 'admin_resolve_partial'       // Admin marks as partially resolved
  | 'admin_resolve_failed'        // Admin marks as failed
  | 'admin_reopen'                // Admin reopens a closed case
  // Legacy actions for backwards compatibility
  | 'company_enforce'
  | 'company_dismiss'
  | 'company_whitelist'
  | 'lawyer_resolve'
  | 'lawyer_reject'
  | 'monitor_relist'
  | 'reopen_with_evidence'
  | 'manual_reopen';

export interface CaseTransitionError {
  code: 'invalid_transition' | 'missing_required_action';
  message: string;
  from: InfringementStatus;
  to: InfringementStatus;
  allowedNext: InfringementStatus[];
  requiredAction?: CaseTransitionAction;
}

export type CaseTransitionValidationResult =
  | { ok: true }
  | { ok: false; error: CaseTransitionError };

const ALLOWED_STATUS_TRANSITIONS: Record<InfringementStatus, InfringementStatus[]> = {
  // Member requests enforcement -> goes to pending_review
  // Member dismisses -> goes to dismissed_by_member
  detected: ['pending_review', 'dismissed_by_member'],

  // Admin approves -> goes to in_progress
  // Admin requests more info -> goes to needs_member_input
  // Admin dismisses -> goes to dismissed_by_admin
  pending_review: ['in_progress', 'needs_member_input', 'dismissed_by_admin'],

  // Member responds -> back to pending_review
  // Member withdraws -> goes to dismissed_by_member
  needs_member_input: ['pending_review', 'dismissed_by_member'],

  // Admin completes enforcement with various outcomes
  in_progress: ['resolved_success', 'resolved_partial', 'resolved_failed', 'dismissed_by_admin'],

  // Success cases can be reopened (rare)
  resolved_success: ['detected'],

  // Partial cases can be reopened
  resolved_partial: ['detected'],

  // Failed cases can be retried (goes back to pending) or reopened
  resolved_failed: ['pending_review', 'detected'],

  // Dismissed by member can be reopened by member
  dismissed_by_member: ['detected'],

  // Dismissed by admin can be reopened by admin
  dismissed_by_admin: ['detected'],
};

const REQUIRED_ACTION_BY_TRANSITION: Partial<Record<`${InfringementStatus}->${InfringementStatus}`, CaseTransitionAction>> = {
  // Admin must explicitly approve to move to enforcement
  'pending_review->in_progress': 'admin_approve',
};

const DEFAULT_ACTION_BY_TRANSITION: Partial<Record<`${InfringementStatus}->${InfringementStatus}`, CaseTransitionAction>> = {
  // Member actions from Detections
  'detected->pending_review': 'member_request_enforcement',
  'detected->dismissed_by_member': 'member_dismiss',

  // Admin actions from Pending Review
  'pending_review->in_progress': 'admin_approve',
  'pending_review->needs_member_input': 'admin_request_input',
  'pending_review->dismissed_by_admin': 'admin_dismiss',

  // Member actions from Needs Input
  'needs_member_input->pending_review': 'member_respond',
  'needs_member_input->dismissed_by_member': 'member_withdraw',

  // Admin actions from In Progress (Enforcing)
  'in_progress->resolved_success': 'admin_resolve_success',
  'in_progress->resolved_partial': 'admin_resolve_partial',
  'in_progress->resolved_failed': 'admin_resolve_failed',
  'in_progress->dismissed_by_admin': 'admin_dismiss',

  // Retry/reopen actions
  'resolved_failed->pending_review': 'member_request_retry',
  'resolved_failed->detected': 'admin_reopen',
  'resolved_success->detected': 'admin_reopen',
  'resolved_partial->detected': 'admin_reopen',
  'dismissed_by_member->detected': 'manual_reopen',
  'dismissed_by_admin->detected': 'admin_reopen',
};

export function isActiveCaseStatus(status: InfringementStatus): boolean {
  return ACTIVE_CASE_STATUSES.includes(status);
}

export function isResolvedCaseStatus(status: InfringementStatus): boolean {
  return RESOLVED_CASE_STATUSES.includes(status);
}

export function getAllowedCaseTransitions(from: InfringementStatus): InfringementStatus[] {
  return [...ALLOWED_STATUS_TRANSITIONS[from]];
}

export function canTransitionCaseStatus(from: InfringementStatus, to: InfringementStatus): boolean {
  if (from === to) {
    return true;
  }

  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

export function validateCaseStatusTransition(
  from: InfringementStatus,
  to: InfringementStatus,
  action?: CaseTransitionAction
): CaseTransitionValidationResult {
  if (from === to) {
    return { ok: true };
  }

  const allowedNext = getAllowedCaseTransitions(from);
  if (!allowedNext.includes(to)) {
    return {
      ok: false,
      error: {
        code: 'invalid_transition',
        message: `Cannot move case from ${from} to ${to}.`,
        from,
        to,
        allowedNext,
      },
    };
  }

  const transitionKey = `${from}->${to}` as const;
  const requiredAction = REQUIRED_ACTION_BY_TRANSITION[transitionKey];

  if (requiredAction && action !== requiredAction) {
    return {
      ok: false,
      error: {
        code: 'missing_required_action',
        message: `Transition ${from} -> ${to} requires ${requiredAction}.`,
        from,
        to,
        allowedNext,
        requiredAction,
      },
    };
  }

  return { ok: true };
}

export function inferCaseTransitionAction(
  from: InfringementStatus,
  to: InfringementStatus
): CaseTransitionAction | undefined {
  if (from === to) {
    return undefined;
  }

  const transitionKey = `${from}->${to}` as const;
  return DEFAULT_ACTION_BY_TRANSITION[transitionKey];
}

// Tab-based status helpers
export function isDetectionStatus(status: InfringementStatus): boolean {
  return DETECTION_STATUSES.includes(status);
}

export function isPendingStatus(status: InfringementStatus): boolean {
  return PENDING_STATUSES.includes(status);
}

export function isEnforcingStatus(status: InfringementStatus): boolean {
  return ENFORCING_STATUSES.includes(status);
}

export function isTakedownStatus(status: InfringementStatus): boolean {
  return TAKEDOWN_STATUSES.includes(status);
}

export function needsMemberInput(status: InfringementStatus): boolean {
  return status === 'needs_member_input';
}

export function isSuccessOutcome(status: InfringementStatus): boolean {
  return status === 'resolved_success';
}

export function isPartialOutcome(status: InfringementStatus): boolean {
  return status === 'resolved_partial';
}

export function isFailedOutcome(status: InfringementStatus): boolean {
  return status === 'resolved_failed';
}

export function isDismissedStatus(status: InfringementStatus): boolean {
  return status === 'dismissed_by_member' || status === 'dismissed_by_admin';
}

export function canRetry(status: InfringementStatus): boolean {
  return status === 'resolved_failed';
}

export function canReopen(status: InfringementStatus): boolean {
  return isDismissedStatus(status) || isTakedownStatus(status);
}

// Status display helpers
export type StatusTab = 'detections' | 'pending' | 'enforcing' | 'takedowns';

export function getStatusTab(status: InfringementStatus): StatusTab {
  if (isDetectionStatus(status)) return 'detections';
  if (isPendingStatus(status)) return 'pending';
  if (isEnforcingStatus(status)) return 'enforcing';
  return 'takedowns';
}

export type TakedownSubTab = 'successful' | 'partial' | 'failed' | 'dismissed';

export function getTakedownSubTab(status: InfringementStatus): TakedownSubTab | null {
  switch (status) {
    case 'resolved_success':
      return 'successful';
    case 'resolved_partial':
      return 'partial';
    case 'resolved_failed':
      return 'failed';
    case 'dismissed_by_member':
    case 'dismissed_by_admin':
      return 'dismissed';
    default:
      return null;
  }
}

export function getStatusDisplayName(status: InfringementStatus): string {
  const displayNames: Record<InfringementStatus, string> = {
    detected: 'New Detection',
    pending_review: 'Awaiting Review',
    needs_member_input: 'Needs Your Input',
    in_progress: 'In Progress',
    resolved_success: 'Successful',
    resolved_partial: 'Partial',
    resolved_failed: 'Failed',
    dismissed_by_member: 'Dismissed',
    dismissed_by_admin: 'Dismissed by Admin',
  };
  return displayNames[status];
}

export function getStatusColor(status: InfringementStatus): string {
  const colors: Record<InfringementStatus, string> = {
    detected: 'blue',
    pending_review: 'yellow',
    needs_member_input: 'orange',
    in_progress: 'purple',
    resolved_success: 'green',
    resolved_partial: 'lime',
    resolved_failed: 'red',
    dismissed_by_member: 'gray',
    dismissed_by_admin: 'gray',
  };
  return colors[status];
}
