import { useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { isActiveCaseStatus, isResolvedCaseStatus } from '../lib/case-status';

export interface CaseSummary {
  id: string;
  sellerName: string | null;
  platform: string;
  country: string;
  similarityScore: number;
  revenueAtRisk: number;
  status: string;
  detectedAt: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface ChatContextPayload {
  dateRangeLabel: string;
  activeThreats: number;
  potentialLossUsd: number;
  revenueProtectedUsd: number;
  detectionPrecisionPct: number;
  falsePositiveRatePct: number;
  duplicateRatePct: number;
  enforcementSuccessRatePct: number;
  enforcementAppealRatePct: number;
  relistRatePct: number;
  topRiskPlatform: string | null;
  topRiskPlatformSharePct: number | null;
  topCountry: string | null;
  topCountryViolations: number | null;
  legalRiskSignals: Array<{ title: string; detail: string }>;
  topCases: CaseSummary[];
  recentCases: CaseSummary[];
  casesByPlatform: Record<string, number>;
  totalCasesInRange: number;
}

interface DateRange {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

export function useChatContext(dateRange?: DateRange): ChatContextPayload {
  const { infringements, takedownRequests, scanEvents } = useDashboard();

  // Default to last 30 days if no range provided
  const globalDateRange = useMemo<DateRange>(() => {
    if (dateRange) return dateRange;
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(end.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return { key: '30d', label: 'Last 30 Days', start, end };
  }, [dateRange]);

  const rangeBounds = useMemo(() => {
    const startStr = globalDateRange.start.toISOString().split('T')[0];
    const endStr = globalDateRange.end.toISOString().split('T')[0];
    const startMs = globalDateRange.start.getTime();
    const endMs = globalDateRange.end.getTime();
    return { startStr, endStr, startMs, endMs };
  }, [globalDateRange]);

  const infringementsInRange = useMemo(() => {
    return infringements.filter((item) => {
      return item.detectedAt >= rangeBounds.startStr && item.detectedAt <= rangeBounds.endStr;
    });
  }, [infringements, rangeBounds]);

  const caseUpdatesByCase = useMemo(() => {
    return new Map(takedownRequests.map((request) => [request.caseId, request.updates || []] as const));
  }, [takedownRequests]);

  const protectedItems = useMemo(
    () => infringements.filter(i => isResolvedCaseStatus(i.status)),
    [infringements]
  );

  const pendingItems = useMemo(
    () => infringements.filter(i => isActiveCaseStatus(i.status)),
    [infringements]
  );

  const filteredProtected = useMemo(() => {
    return protectedItems.filter(i => i.detectedAt >= rangeBounds.startStr && i.detectedAt <= rangeBounds.endStr);
  }, [protectedItems, rangeBounds]);

  const filteredPending = useMemo(() => {
    return pendingItems.filter(i => i.detectedAt >= rangeBounds.startStr && i.detectedAt <= rangeBounds.endStr);
  }, [pendingItems, rangeBounds]);

  const revenueProtected = useMemo(() => filteredProtected.reduce((acc, curr) => acc + curr.revenueLost, 0), [filteredProtected]);
  const potentialLoss = useMemo(() => filteredPending.reduce((acc, curr) => acc + curr.revenueLost, 0), [filteredPending]);
  const activeInfringements = filteredPending.length;

  // Platform risk
  const platformRiskData = useMemo(() => {
    const totalLost = infringementsInRange.reduce((acc, curr) => acc + curr.revenueLost, 0);
    const byPlatform: Record<string, number> = {};

    infringementsInRange.forEach(item => {
      byPlatform[item.platform] = (byPlatform[item.platform] || 0) + item.revenueLost;
    });

    return Object.entries(byPlatform)
      .map(([platform, value]) => ({
        category: platform,
        value,
        percentage: totalLost > 0 ? Math.round((value / totalLost) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [infringementsInRange]);

  // Country data
  const violationMapData = useMemo(() => {
    const byCountry: Record<string, number> = {};
    infringementsInRange.forEach(item => {
      byCountry[item.country] = (byCountry[item.country] || 0) + 1;
    });
    return Object.entries(byCountry).map(([country, value]) => ({ country, value }));
  }, [infringementsInRange]);

  const topPlatform = useMemo(() => platformRiskData[0] || null, [platformRiskData]);
  const topCountry = useMemo(() => {
    if (violationMapData.length === 0) return null;
    return [...violationMapData].sort((a, b) => b.value - a.value)[0];
  }, [violationMapData]);

  // Detection quality
  const detectionQuality = useMemo(() => {
    const reviewedCases = infringementsInRange.filter((item) =>
      item.status === 'in_progress' || item.status === 'resolved' || item.status === 'rejected'
    );

    let falsePositiveCount = 0;

    reviewedCases.forEach((item) => {
      const updates = caseUpdatesByCase.get(item.id) || [];
      const isFalsePositive = item.status === 'rejected' && updates.some((update) =>
        update.type === 'custom' && /company dismissed case|company whitelisted trusted entity/i.test(update.message)
      );
      if (isFalsePositive) falsePositiveCount += 1;
    });

    const scanEventsInRange = scanEvents.filter((event) => {
      const startedMs = Date.parse(event.startedAt);
      return Number.isFinite(startedMs) && startedMs >= rangeBounds.startMs && startedMs <= rangeBounds.endMs;
    });
    const duplicatesSkipped = scanEventsInRange.reduce((sum, event) => sum + event.duplicatesSkipped, 0);
    const duplicateDenominator = scanEventsInRange.reduce(
      (sum, event) => sum + event.matchesFound + event.duplicatesSkipped,
      0
    );

    const reviewedCount = reviewedCases.length;
    const precision = reviewedCount > 0 ? (reviewedCount - falsePositiveCount) / reviewedCount : 1;
    const falsePositiveRate = reviewedCount > 0 ? falsePositiveCount / reviewedCount : 0;
    const duplicateRate = duplicateDenominator > 0 ? duplicatesSkipped / duplicateDenominator : 0;

    return { precision, falsePositiveRate, duplicateRate, reviewedCount };
  }, [infringementsInRange, caseUpdatesByCase, scanEvents, rangeBounds]);

  // Enforcement quality
  const enforcementQuality = useMemo(() => {
    const candidateCases = infringementsInRange.filter((item) =>
      item.status === 'in_progress' || item.status === 'resolved' || item.status === 'rejected'
    );
    const enforcedCases = candidateCases.filter((item) => {
      const updates = caseUpdatesByCase.get(item.id) || [];
      return updates.some((update) =>
        update.type === 'custom' && /company approved enforcement|enforcement handoff package prepared/i.test(update.message)
      ) || item.status === 'in_progress';
    });

    const closedCases = enforcedCases.filter((item) => item.status === 'resolved' || item.status === 'rejected');
    const resolvedCount = closedCases.filter((item) => item.status === 'resolved').length;
    const appealCount = enforcedCases.filter((item) => {
      const updates = caseUpdatesByCase.get(item.id) || [];
      return updates.some((update) =>
        update.type === 'escalated' && /counter[- ]notice|appeal|legal challenge/i.test(update.message)
      );
    }).length;

    const successRate = closedCases.length > 0 ? resolvedCount / closedCases.length : 0;
    const appealRate = enforcedCases.length > 0 ? appealCount / enforcedCases.length : 0;

    return { successRate, appealRate, enforcedCount: enforcedCases.length };
  }, [infringementsInRange, caseUpdatesByCase]);

  // Recurrence analytics
  const recurrenceAnalytics = useMemo(() => {
    const relistingEvents = takedownRequests.reduce((count, request) => {
      const updates = request.updates || [];
      return count + updates.filter((update) =>
        update.type === 'custom' && /relisting detected|re-list/i.test(update.message)
      ).length;
    }, 0);

    const relistingRate = infringementsInRange.length > 0 ? relistingEvents / infringementsInRange.length : 0;

    return { relistingEvents, relistingRate };
  }, [takedownRequests, infringementsInRange]);

  // Legal risk signals
  const legalRiskSignals = useMemo(() => {
    const signals: Array<{ severity: 'critical' | 'warning'; title: string; detail: string }> = [];

    const counterNoticeCases = takedownRequests.filter((request) =>
      (request.updates || []).some((update) =>
        update.type === 'escalated' && /counter[- ]notice|appeal|legal challenge/i.test(update.message)
      )
    );
    if (counterNoticeCases.length > 0) {
      signals.push({
        severity: 'critical',
        title: 'Counter-notice escalation',
        detail: `${counterNoticeCases.length} case(s) require immediate lawyer review.`,
      });
    }

    if (detectionQuality.reviewedCount >= 10 && detectionQuality.precision < 0.9) {
      signals.push({
        severity: 'critical',
        title: 'Precision below legal gate',
        detail: `Current precision is ${(detectionQuality.precision * 100).toFixed(1)}%, below the 90% safety gate.`,
      });
    }

    if (detectionQuality.duplicateRate > 0.05) {
      signals.push({
        severity: 'warning',
        title: 'Duplicate pressure elevated',
        detail: `Duplicate skip rate is ${(detectionQuality.duplicateRate * 100).toFixed(1)}% in this window.`,
      });
    }

    if (enforcementQuality.enforcedCount >= 5 && enforcementQuality.appealRate > 0.2) {
      signals.push({
        severity: 'warning',
        title: 'Appeal rate elevated',
        detail: `Appeals/counter-notices are ${(enforcementQuality.appealRate * 100).toFixed(1)}% of enforced cases.`,
      });
    }

    return signals;
  }, [takedownRequests, detectionQuality, enforcementQuality]);

  // Case summaries with priority scoring
  // Priority: revenue (40pts) + similarity (30pts) + status (20pts) + recency (10pts)
  const caseSummaries = useMemo(() => {
    const now = Date.now();
    const maxRevenue = Math.max(...infringementsInRange.map(i => i.revenueLost), 1);
    const rangeMs = rangeBounds.endMs - rangeBounds.startMs || 1;

    return infringementsInRange.map((item): CaseSummary & { score: number } => {
      // Revenue score (0-40): normalized by max revenue in range
      const revenueScore = (item.revenueLost / maxRevenue) * 40;

      // Similarity score (0-30): direct from similarityScore (0-100 scaled to 0-30)
      const similarityScoreVal = (item.similarityScore / 100) * 30;

      // Status score (0-20): active statuses score higher
      const statusScores: Record<string, number> = {
        detected: 20,
        pending_review: 18,
        in_progress: 15,
        resolved: 5,
        rejected: 0,
      };
      const statusScore = statusScores[item.status] ?? 10;

      // Recency score (0-10): newer cases score higher
      const detectedMs = Date.parse(item.detectedAt);
      const age = now - detectedMs;
      const recencyScore = Math.max(0, 10 * (1 - age / rangeMs));

      const totalScore = revenueScore + similarityScoreVal + statusScore + recencyScore;

      // Determine priority label
      let priority: CaseSummary['priority'];
      if (totalScore >= 70) priority = 'critical';
      else if (totalScore >= 50) priority = 'high';
      else if (totalScore >= 30) priority = 'medium';
      else priority = 'low';

      return {
        id: item.id,
        sellerName: item.sellerName || null,
        platform: item.platform,
        country: item.country,
        similarityScore: item.similarityScore,
        revenueAtRisk: item.revenueLost,
        status: item.status,
        detectedAt: item.detectedAt,
        priority,
        score: totalScore,
      };
    });
  }, [infringementsInRange, rangeBounds]);

  // Top 15 cases by priority score
  const topCases = useMemo(() => {
    return [...caseSummaries]
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(({ score: _score, ...rest }) => rest);
  }, [caseSummaries]);

  // 5 most recent cases
  const recentCases = useMemo(() => {
    return [...caseSummaries]
      .sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt))
      .slice(0, 5)
      .map(({ score: _score, ...rest }) => rest);
  }, [caseSummaries]);

  // Cases by platform
  const casesByPlatform = useMemo(() => {
    const counts: Record<string, number> = {};
    infringementsInRange.forEach(item => {
      counts[item.platform] = (counts[item.platform] || 0) + 1;
    });
    return counts;
  }, [infringementsInRange]);

  const totalCasesInRange = infringementsInRange.length;

  return useMemo<ChatContextPayload>(() => ({
    dateRangeLabel: globalDateRange.label,
    activeThreats: activeInfringements,
    potentialLossUsd: potentialLoss,
    revenueProtectedUsd: revenueProtected,
    detectionPrecisionPct: Number((detectionQuality.precision * 100).toFixed(1)),
    falsePositiveRatePct: Number((detectionQuality.falsePositiveRate * 100).toFixed(1)),
    duplicateRatePct: Number((detectionQuality.duplicateRate * 100).toFixed(1)),
    enforcementSuccessRatePct: Number((enforcementQuality.successRate * 100).toFixed(1)),
    enforcementAppealRatePct: Number((enforcementQuality.appealRate * 100).toFixed(1)),
    relistRatePct: Number((recurrenceAnalytics.relistingRate * 100).toFixed(1)),
    topRiskPlatform: topPlatform?.category || null,
    topRiskPlatformSharePct: topPlatform?.percentage ?? null,
    topCountry: topCountry?.country || null,
    topCountryViolations: topCountry?.value ?? null,
    legalRiskSignals: legalRiskSignals.slice(0, 3).map((signal) => ({
      title: signal.title,
      detail: signal.detail,
    })),
    topCases,
    recentCases,
    casesByPlatform,
    totalCasesInRange,
  }), [
    globalDateRange.label,
    activeInfringements,
    potentialLoss,
    revenueProtected,
    detectionQuality,
    enforcementQuality,
    recurrenceAnalytics.relistingRate,
    topPlatform,
    topCountry,
    legalRiskSignals,
    topCases,
    recentCases,
    casesByPlatform,
    totalCasesInRange,
  ]);
}
