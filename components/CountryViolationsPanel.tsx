/**
 * CountryViolationsPanel Component
 *
 * Slide-out panel for displaying violations for a selected country.
 * Shows summary stats, violation list, and allows clicking items for details.
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, AlertCircle, Info, CheckCircle, Clock, XCircle, ExternalLink } from 'lucide-react';
import { InfringementItem } from '../types';
import { getCountryName, getCountryFlag } from './WorldMap';
import { PLATFORM_CONFIG } from '../constants';

export interface CountryViolationsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    countryCode: string;
    countryName: string;
    violations: InfringementItem[];
    onViolationClick: (item: InfringementItem) => void;
}

// Status badge colors
const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
    detected: {
        bg: 'bg-blue-500/20',
        text: 'text-blue-400',
        label: 'Detected',
    },
    pending_review: {
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
        label: 'Pending Review',
    },
    in_progress: {
        bg: 'bg-orange-500/20',
        text: 'text-orange-400',
        label: 'In Progress',
    },
    resolved: {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        label: 'Resolved',
    },
    rejected: {
        bg: 'bg-zinc-500/20',
        text: 'text-zinc-400',
        label: 'Rejected',
    },
};

// Get severity based on similarity score
function getSeverity(score: number): { level: string; bg: string; text: string } {
    if (score >= 90) return { level: 'Critical', bg: 'bg-red-500/20', text: 'text-red-400' };
    if (score >= 80) return { level: 'High', bg: 'bg-orange-500/20', text: 'text-orange-400' };
    if (score >= 70) return { level: 'Medium', bg: 'bg-amber-500/20', text: 'text-amber-400' };
    return { level: 'Low', bg: 'bg-blue-500/20', text: 'text-blue-400' };
}

const CountryViolationsPanel: React.FC<CountryViolationsPanelProps> = ({
    isOpen,
    onClose,
    countryCode,
    countryName,
    violations,
    onViolationClick,
}) => {
    // Handle escape key
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        },
        [onClose]
    );

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, handleKeyDown]);

    // Compute summary stats
    const stats = useMemo(() => {
        const byPlatform: Record<string, number> = {};
        const byStatus: Record<string, number> = {};
        let totalRevenueLost = 0;

        violations.forEach(v => {
            byPlatform[v.platform] = (byPlatform[v.platform] || 0) + 1;
            byStatus[v.status] = (byStatus[v.status] || 0) + 1;
            totalRevenueLost += v.revenueLost;
        });

        return { byPlatform, byStatus, totalRevenueLost };
    }, [violations]);

    // Sort violations by similarity score (highest first) then by date
    const sortedViolations = useMemo(() => {
        return [...violations].sort((a, b) => {
            // First by similarity score (descending)
            const scoreDiff = b.similarityScore - a.similarityScore;
            if (scoreDiff !== 0) return scoreDiff;
            // Then by date (newest first)
            return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
        });
    }, [violations]);

    if (!isOpen) return null;

    const flag = getCountryFlag(countryCode);
    const displayName = countryName || getCountryName(countryCode);

    // Use portal to escape any ancestor transforms that break fixed positioning
    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/30"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                className="fixed right-0 top-0 bottom-0 z-50 w-[380px] bg-background border-l border-border shadow-2xl animate-in slide-in-from-right fade-in duration-200 flex flex-col"
                role="dialog"
                aria-modal="true"
                aria-labelledby="panel-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/50">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{flag}</span>
                        <div>
                            <h2 id="panel-title" className="text-lg font-medium text-primary">
                                {displayName}
                            </h2>
                            <p className="text-xs text-secondary font-mono">
                                {violations.length} violation{violations.length !== 1 ? 's' : ''} · ${stats.totalRevenueLost.toLocaleString()} at risk
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-surface transition-colors"
                        aria-label="Close panel"
                    >
                        <X size={18} className="text-secondary" />
                    </button>
                </div>

                {/* Summary Stats */}
                {violations.length > 0 && (
                    <div className="px-4 py-3 border-b border-border space-y-3">
                        {/* By Status */}
                        <div>
                            <div className="text-[10px] font-medium text-secondary uppercase tracking-wider mb-2">
                                By Status
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(stats.byStatus).map(([status, count]) => {
                                    const config = STATUS_CONFIG[status] || STATUS_CONFIG.detected;
                                    return (
                                        <div
                                            key={status}
                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] ${config.bg} ${config.text}`}
                                        >
                                            <span>{config.label}</span>
                                            <span className="font-mono font-medium">({count})</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* By Platform */}
                        <div>
                            <div className="text-[10px] font-medium text-secondary uppercase tracking-wider mb-2">
                                By Platform
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(stats.byPlatform).map(([platform, count]) => (
                                    <div
                                        key={platform}
                                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] bg-surface text-secondary border border-border"
                                    >
                                        <span>{platform}</span>
                                        <span className="font-mono text-primary">({count})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Violations List */}
                <div className="flex-1 overflow-y-auto">
                    {violations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-secondary p-8">
                            <CheckCircle size={40} className="text-emerald-500/50 mb-3" />
                            <p className="text-center text-sm">No violations recorded for this country.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {sortedViolations.map(violation => {
                                const severity = getSeverity(violation.similarityScore);
                                const statusConfig = STATUS_CONFIG[violation.status] || STATUS_CONFIG.detected;

                                return (
                                    <button
                                        key={violation.id}
                                        onClick={() => onViolationClick(violation)}
                                        className="w-full px-4 py-3 text-left hover:bg-surface/50 transition-colors focus:outline-none focus:bg-surface/50"
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Copycat Image Thumbnail */}
                                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface border border-border shrink-0">
                                                <img
                                                    src={violation.copycatImage}
                                                    alt="Violation"
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Crect fill="%23374151" width="48" height="48"/%3E%3C/svg%3E';
                                                    }}
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-medium text-primary text-sm truncate">
                                                        {violation.brandName}
                                                    </span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${severity.bg} ${severity.text}`}>
                                                        {violation.similarityScore}%
                                                    </span>
                                                </div>

                                                <p className="text-xs text-secondary line-clamp-1 mb-2">
                                                    {violation.platform} · {violation.sellerName || 'Unknown seller'}
                                                </p>

                                                <div className="flex items-center gap-3 text-[10px]">
                                                    <span className={`flex items-center gap-1 ${statusConfig.text}`}>
                                                        {statusConfig.label}
                                                    </span>
                                                    <span className="text-secondary font-mono">
                                                        ${violation.revenueLost.toLocaleString()}
                                                    </span>
                                                    <span className="text-secondary/60">
                                                        {new Date(violation.detectedAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>

                                            <ExternalLink size={14} className="text-secondary/50 shrink-0 mt-1" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-border bg-surface/30">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 text-xs font-medium text-secondary bg-background border border-border hover:bg-surface hover:text-primary rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </>,
        document.body
    );
};

export default CountryViolationsPanel;
