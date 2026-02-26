import React, { useState, useMemo, useCallback } from 'react';
import { DollarSign, CheckCircle, Clock, TrendingUp, Search, ChevronDown } from 'lucide-react';
import StatsCard from '../StatsCard';
import BentoCard from '../ui/BentoCard';
import StatusBadge from '../ui/StatusBadge';
import PlatformIcon from '../ui/PlatformIcon';
import CaseDetailModal from '../CaseDetailModal';
import { ShadTabs, ShadTabsList, ShadTabsTrigger } from '../ui/shadcn-tabs';
import { ShadInput } from '../ui/shadcn-input';
import { DataToolbar, DataToolbarGroup } from '../ui/data-toolbar';
import { useDashboard } from '../../context/DashboardContext';
import { InfringementItem, InfringementStatus } from '../../types';

type ResultsTab = 'all' | 'in_progress' | 'successful' | 'partial' | 'failed';

const RESULTS_STATUSES: InfringementStatus[] = [
  'in_progress',
  'resolved_success',
  'resolved_partial',
  'resolved_failed',
];

const TakedownResults: React.FC = () => {
  const { infringements, reportInfringement, dismissInfringement } = useDashboard();
  const [activeTab, setActiveTab] = useState<ResultsTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [selectedItem, setSelectedItem] = useState<InfringementItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Filter infringements to enforcement-related statuses
  const resultsItems = useMemo(
    () => infringements.filter((i) => RESULTS_STATUSES.includes(i.status)),
    [infringements],
  );

  // Stats
  const stats = useMemo(() => {
    const success = resultsItems.filter((i) => i.status === 'resolved_success');
    const partial = resultsItems.filter((i) => i.status === 'resolved_partial');
    const failed = resultsItems.filter((i) => i.status === 'resolved_failed');
    const resolved = [...success, ...partial];

    const revenueProtected = resolved.reduce((sum, i) => sum + i.revenueLost, 0);
    const successfulCount = success.length;

    // Median resolution time (days)
    const resolutionDays = resolved
      .map((i) => {
        const detected = new Date(i.detectedAt).getTime();
        return (Date.now() - detected) / (1000 * 60 * 60 * 24);
      })
      .sort((a, b) => a - b);

    let medianDays = 0;
    if (resolutionDays.length > 0) {
      const mid = Math.floor(resolutionDays.length / 2);
      medianDays =
        resolutionDays.length % 2 === 0
          ? (resolutionDays[mid - 1] + resolutionDays[mid]) / 2
          : resolutionDays[mid];
    }

    const totalResolved = success.length + partial.length + failed.length;
    const successRate = totalResolved > 0 ? (success.length / totalResolved) * 100 : 0;

    return { revenueProtected, successfulCount, medianDays, successRate };
  }, [resultsItems]);

  // Tab counts
  const tabCounts = useMemo(() => ({
    all: resultsItems.length,
    in_progress: resultsItems.filter((i) => i.status === 'in_progress').length,
    successful: resultsItems.filter((i) => i.status === 'resolved_success').length,
    partial: resultsItems.filter((i) => i.status === 'resolved_partial').length,
    failed: resultsItems.filter((i) => i.status === 'resolved_failed').length,
  }), [resultsItems]);

  // Filtered by active tab, search, and sort
  const filteredItems = useMemo(() => {
    const statusMap: Record<ResultsTab, InfringementStatus | null> = {
      all: null,
      in_progress: 'in_progress',
      successful: 'resolved_success',
      partial: 'resolved_partial',
      failed: 'resolved_failed',
    };
    const status = statusMap[activeTab];

    let items = resultsItems;

    // Tab filter
    if (status) items = items.filter((i) => i.status === status);

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          (i.sellerName?.toLowerCase().includes(q)) ||
          i.platform.toLowerCase().includes(q) ||
          (i.infringingUrl?.toLowerCase().includes(q)) ||
          i.brandName.toLowerCase().includes(q),
      );
    }

    // Sort
    return items.sort((a, b) => {
      const dateA = new Date(a.detectedAt).getTime();
      const dateB = new Date(b.detectedAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [resultsItems, activeTab, searchQuery, sortOrder]);

  const openDetail = useCallback((item: InfringementItem) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  }, []);

  const tabs: { id: ResultsTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'successful', label: 'Successful' },
    { id: 'partial', label: 'Partial' },
    { id: 'failed', label: 'Failed' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-primary font-medium">Takedown Results</h1>
        <p className="text-secondary mt-1 text-sm">
          Track the success of your brand enforcement efforts.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={DollarSign}
          title="Revenue Protected"
          value={`$${stats.revenueProtected.toLocaleString('en-US')}`}
        />
        <StatsCard
          icon={CheckCircle}
          title="Successful Takedowns"
          value={stats.successfulCount.toString()}
        />
        <StatsCard
          icon={Clock}
          title="Avg. Resolution Time"
          value={`${stats.medianDays.toFixed(1)} days`}
        />
        <StatsCard
          icon={TrendingUp}
          title="Success Rate"
          value={`${stats.successRate.toFixed(1)}%`}
        />
      </div>

      {/* Tabs */}
      <ShadTabs>
        <ShadTabsList>
          {tabs.map((tab) => (
            <ShadTabsTrigger
              key={tab.id}
              active={activeTab === tab.id}
              count={tabCounts[tab.id]}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </ShadTabsTrigger>
          ))}
        </ShadTabsList>
      </ShadTabs>

      {/* Toolbar */}
      <DataToolbar>
        <DataToolbarGroup>
          <div className="min-w-[240px] flex-1 sm:flex-none">
            <ShadInput
              icon={Search}
              type="text"
              placeholder="Seller, platform, URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm font-medium text-primary focus:outline-none focus:border-primary cursor-pointer hover:bg-surface transition-colors min-w-[160px]"
            >
              <option value="newest">Newest to Oldest</option>
              <option value="oldest">Oldest to Newest</option>
            </select>
            <ChevronDown
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none"
              size={14}
            />
          </div>
        </DataToolbarGroup>
      </DataToolbar>

      {/* Results Table */}
      <BentoCard noPadding>
        {/* Table */}
        {filteredItems.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 text-secondary">
              <Search size={24} />
            </div>
            <p className="text-secondary text-sm">No takedown results yet.</p>
            <p className="text-secondary/60 text-xs mt-1">
              Results will appear here once enforcement actions are processed.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium text-secondary uppercase tracking-wider">Platform</th>
                  <th className="px-4 py-3 text-xs font-medium text-secondary uppercase tracking-wider">Seller / URL</th>
                  <th className="px-4 py-3 text-xs font-medium text-secondary uppercase tracking-wider text-right">Revenue</th>
                  <th className="px-4 py-3 text-xs font-medium text-secondary uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-secondary uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => openDetail(item)}
                    className="border-b border-border last:border-b-0 hover:bg-surface/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <PlatformIcon platform={item.platform} showLabel size={14} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-primary font-medium truncate max-w-[260px]">
                          {item.sellerName || item.brandName}
                        </span>
                        {item.infringingUrl && (
                          <span className="text-xs text-secondary truncate max-w-[260px]">
                            {item.infringingUrl}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-primary">
                      ${item.revenueLost.toLocaleString('en-US')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-secondary text-xs font-mono">
                      {new Date(item.detectedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </BentoCard>

      {/* Case Detail Modal */}
      <CaseDetailModal
        item={selectedItem}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onConfirm={(id) => reportInfringement(id)}
        onDismiss={(id) => dismissInfringement(id, 'other')}
      />
    </div>
  );
};

export default TakedownResults;
