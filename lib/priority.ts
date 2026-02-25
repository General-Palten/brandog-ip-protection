import type { InfringementItem, InfringementPriority, PrioritySetBy } from '../types';

// Thresholds for auto-priority calculation
const HIGH_REVENUE_THRESHOLD = 5000;
const MEDIUM_REVENUE_THRESHOLD = 1000;
const HIGH_SCORE_THRESHOLD = 95;
const MEDIUM_SCORE_THRESHOLD = 80;
const HIGH_VISITORS_THRESHOLD = 10000;
const MEDIUM_VISITORS_THRESHOLD = 1000;

/**
 * Calculate automatic priority based on revenue, match score, and traffic
 */
export function calculateAutoPriority(infringement: InfringementItem): InfringementPriority {
  const { revenueLost, similarityScore, siteVisitors } = infringement;

  // High priority: significant revenue OR very high match score OR high traffic
  if (
    revenueLost >= HIGH_REVENUE_THRESHOLD ||
    similarityScore >= HIGH_SCORE_THRESHOLD ||
    siteVisitors >= HIGH_VISITORS_THRESHOLD
  ) {
    return 'high';
  }

  // Medium priority: moderate revenue OR good match score OR moderate traffic
  if (
    revenueLost >= MEDIUM_REVENUE_THRESHOLD ||
    similarityScore >= MEDIUM_SCORE_THRESHOLD ||
    siteVisitors >= MEDIUM_VISITORS_THRESHOLD
  ) {
    return 'medium';
  }

  // Low priority: everything else
  return 'low';
}

/**
 * Get the effective priority (use set priority if available, otherwise calculate)
 */
export function getEffectivePriority(infringement: InfringementItem): InfringementPriority {
  if (infringement.priority) {
    return infringement.priority;
  }
  return calculateAutoPriority(infringement);
}

/**
 * Get color class for priority display
 */
export function getPriorityColor(priority: InfringementPriority): string {
  switch (priority) {
    case 'high':
      return 'red';
    case 'medium':
      return 'orange';
    case 'low':
      return 'yellow';
  }
}

/**
 * Get Tailwind classes for priority badge
 */
export function getPriorityClasses(priority: InfringementPriority): string {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'medium':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'low':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }
}

/**
 * Get display label for priority
 */
export function getPriorityLabel(
  priority: InfringementPriority,
  setBy?: PrioritySetBy
): string {
  const baseLabel = priority.charAt(0).toUpperCase() + priority.slice(1);

  if (setBy === 'admin') {
    return `${baseLabel} (adjusted by admin)`;
  }

  return baseLabel;
}

/**
 * Get severity level for revenue at risk display
 */
export type RevenueSeverity = 'high' | 'medium' | 'low';

export function getRevenueSeverity(revenueLost: number): RevenueSeverity {
  if (revenueLost >= HIGH_REVENUE_THRESHOLD) return 'high';
  if (revenueLost >= MEDIUM_REVENUE_THRESHOLD) return 'medium';
  return 'low';
}

/**
 * Get color for revenue display
 */
export function getRevenueColor(revenueLost: number): string {
  const severity = getRevenueSeverity(revenueLost);
  switch (severity) {
    case 'high':
      return 'red';
    case 'medium':
      return 'orange';
    case 'low':
      return 'yellow';
  }
}

/**
 * Get Tailwind classes for revenue display
 */
export function getRevenueClasses(revenueLost: number): string {
  const severity = getRevenueSeverity(revenueLost);
  switch (severity) {
    case 'high':
      return 'text-red-600 bg-red-50';
    case 'medium':
      return 'text-orange-600 bg-orange-50';
    case 'low':
      return 'text-yellow-600 bg-yellow-50';
  }
}

/**
 * Format revenue for display
 * If revenue is known, show dollar amount with color
 * If revenue is 0/unknown, show severity level based on other signals
 */
export function formatRevenueDisplay(infringement: InfringementItem): {
  text: string;
  severity: RevenueSeverity;
  hasDollarAmount: boolean;
} {
  const { revenueLost, similarityScore, siteVisitors } = infringement;

  if (revenueLost > 0) {
    return {
      text: `$${revenueLost.toLocaleString()}`,
      severity: getRevenueSeverity(revenueLost),
      hasDollarAmount: true,
    };
  }

  // No dollar amount - calculate severity from other signals
  let severity: RevenueSeverity = 'low';

  if (similarityScore >= HIGH_SCORE_THRESHOLD || siteVisitors >= HIGH_VISITORS_THRESHOLD) {
    severity = 'high';
  } else if (similarityScore >= MEDIUM_SCORE_THRESHOLD || siteVisitors >= MEDIUM_VISITORS_THRESHOLD) {
    severity = 'medium';
  }

  const severityLabels: Record<RevenueSeverity, string> = {
    high: 'High Risk',
    medium: 'Medium Risk',
    low: 'Low Risk',
  };

  return {
    text: severityLabels[severity],
    severity,
    hasDollarAmount: false,
  };
}
