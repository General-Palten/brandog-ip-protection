import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import BentoCard from '../ui/BentoCard';
import { MoreHorizontal, ChevronDown, ShieldCheck, AlertTriangle, TrendingUp, TrendingDown, Calendar, ChevronRight, Globe } from 'lucide-react';
import { PLATFORM_CONFIG } from '../../constants';
import { InfringementItem, TakedownRequest } from '../../types';
import { isActiveCaseStatus, isResolvedCaseStatus } from '../../lib/case-status';
import WorldMap, { getCountryName } from '../WorldMap';
import CountryViolationsPanel from '../CountryViolationsPanel';
import CaseDetailModal from '../CaseDetailModal';

interface DateRange {
    key: string;
    label: string;
    start: Date;
    end: Date;
}


const PRESETS = [
    { label: 'Last 7 Days', key: '7d', days: 7 },
    { label: 'Last 30 Days', key: '30d', days: 30 },
    { label: 'Last 90 Days', key: '90d', days: 90 },
    { label: 'Year to Date', key: 'ytd', days: 0 },
    { label: 'Last Year', key: '1y', days: 365 },
];


const DateRangeSelector = ({ 
    selected, 
    onSelect 
}: { 
    selected: DateRange, 
    onSelect: (r: DateRange) => void 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync custom inputs when opening if custom key is active
    useEffect(() => {
        if (isOpen && selected.key === 'custom') {
            setCustomStart(selected.start.toISOString().split('T')[0]);
            setCustomEnd(selected.end.toISOString().split('T')[0]);
        }
    }, [isOpen, selected]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handlePreset = (preset: typeof PRESETS[0]) => {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        
        if (preset.key === 'ytd') {
            start.setMonth(0, 1);
        } else {
            // Adjust start date based on preset
            start.setDate(end.getDate() - preset.days);
        }

        onSelect({
            key: preset.key,
            label: preset.label,
            start,
            end
        });
        setIsOpen(false);
    };

    const handleCustomApply = () => {
        if (!customStart || !customEnd) return;
        
        const start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
        const end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
        
        // Basic validation
        if (start > end) return;

        onSelect({
            key: 'custom',
            label: `${start.toLocaleDateString(undefined, {month:'short', day:'numeric'})} - ${end.toLocaleDateString(undefined, {month:'short', day:'numeric'})}`,
            start,
            end
        });
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-background border border-border px-3 py-1.5 text-xs uppercase tracking-wide text-secondary hover:text-primary hover:border-secondary transition-colors font-mono rounded-lg group"
            >
                <Calendar size={14} className="text-secondary group-hover:text-primary transition-colors" />
                <span className="truncate max-w-[120px] text-left">{selected.label}</span>
                <ChevronDown size={12} />
            </button>
            
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-background border border-border shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200 flex flex-col rounded-xl">
                    <div className="p-2 grid grid-cols-2 gap-1">
                        {PRESETS.map(preset => (
                            <button
                                key={preset.key}
                                onClick={() => handlePreset(preset)}
                                className={`px-3 py-2 text-xs text-left hover:bg-surface transition-colors rounded-lg ${selected.key === preset.key ? 'text-primary font-medium bg-surface' : 'text-secondary'}`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    
                    <div className="border-t border-border p-3 space-y-3 bg-surface/30">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-secondary">Custom Range</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" 
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-primary focus:border-primary outline-none"
                            />
                            <span className="text-secondary">-</span>
                            <input 
                                type="date" 
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-primary focus:border-primary outline-none"
                            />
                        </div>
                        <button 
                            onClick={handleCustomApply}
                            className="w-full bg-primary text-inverse py-1.5 text-xs font-medium hover:opacity-90 transition-opacity rounded-lg"
                        >
                            Apply Custom Range
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-surface border border-border p-2 shadow-xl z-50 min-w-[100px]">
        <p className="text-[10px] text-secondary uppercase tracking-wider mb-1">{data.date}</p>
        <div className="flex items-center gap-1">
           <span className="text-xs font-medium text-primary font-mono">
              ${data.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
           </span>
        </div>
      </div>
    );
  }
  return null;
};

const DashboardAnalytics: React.FC = () => {
  const { infringements, takedownRequests, scanEvents, reportInfringement, dismissInfringement } = useDashboard();
  
  // Global Date Range - Default to Last 30 Days (Normalized)
  const [globalDateRange, setGlobalDateRange] = useState<DateRange>(() => {
     const end = new Date();
     end.setHours(23, 59, 59, 999);
     const start = new Date();
     start.setDate(end.getDate() - 30);
     start.setHours(0, 0, 0, 0);
     return { key: '30d', label: 'Last 30 Days', start, end };
  });

  const [revenueData, setRevenueData] = useState<{i: number, value: number, date: string}[]>([]);
  const [lossData, setLossData] = useState<{i: number, value: number, date: string}[]>([]);
  

  // Country Panel State
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCountryViolations, setSelectedCountryViolations] = useState<InfringementItem[]>([]);
  const [isCountryPanelOpen, setIsCountryPanelOpen] = useState(false);

  // Case Detail Modal State
  const [selectedItem, setSelectedItem] = useState<InfringementItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // --- Aggregate Data Based on Range ---

  // Filters from canonical lifecycle statuses
  const protectedItems = useMemo(
    () => infringements.filter(i => isResolvedCaseStatus(i.status)),
    [infringements]
  );

  const pendingItems = useMemo(
    () => infringements.filter(i => isActiveCaseStatus(i.status)),
    [infringements]
  );

  // Aggregate Big Numbers based on ALL available data relevant to the metric, filtered by range if needed
  // Use String Comparison for dates to avoid timezone mismatches with generated data
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

  const filteredProtected = useMemo(() => {
      return protectedItems.filter(i => i.detectedAt >= rangeBounds.startStr && i.detectedAt <= rangeBounds.endStr);
  }, [protectedItems, rangeBounds]);

  const filteredPending = useMemo(() => {
      return pendingItems.filter(i => i.detectedAt >= rangeBounds.startStr && i.detectedAt <= rangeBounds.endStr);
  }, [pendingItems, rangeBounds]);

  const revenueProtected = useMemo(() => filteredProtected.reduce((acc, curr) => acc + curr.revenueLost, 0), [filteredProtected]);
  const potentialLoss = useMemo(() => filteredPending.reduce((acc, curr) => acc + curr.revenueLost, 0), [filteredPending]);
  const activeInfringements = filteredPending.length;

  // Calculate Similarity Score Distribution for Pending items (Histogram)
  const similarityData = useMemo(() => {
     // Buckets for similarity score distribution
     const buckets = [
         { label: '90+', min: 90, count: 0, color: 'bg-[#ef4444]' }, // Solid Red
         { label: '80+', min: 80, count: 0, color: 'bg-[#f97316]' }, // Solid Orange
         { label: '70+', min: 70, count: 0, color: 'bg-[#f59e0b]' }, // Solid Amber
         { label: '60+', min: 60, count: 0, color: 'bg-[#eab308]' }, // Solid Yellow
         { label: '<60', min: 0, count: 0, color: 'bg-[#52525b]' },  // Solid Zinc
     ];

     filteredPending.forEach(item => {
         const bucket = buckets.find(b => item.similarityScore >= b.min);
         if (bucket) bucket.count++;
     });

     const max = Math.max(...buckets.map(b => b.count), 1);
     
     return buckets.map(b => ({
         ...b,
         heightPercent: (b.count / max) * 100
     }));
  }, [filteredPending]);

  // Aggregate Platform Risk from Actual Data (Detected in range)
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
            color: PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.color === 'blue' ? '#ffffff' : 
                   PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.color === 'pink' ? '#E1306C' :
                   PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.color === 'green' ? '#96bf48' :
                   PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.color === 'black' ? '#ffffff' :
                   PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.color === 'orange' ? '#FF9900' :
                   PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.color === 'red' ? '#FF4747' : '#71717a'
        }))
        .sort((a, b) => b.value - a.value);

  }, [infringementsInRange]);

  // Aggregate Map Data (Detected in range)
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

  const detectionQuality = useMemo(() => {
    const isReviewedStatus = (status: string) =>
      status === 'in_progress' || status === 'resolved_success' || status === 'resolved_partial' || status === 'resolved_failed' || status === 'dismissed_by_admin' || status === 'dismissed_by_member';
    const isDismissedStatus = (status: string) =>
      status === 'dismissed_by_admin' || status === 'dismissed_by_member';

    const reviewedCases = infringementsInRange.filter((item) => isReviewedStatus(item.status));

    let falsePositiveCount = 0;
    const providerStats: Record<string, { reviewed: number; falsePositives: number }> = {};
    const platformStats: Record<string, { reviewed: number; falsePositives: number }> = {};

    reviewedCases.forEach((item) => {
      const updates = caseUpdatesByCase.get(item.id) || [];
      const isFalsePositive = isDismissedStatus(item.status) && updates.some((update) =>
        update.type === 'custom' && /company dismissed case|company whitelisted trusted entity/i.test(update.message)
      );

      if (isFalsePositive) falsePositiveCount += 1;

      const providerKey = (item.detectionProvider || 'unknown').toLowerCase();
      const providerBucket = providerStats[providerKey] || { reviewed: 0, falsePositives: 0 };
      providerBucket.reviewed += 1;
      if (isFalsePositive) providerBucket.falsePositives += 1;
      providerStats[providerKey] = providerBucket;

      const platformBucket = platformStats[item.platform] || { reviewed: 0, falsePositives: 0 };
      platformBucket.reviewed += 1;
      if (isFalsePositive) platformBucket.falsePositives += 1;
      platformStats[item.platform] = platformBucket;
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

    const providerBreakdown = Object.entries(providerStats)
      .map(([provider, stats]) => ({
        provider,
        precision: stats.reviewed > 0 ? (stats.reviewed - stats.falsePositives) / stats.reviewed : 1,
        reviewed: stats.reviewed,
      }))
      .sort((a, b) => b.reviewed - a.reviewed);

    const platformBreakdown = Object.entries(platformStats)
      .map(([platform, stats]) => ({
        platform,
        precision: stats.reviewed > 0 ? (stats.reviewed - stats.falsePositives) / stats.reviewed : 1,
        reviewed: stats.reviewed,
      }))
      .sort((a, b) => b.reviewed - a.reviewed);

    return {
      reviewedCount,
      precision,
      falsePositiveRate,
      duplicateRate,
      providerBreakdown,
      platformBreakdown,
      scanEventCount: scanEventsInRange.length,
    };
  }, [infringementsInRange, caseUpdatesByCase, scanEvents, rangeBounds]);

  const enforcementQuality = useMemo(() => {
    const isReviewedStatus = (status: string) =>
      status === 'in_progress' || status === 'resolved_success' || status === 'resolved_partial' || status === 'resolved_failed' || status === 'dismissed_by_admin' || status === 'dismissed_by_member';
    const isClosedStatus = (status: string) =>
      status === 'resolved_success' || status === 'resolved_partial' || status === 'resolved_failed' || status === 'dismissed_by_admin' || status === 'dismissed_by_member';
    const isResolvedStatus = (status: string) =>
      status === 'resolved_success' || status === 'resolved_partial' || status === 'resolved_failed';
    const isDismissedStatus = (status: string) =>
      status === 'dismissed_by_admin' || status === 'dismissed_by_member';

    const candidateCases = infringementsInRange.filter((item) => isReviewedStatus(item.status));
    const enforcedCases = candidateCases.filter((item) => {
      const updates = caseUpdatesByCase.get(item.id) || [];
      return updates.some((update) =>
        update.type === 'custom' && /company approved enforcement|enforcement handoff package prepared/i.test(update.message)
      ) || item.status === 'in_progress';
    });

    const closedCases = enforcedCases.filter((item) => isClosedStatus(item.status));
    const resolvedCount = closedCases.filter((item) => isResolvedStatus(item.status)).length;
    const rejectedCount = closedCases.filter((item) => isDismissedStatus(item.status)).length;
    const appealCount = enforcedCases.filter((item) => {
      const updates = caseUpdatesByCase.get(item.id) || [];
      return updates.some((update) =>
        update.type === 'escalated' && /counter[- ]notice|appeal|legal challenge/i.test(update.message)
      );
    }).length;

    const durationsHours = closedCases
      .map((item) => takedownRequests.find((request) => request.caseId === item.id))
      .filter((request): request is TakedownRequest => Boolean(request))
      .map((request) => {
        const start = Date.parse(request.requestedAt || '');
        const end = Date.parse(request.processedAt || '');
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
        return (end - start) / (1000 * 60 * 60);
      })
      .filter((value): value is number => value !== null);

    const averageResolutionHours = durationsHours.length > 0
      ? durationsHours.reduce((sum, value) => sum + value, 0) / durationsHours.length
      : 0;

    const byPlatform: Record<string, { closed: number; resolved: number }> = {};
    closedCases.forEach((item) => {
      const bucket = byPlatform[item.platform] || { closed: 0, resolved: 0 };
      bucket.closed += 1;
      if (isResolvedStatus(item.status)) bucket.resolved += 1;
      byPlatform[item.platform] = bucket;
    });

    return {
      enforcedCount: enforcedCases.length,
      closedCount: closedCases.length,
      successRate: closedCases.length > 0 ? resolvedCount / closedCases.length : 0,
      rejectionRate: closedCases.length > 0 ? rejectedCount / closedCases.length : 0,
      appealRate: enforcedCases.length > 0 ? appealCount / enforcedCases.length : 0,
      averageResolutionHours,
      platformSuccess: Object.entries(byPlatform)
        .map(([platform, stats]) => ({
          platform,
          successRate: stats.closed > 0 ? stats.resolved / stats.closed : 0,
          closed: stats.closed,
        }))
        .sort((a, b) => b.closed - a.closed),
    };
  }, [infringementsInRange, caseUpdatesByCase, takedownRequests]);

  const qualityRegressions = useMemo(() => {
    const isReviewedStatus = (status: string) =>
      status === 'in_progress' || status === 'resolved_success' || status === 'resolved_partial' || status === 'resolved_failed' || status === 'dismissed_by_admin' || status === 'dismissed_by_member';
    const isClosedStatus = (status: string) =>
      status === 'resolved_success' || status === 'resolved_partial' || status === 'resolved_failed' || status === 'dismissed_by_admin' || status === 'dismissed_by_member';
    const isResolvedStatus = (status: string) =>
      status === 'resolved_success' || status === 'resolved_partial' || status === 'resolved_failed';
    const isDismissedStatus = (status: string) =>
      status === 'dismissed_by_admin' || status === 'dismissed_by_member';

    const currentWindowMs = Math.max(24 * 60 * 60 * 1000, rangeBounds.endMs - rangeBounds.startMs);
    const previousEnd = rangeBounds.startMs - 1;
    const previousStart = previousEnd - currentWindowMs;
    const previousStartStr = new Date(previousStart).toISOString().split('T')[0];
    const previousEndStr = new Date(previousEnd).toISOString().split('T')[0];

    const previousCases = infringements.filter((item) =>
      item.detectedAt >= previousStartStr && item.detectedAt <= previousEndStr
    );

    const previousReviewed = previousCases.filter((item) => isReviewedStatus(item.status));
    const previousFalsePositives = previousReviewed.filter((item) => {
      if (!isDismissedStatus(item.status)) return false;
      const updates = caseUpdatesByCase.get(item.id) || [];
      return updates.some((update) =>
        update.type === 'custom' && /company dismissed case|company whitelisted trusted entity/i.test(update.message)
      );
    }).length;

    const previousPrecision = previousReviewed.length > 0
      ? (previousReviewed.length - previousFalsePositives) / previousReviewed.length
      : detectionQuality.precision;

    const previousClosed = previousCases.filter((item) => isClosedStatus(item.status));
    const previousResolved = previousClosed.filter((item) => isResolvedStatus(item.status)).length;
    const previousSuccessRate = previousClosed.length > 0
      ? previousResolved / previousClosed.length
      : enforcementQuality.successRate;

    return {
      precisionDelta: detectionQuality.precision - previousPrecision,
      successDelta: enforcementQuality.successRate - previousSuccessRate,
    };
  }, [
    rangeBounds,
    infringements,
    caseUpdatesByCase,
    detectionQuality.precision,
    enforcementQuality.successRate,
  ]);

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

  const recurrenceAnalytics = useMemo(() => {
    const relistingEvents = takedownRequests.reduce((count, request) => {
      const updates = request.updates || [];
      return count + updates.filter((update) =>
        update.type === 'custom' && /relisting detected|re-list/i.test(update.message)
      ).length;
    }, 0);

    const cohortMap = new Map<string, number>();
    infringementsInRange.forEach((item) => {
      const sellerKey = (item.sellerName || '').trim().toLowerCase();
      const domainKey = (() => {
        if (!item.infringingUrl) return '';
        try {
          return new URL(item.infringingUrl).hostname.toLowerCase();
        } catch {
          return '';
        }
      })();
      const cohortKey = sellerKey || domainKey;
      if (!cohortKey) return;
      cohortMap.set(cohortKey, (cohortMap.get(cohortKey) || 0) + 1);
    });

    const repeatCohorts = [...cohortMap.entries()]
      .filter(([, count]) => count > 1)
      .map(([cohort, count]) => ({ cohort, count }))
      .sort((a, b) => b.count - a.count);

    return {
      relistingEvents,
      relistingRate: infringementsInRange.length > 0 ? relistingEvents / infringementsInRange.length : 0,
      repeatCohorts,
    };
  }, [takedownRequests, infringementsInRange]);


  // Helper to generate chart data
  useEffect(() => {
    const aggregateForChart = (items: InfringementItem[]) => {
        const dataMap = new Map<string, number>();
        const days = Math.ceil((globalDateRange.end.getTime() - globalDateRange.start.getTime()) / (1000 * 60 * 60 * 24));
        
        // Initialize timeline with ALL days in range
        for(let i = 0; i <= days; i++) {
            const d = new Date(globalDateRange.start);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            dataMap.set(dateStr, 0);
        }

        // Fill data from items
        items.forEach(item => {
            // Only add if it falls within the initialized keys (should be guaranteed by filtering)
            if (dataMap.has(item.detectedAt)) {
                dataMap.set(item.detectedAt, (dataMap.get(item.detectedAt) || 0) + item.revenueLost);
            }
        });

        return Array.from(dataMap.entries()).map(([date, value], i) => ({
            i,
            date: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            value
        }));
    };

    setRevenueData(aggregateForChart(filteredProtected));
    setLossData(aggregateForChart(filteredPending));

  }, [filteredProtected, filteredPending, globalDateRange]);


  // --- Calendar Logic ---
  const currentMonthCalendar = useMemo(() => {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const startDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun, 1 = Mon
      
      const calendarDays = [];
      
      // Previous month filler
      const prevMonthDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
      const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
      for(let i = prevMonthDays - 1; i >= 0; i--) {
          calendarDays.push({ day: prevMonthLastDay - i, month: 'prev', activity: 0 });
      }
      
      // Current month
      for(let i = 1; i <= daysInMonth; i++) {
          const dateStr = new Date(currentYear, currentMonth, i).toISOString().split('T')[0];
          const count = infringements.filter(item => item.detectedAt === dateStr).length;
          
          let activity = 0;
          if (count > 0) activity = 1;
          if (count > 2) activity = 2;
          if (count > 5) activity = 3;

          calendarDays.push({ 
              day: i, 
              month: 'curr', 
              activity, 
              selected: i === now.getDate() 
          });
      }
      
      // Next month filler
      const remainingSlots = 42 - calendarDays.length; // 6 rows
      for(let i = 1; i <= remainingSlots; i++) {
          calendarDays.push({ day: i, month: 'next', activity: 0 });
      }
      
      return calendarDays;
  }, [infringements]);


  const getComparisonText = (rangeKey: string) => {
      switch(rangeKey) {
          case '24h': return 'vs yesterday';
          case '7d': return 'vs last week';
          case '30d': return 'vs last month';
          case '90d': return 'vs last quarter';
          case 'ytd': return 'vs prev year';
          case '1y': return 'vs last year';
          default: return 'vs prev period';
      }
  };

  // Country Selection Handlers
  const handleCountrySelect = useCallback((countryCode: string, violations: InfringementItem[]) => {
    setSelectedCountry(countryCode);
    setSelectedCountryViolations(violations);
    setIsCountryPanelOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setIsCountryPanelOpen(false);
    setTimeout(() => setSelectedCountry(null), 200);
  }, []);

  const openDetail = useCallback((item: InfringementItem) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-end justify-between">
         <div>
            <h1 className="font-serif text-3xl md:text-4xl text-primary font-medium tracking-tight">Morning Viktor</h1>
            <p className="text-secondary mt-2 text-sm">Here is a quick look at your current protection operations.</p>
         </div>
         <div className="flex items-center gap-2">
            <DateRangeSelector selected={globalDateRange} onSelect={setGlobalDateRange} />
            <button className="p-2 border border-border rounded-lg text-secondary hover:text-primary hover:bg-surface transition-colors bg-background">
                <MoreHorizontal size={16} />
            </button>
         </div>
      </div>

      {/* Bento Grid - 3 Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
         
         {/* Card 1: Revenue Protected (1/3) */}
         <BentoCard 
            title={
                <div className="flex items-center gap-2 text-secondary">
                    <ShieldCheck size={16} className="text-emerald-500" />
                    <span>Revenue Protected</span>
                </div>
            }
            className="md:col-span-1"
         >
            <div className="flex flex-col h-full justify-between">
               <div className="mt-0">
                  <div className="flex justify-between items-end">
                     <span className="text-2xl text-primary font-normal tracking-tight">${revenueProtected.toLocaleString()}</span>
                     <div className="flex flex-col items-end mb-1">
                          <span className="text-[10px] text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                             <TrendingUp size={10} /> +12%
                          </span>
                          <span className="text-[10px] text-secondary mt-1 lowercase">{getComparisonText(globalDateRange.key)}</span>
                      </div>
                  </div>
                  
                  <div className="h-[35px] min-h-[35px] min-w-0 w-full mt-1 -ml-1">
                     <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <AreaChart data={revenueData} onMouseMove={() => {}}>
                           <defs>
                              <linearGradient id="gradProtected" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="0%" stopColor="#10b981" stopOpacity={0.2}/>
                                 <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                           </defs>
                           <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--secondary)', strokeDasharray: '3 3', strokeWidth: 1 }} />
                           <Area 
                              type="monotone" 
                              dataKey="value" 
                              stroke="#10b981" 
                              strokeWidth={2} 
                              fill="url(#gradProtected)" 
                              isAnimationActive={true}
                              animationDuration={800}
                           />
                        </AreaChart>
                     </ResponsiveContainer>
                  </div>
               </div>
               <div className="mt-auto text-[10px] font-medium text-secondary hover:text-primary cursor-pointer transition-colors flex items-center gap-1 pt-2">
                   See Revenue Protected <ChevronRight size={10} />
               </div>
            </div>
         </BentoCard>

         {/* Card 2: Potential Loss (1/3) */}
         <BentoCard 
            title={
                <div className="flex items-center gap-2 text-secondary">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <span>Potential Loss</span>
                </div>
            }
            className="md:col-span-1"
         >
             <div className="flex flex-col h-full justify-between">
               <div className="mt-0">
                   <div className="flex justify-between items-end">
                       <span className="text-2xl text-primary font-normal tracking-tight">${potentialLoss.toLocaleString()}</span>
                       <div className="flex flex-col items-end mb-1">
                           <span className="text-[10px] text-amber-500 flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                               <TrendingDown size={10} /> +5%
                           </span>
                           <span className="text-[10px] text-secondary mt-1 lowercase">{getComparisonText(globalDateRange.key)}</span>
                       </div>
                   </div>

                    <div className="h-[35px] min-h-[35px] min-w-0 w-full mt-1 -ml-1">
                      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                         <AreaChart data={lossData} onMouseMove={() => {}}>
                            <defs>
                               <linearGradient id="gradLoss" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2}/>
                                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/>
                               </linearGradient>
                            </defs>
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--secondary)', strokeDasharray: '3 3', strokeWidth: 1 }} />
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke="#f59e0b" 
                                strokeWidth={2} 
                                fill="url(#gradLoss)" 
                                isAnimationActive={true}
                                animationDuration={800}
                            />
                         </AreaChart>
                      </ResponsiveContainer>
                   </div>
               </div>
               <div className="mt-auto text-[10px] font-medium text-secondary hover:text-primary cursor-pointer transition-colors flex items-center gap-1 pt-2">
                   See Potential Loss <ChevronRight size={10} />
               </div>
            </div>
         </BentoCard>

         {/* Card 3: Potential Infringements (1/3) */}
         <BentoCard title="Potential Infringements" className="md:col-span-1">
             <div className="flex flex-col h-full justify-between">
                 <div className="mt-0">
                    <div className="flex justify-between items-start">
                        <div>
                           <p className="text-xs text-secondary">Avg detection <span className="text-primary font-medium">4h</span>.</p>
                           <h2 className="text-2xl font-mono mt-1 text-primary">{activeInfringements}</h2>
                        </div>
                    </div>
                    
                    {/* Distribution Histogram */}
                    <div className="h-8 flex items-end gap-1 mt-2 pt-2 border-t border-border/50">
                       {similarityData.map((bin, i) => (
                          <div key={i} className="flex-1 h-full flex flex-col justify-end group relative">
                              {/* Tooltip */}
                              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-primary text-inverse text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-lg">
                                  {bin.count}
                              </div>
                              
                              {/* Bar */}
                              <div 
                                className={`w-full ${bin.color} rounded-sm relative min-h-[4px] transition-all duration-300 hover:brightness-110 hover:shadow-lg`} 
                                style={{ height: `${Math.max(bin.heightPercent, 4)}%` }}
                              >
                              </div>
                          </div>
                       ))}
                    </div>
                     <div className="flex justify-between mt-1 px-1">
                        {similarityData.map((bin, i) => (
                             <div key={i} className="text-[8px] text-secondary text-center font-mono w-full truncate">
                                  {bin.label}
                              </div>
                        ))}
                     </div>
                 </div>
                 <div className="mt-auto text-[10px] font-medium text-secondary hover:text-primary cursor-pointer transition-colors flex items-center gap-1 pt-2">
                     See All Infringements <ChevronRight size={10} />
                 </div>
             </div>
         </BentoCard>

         {/* Card 5: Global Violations Map (Left Column, 2-Row Span) */}
         <BentoCard 
            title="Global Violations" 
            className="md:col-span-2 row-span-2"
            action={
               <div className="flex items-center gap-2 text-xs text-secondary">
                  <Globe size={12} />
                  <span>Real-time Activity</span>
               </div>
            }
         >
            <div className="w-full h-full min-h-[250px] mt-2">
                <WorldMap
                  data={violationMapData}
                  infringements={infringementsInRange}
                  onCountrySelect={handleCountrySelect}
                  selectedCountry={selectedCountry || undefined}
                />
            </div>
         </BentoCard>

         {/* Card 6: Tracker (Right Column, Stacked) */}
         <BentoCard title="Tracker" className="md:col-span-1 p-0 overflow-hidden" action={
            <div className="flex items-center gap-1 text-xs text-secondary cursor-pointer hover:text-primary transition-colors border border-border px-2 py-1">
                <span>{new Date().toLocaleDateString(undefined, {month:'long'})}</span>
                <ChevronDown size={12} />
            </div>
         }>
            <div className="mt-2 border-t border-border">
                {/* Header */}
                <div className="grid grid-cols-7">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, dayIndex) => (
                        <div key={`${d}-${dayIndex}`} className="py-2 text-[10px] text-secondary font-mono text-center border-r border-b border-border last:border-r-0">
                            {d}
                        </div>
                    ))}
                </div>
                
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 bg-border gap-px border-b border-border">
                    {currentMonthCalendar.map((item, i) => {
                        const isWeekend = i % 7 === 5 || i % 7 === 6;
                        return (
                            <div 
                                key={i} 
                                className={`
                                    relative h-8 w-full flex flex-col justify-between p-1 transition-colors
                                    ${item.selected 
                                        ? 'bg-surface' 
                                        : isWeekend 
                                            ? 'bg-striped' 
                                            : item.month === 'curr' ? 'bg-background hover:bg-surface' : 'bg-background'
                                    }
                                `}
                            >
                                <span className={`font-mono text-[9px] ${item.selected ? 'text-primary font-bold' : 'text-secondary'} ${item.month !== 'curr' ? 'opacity-30' : ''}`}>
                                    {item.day}
                                </span>
                                
                                {item.activity > 0 && item.month === 'curr' && (
                                    <div className="flex gap-0.5 justify-center mt-1">
                                        <div className={`h-1 w-1 rounded-full ${item.selected ? 'bg-primary' : 'bg-secondary/50'}`}></div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
         </BentoCard>

         {/* Card 4: Platform Risk (Right Column, Stacked) */}
         <BentoCard title="Platform Risk" className="md:col-span-1">
            <div className="mt-2 flex flex-col gap-2 min-h-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border max-h-[140px]">
               {platformRiskData.map((item) => (
                  <div key={item.category} className="flex items-center justify-between text-xs group">
                     <div className="flex items-center gap-3 w-28 shrink-0">
                        <div className="w-2 h-2 rounded-lg" style={{ backgroundColor: item.color }}></div>
                        <span className="text-secondary group-hover:text-primary transition-colors truncate">{item.category}</span>
                     </div>
                     <div className="flex-1 h-1 bg-surface rounded-lg mx-2 overflow-hidden">
                         <div className="h-full rounded-lg" style={{ width: `${item.percentage}%`, backgroundColor: 'rgb(var(--primary))' }}></div>
                     </div>
                     <span className="text-secondary font-mono w-6 text-right">{item.percentage}%</span>
                  </div>
               ))}
            </div>
         </BentoCard>

         <BentoCard title="Detection Quality" className="md:col-span-1">
            <div className="space-y-3 mt-1">
               <div className="grid grid-cols-3 gap-2">
                  <div className="border border-border rounded p-2 bg-surface/40">
                     <p className="text-[10px] uppercase tracking-wider text-secondary">Precision</p>
                     <p className="text-sm font-mono text-primary mt-1">{(detectionQuality.precision * 100).toFixed(1)}%</p>
                  </div>
                  <div className="border border-border rounded p-2 bg-surface/40">
                     <p className="text-[10px] uppercase tracking-wider text-secondary">False+</p>
                     <p className="text-sm font-mono text-primary mt-1">{(detectionQuality.falsePositiveRate * 100).toFixed(1)}%</p>
                  </div>
                  <div className="border border-border rounded p-2 bg-surface/40">
                     <p className="text-[10px] uppercase tracking-wider text-secondary">Duplicate</p>
                     <p className="text-sm font-mono text-primary mt-1">{(detectionQuality.duplicateRate * 100).toFixed(1)}%</p>
                  </div>
               </div>
               <div className="pt-2 border-t border-border space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-secondary">Provider Segments</p>
                  {detectionQuality.providerBreakdown.slice(0, 3).map((segment) => (
                    <div key={segment.provider} className="flex items-center justify-between text-xs">
                      <span className="text-secondary truncate max-w-[60%]">{segment.provider}</span>
                      <span className="font-mono text-primary">{(segment.precision * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                  {detectionQuality.providerBreakdown.length === 0 && (
                    <p className="text-xs text-secondary">No provider-segmented reviewed cases in this window.</p>
                  )}
               </div>
               <div className="pt-2 border-t border-border space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-secondary">Platform Segments</p>
                  {detectionQuality.platformBreakdown.slice(0, 3).map((segment) => (
                    <div key={segment.platform} className="flex items-center justify-between text-xs">
                      <span className="text-secondary truncate max-w-[60%]">{segment.platform}</span>
                      <span className="font-mono text-primary">{(segment.precision * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                  {detectionQuality.platformBreakdown.length === 0 && (
                    <p className="text-xs text-secondary">No platform quality data in this window.</p>
                  )}
               </div>
            </div>
         </BentoCard>

         <BentoCard title="Enforcement Quality" className="md:col-span-1">
            <div className="space-y-3 mt-1">
               <div className="grid grid-cols-3 gap-2">
                  <div className="border border-border rounded p-2 bg-surface/40">
                     <p className="text-[10px] uppercase tracking-wider text-secondary">Success</p>
                     <p className="text-sm font-mono text-primary mt-1">{(enforcementQuality.successRate * 100).toFixed(1)}%</p>
                  </div>
                  <div className="border border-border rounded p-2 bg-surface/40">
                     <p className="text-[10px] uppercase tracking-wider text-secondary">Rejected</p>
                     <p className="text-sm font-mono text-primary mt-1">{(enforcementQuality.rejectionRate * 100).toFixed(1)}%</p>
                  </div>
                  <div className="border border-border rounded p-2 bg-surface/40">
                     <p className="text-[10px] uppercase tracking-wider text-secondary">Appeals</p>
                     <p className="text-sm font-mono text-primary mt-1">{(enforcementQuality.appealRate * 100).toFixed(1)}%</p>
                  </div>
               </div>
               <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                  <span className="text-secondary">Avg resolution time</span>
                  <span className="font-mono text-primary">{enforcementQuality.averageResolutionHours.toFixed(1)}h</span>
               </div>
               <div className="flex flex-wrap gap-2">
                  {qualityRegressions.precisionDelta <= -0.1 && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 border border-red-500/30 text-red-400 bg-red-500/10">
                      Precision regression
                    </span>
                  )}
                  {qualityRegressions.successDelta <= -0.1 && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 border border-amber-500/30 text-amber-400 bg-amber-500/10">
                      Enforcement regression
                    </span>
                  )}
                  {qualityRegressions.precisionDelta > -0.1 && qualityRegressions.successDelta > -0.1 && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 border border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                      Stable trends
                    </span>
                  )}
               </div>
               <div className="pt-2 border-t border-border space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-secondary">Platform Outcomes</p>
                  {enforcementQuality.platformSuccess.slice(0, 3).map((segment) => (
                    <div key={segment.platform} className="flex items-center justify-between text-xs">
                      <span className="text-secondary truncate max-w-[60%]">{segment.platform}</span>
                      <span className="font-mono text-primary">{(segment.successRate * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                  {enforcementQuality.platformSuccess.length === 0 && (
                    <p className="text-xs text-secondary">No closed enforcement outcomes in this window.</p>
                  )}
               </div>
            </div>
         </BentoCard>

         <BentoCard title="Legal Safety Gates" className="md:col-span-1">
            <div className="space-y-2 mt-1">
               <div className="text-[10px] uppercase tracking-wider text-secondary">
                  Runbook Routing: false-positive spike, appeal handling, policy/legal ambiguity
               </div>
               {legalRiskSignals.length === 0 && (
                 <div className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs rounded p-2">
                   No active legal-risk triggers in this period.
                 </div>
               )}
               {legalRiskSignals.map((signal, index) => (
                 <div
                   key={`${signal.title}-${index}`}
                   className={`border rounded p-2 text-xs ${
                     signal.severity === 'critical'
                       ? 'border-red-500/30 bg-red-500/10 text-red-300'
                       : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                   }`}
                 >
                   <p className="font-medium">{signal.title}</p>
                   <p className="mt-1">{signal.detail}</p>
                 </div>
               ))}
               <div className="pt-2 border-t border-border text-[10px] text-secondary">
                 Gate thresholds: precision at least 90%, duplicate at most 5%, appeal at most 20%.
               </div>
            </div>
         </BentoCard>

         <BentoCard title="Recurrence Loop" className="md:col-span-1">
            <div className="space-y-3 mt-1">
               <div className="grid grid-cols-2 gap-2">
                  <div className="border border-border rounded p-2 bg-surface/40">
                    <p className="text-[10px] uppercase tracking-wider text-secondary">Re-list Events</p>
                    <p className="text-sm font-mono text-primary mt-1">{recurrenceAnalytics.relistingEvents}</p>
                  </div>
                  <div className="border border-border rounded p-2 bg-surface/40">
                    <p className="text-[10px] uppercase tracking-wider text-secondary">Re-list Rate</p>
                    <p className="text-sm font-mono text-primary mt-1">{(recurrenceAnalytics.relistingRate * 100).toFixed(1)}%</p>
                  </div>
               </div>
               <div className="pt-2 border-t border-border space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-secondary">Repeat Offender Cohorts</p>
                  {recurrenceAnalytics.repeatCohorts.slice(0, 4).map((cohort) => (
                    <div key={cohort.cohort} className="flex items-center justify-between text-xs">
                      <span className="text-secondary truncate max-w-[70%]">{cohort.cohort}</span>
                      <span className="font-mono text-primary">{cohort.count}</span>
                    </div>
                  ))}
                  {recurrenceAnalytics.repeatCohorts.length === 0 && (
                    <p className="text-xs text-secondary">No repeat offender cohorts in this range.</p>
                  )}
               </div>
            </div>
         </BentoCard>

      </div>

      {/* Country Violations Panel */}
      <CountryViolationsPanel
        isOpen={isCountryPanelOpen}
        onClose={handleClosePanel}
        countryCode={selectedCountry || ''}
        countryName={selectedCountry ? getCountryName(selectedCountry) : ''}
        violations={selectedCountryViolations}
        onViolationClick={openDetail}
      />

      {/* Case Detail Modal */}
      {selectedItem && (
        <CaseDetailModal
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedItem(null);
          }}
          item={selectedItem}
          onConfirm={reportInfringement}
          onDismiss={(id) => dismissInfringement(id, 'other')}
        />
      )}
    </div>
  );
};

export default DashboardAnalytics;
