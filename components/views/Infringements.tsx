import React, { useState, useMemo, useCallback } from 'react';
import StatsCard from '../StatsCard';
import InfringementCard from '../InfringementCard';
import InfringementTable from '../InfringementTable';
import CaseDetailModal from '../CaseDetailModal';
import DismissReasonPicker from '../DismissReasonPicker';
import { useDashboard } from '../../context/DashboardContext';
import { InfringementItem, PlatformType, DismissReason } from '../../types';
import { PLATFORM_CONFIG } from '../../constants';
import {
  isDetectionStatus,
  isPendingStatus,
  isEnforcingStatus,
  isTakedownStatus,
  needsMemberInput,
  getTakedownSubTab,
} from '../../lib/case-status';
import {
  Flag, Users, DollarSign, Search, Settings, Archive, ChevronDown, ChevronsUpDown,
  LayoutGrid, List, AlertCircle, X
} from 'lucide-react';

type ViewMode = 'detections' | 'pending' | 'enforcing' | 'takedowns';
type TakedownSubTab = 'successful' | 'partial' | 'failed' | 'dismissed';

const Infringements: React.FC = () => {
  const {
    infringements,
    reportInfringement,
    reportInfringementBulk,
    dismissInfringement,
    dismissInfringementBulk,
    undoInfringementStatus,
    takedownRequests
  } = useDashboard();

  // Badge counts
  const detectionsCount = infringements.filter(i => isDetectionStatus(i.status)).length;
  const pendingNeedsInputCount = infringements.filter(i => needsMemberInput(i.status)).length;
  const enforcingCount = infringements.filter(i => isEnforcingStatus(i.status)).length;

  // Toolbar State
  const [selectedPlatformTab, setSelectedPlatformTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [countryFilter, setCountryFilter] = useState('all');

  const [isCalculating, setIsCalculating] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InfringementItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('detections');
  const [takedownSubTab, setTakedownSubTab] = useState<TakedownSubTab>('successful');
  const [viewType, setViewType] = useState<'grid' | 'table'>('grid');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDismissModal, setShowDismissModal] = useState(false);

  const selectionMode = selectedIds.size > 0;

  // Stats calculations
  const totalPotentialInfringers = infringements.filter(i => i.status === 'detected').length;
  const combinedTraffic = infringements.reduce((acc, curr) => acc + curr.siteVisitors, 0);
  const revenueLoss = infringements.reduce((acc, curr) => acc + curr.revenueLost, 0);

  const uniqueCountries = useMemo(() => {
    return Array.from(new Set(infringements.map(i => i.country))).sort();
  }, [infringements]);

  // Selection handlers
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback((items: InfringementItem[]) => {
    setSelectedIds(new Set(items.map(i => i.id)));
  }, []);

  // Action handlers
  const handleReport = useCallback((id: string) => {
    reportInfringement(id);
  }, [reportInfringement]);

  const handleDismiss = useCallback((id: string, reason: DismissReason = 'other', reasonText?: string) => {
    dismissInfringement(id, reason, reasonText);
  }, [dismissInfringement]);

  const handleBulkReport = useCallback(async () => {
    if (selectedIds.size === 0) return;
    await reportInfringementBulk(Array.from(selectedIds));
    clearSelection();
  }, [selectedIds, reportInfringementBulk, clearSelection]);

  const handleBulkDismiss = useCallback(async (reason: DismissReason, reasonText?: string) => {
    if (selectedIds.size === 0) return;
    await dismissInfringementBulk(
      Array.from(selectedIds),
      reason,
      reasonText
    );
    clearSelection();
    setShowDismissModal(false);
  }, [selectedIds, dismissInfringementBulk, clearSelection]);

  const openDetail = useCallback((item: InfringementItem) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  }, []);

  const handleCalculate = () => {
    setIsCalculating(true);
    setTimeout(() => setIsCalculating(false), 1500);
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    let items = infringements.filter(item => {
      // Tab filtering
      if (viewMode === 'detections' && !isDetectionStatus(item.status)) return false;
      if (viewMode === 'pending' && !isPendingStatus(item.status)) return false;
      if (viewMode === 'enforcing' && !isEnforcingStatus(item.status)) return false;
      if (viewMode === 'takedowns') {
        if (!isTakedownStatus(item.status)) return false;
        // Sub-tab filtering
        const subTab = getTakedownSubTab(item.status);
        if (subTab !== takedownSubTab) return false;
      }

      // Other filters
      if (selectedPlatformTab !== 'all' && !item.platform.toLowerCase().includes(selectedPlatformTab)) return false;
      if (countryFilter !== 'all' && item.country !== countryFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return item.brandName.toLowerCase().includes(query) ||
               item.platform.toLowerCase().includes(query) ||
               item.sellerName?.toLowerCase().includes(query);
      }
      return true;
    });

    return items.sort((a, b) => {
      const dateA = new Date(a.detectedAt).getTime();
      const dateB = new Date(b.detectedAt).getTime();
      if (sortOrder === 'newest') return dateB - dateA;
      if (sortOrder === 'oldest') return dateA - dateB;
      return 0;
    });
  }, [infringements, selectedPlatformTab, searchQuery, viewMode, takedownSubTab, countryFilter, sortOrder]);

  // Clear selection when changing tabs
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    clearSelection();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-primary font-medium">Infringements</h1>
          <p className="text-secondary mt-1 text-sm">Real-time scan results from your active keywords.</p>
        </div>

        {/* Main Tabs */}
        <div className="flex bg-surface border border-border p-1 rounded-lg">
          <button
            onClick={() => handleViewModeChange('detections')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${viewMode === 'detections' ? 'bg-zinc-800 text-white shadow-sm' : 'text-secondary hover:text-primary'}`}
          >
            Detections
            {detectionsCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-500 text-white rounded-full min-w-[18px] text-center">
                {detectionsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleViewModeChange('pending')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${viewMode === 'pending' ? 'bg-zinc-800 text-white shadow-sm' : 'text-secondary hover:text-primary'}`}
          >
            Pending
            {pendingNeedsInputCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-500 text-white rounded-full min-w-[18px] text-center">
                {pendingNeedsInputCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleViewModeChange('enforcing')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${viewMode === 'enforcing' ? 'bg-zinc-800 text-white shadow-sm' : 'text-secondary hover:text-primary'}`}
          >
            Enforcing
            {enforcingCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-purple-500 text-white rounded-full min-w-[18px] text-center">
                {enforcingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleViewModeChange('takedowns')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'takedowns' ? 'bg-zinc-800 text-white shadow-sm' : 'text-secondary hover:text-primary'}`}
          >
            Takedowns
          </button>
        </div>
      </div>

      {/* Takedowns Sub-tabs */}
      {viewMode === 'takedowns' && (
        <div className="flex items-center gap-2 border-b border-border pb-4">
          {(['successful', 'partial', 'failed', 'dismissed'] as TakedownSubTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setTakedownSubTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                takedownSubTab === tab
                  ? tab === 'successful' ? 'bg-green-100 text-green-800 border border-green-200'
                  : tab === 'partial' ? 'bg-lime-100 text-lime-800 border border-lime-200'
                  : tab === 'failed' ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'bg-gray-100 text-gray-800 border border-gray-200'
                  : 'text-secondary hover:text-primary hover:bg-surface'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* STATS CARDS - Only show in Detections */}
      {viewMode === 'detections' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatsCard
            icon={Flag}
            title="Potential Infringers"
            value={totalPotentialInfringers.toString()}
          />
          <StatsCard
            icon={Users}
            title="Combined Traffic"
            value={combinedTraffic.toLocaleString()}
          />
          <StatsCard
            icon={DollarSign}
            title="Potential Revenue Loss"
            value={isCalculating ? '...' : `$${revenueLoss.toLocaleString('en-US').replace(/,/g, ' ')}`}
            action={{
              label: 'Recalculate',
              onClick: handleCalculate
            }}
          />
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectionMode && viewMode === 'detections' && (
        <div className="sticky top-0 z-20 flex items-center justify-between gap-4 p-4 bg-zinc-800 text-white rounded-lg shadow-lg animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <button
              onClick={clearSelection}
              className="p-1 hover:bg-zinc-700 rounded"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkReport}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Request Enforcement ({selectedIds.size})
            </button>
            <button
              onClick={() => setShowDismissModal(true)}
              className="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* TOOLBAR */}
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between mb-6">
        <div className="flex flex-wrap items-center gap-3 w-full">

          {/* Select All / Clear (only in Detections) */}
          {viewMode === 'detections' && (
            <button
              onClick={() => {
                if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
                  clearSelection();
                } else {
                  selectAll(filteredItems);
                }
              }}
              className={`px-4 py-2.5 bg-background border border-border rounded-lg text-sm font-medium transition-colors ${selectionMode ? 'bg-primary text-inverse border-primary' : 'text-primary hover:bg-surface'}`}
            >
              {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? 'Clear Selection' : 'Select All'}
            </button>
          )}

          {/* Search */}
          <div className="relative group min-w-[240px] flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-primary transition-colors" size={16} />
            <input
              type="text"
              placeholder="Website, Brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          {/* Platform Filter */}
          <div className="relative">
            <select
              value={selectedPlatformTab}
              onChange={(e) => setSelectedPlatformTab(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm font-medium text-primary focus:outline-none focus:border-zinc-600 cursor-pointer hover:bg-surface transition-colors min-w-[180px]"
            >
              <option value="all">All Platforms</option>
              <optgroup label="Social">
                {(Object.entries(PLATFORM_CONFIG) as [PlatformType, typeof PLATFORM_CONFIG[PlatformType]][])
                  .filter(([, config]) => config.category === 'social')
                  .map(([platform, config]) => (
                    <option key={platform} value={platform.toLowerCase()}>{config.label}</option>
                  ))}
              </optgroup>
              <optgroup label="Marketplace">
                {(Object.entries(PLATFORM_CONFIG) as [PlatformType, typeof PLATFORM_CONFIG[PlatformType]][])
                  .filter(([, config]) => config.category === 'marketplace')
                  .map(([platform, config]) => (
                    <option key={platform} value={platform.toLowerCase()}>{config.label}</option>
                  ))}
              </optgroup>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" size={14} />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm font-medium text-primary focus:outline-none focus:border-zinc-600 cursor-pointer hover:bg-surface transition-colors min-w-[160px]"
            >
              <option value="newest">Newest to Oldest</option>
              <option value="oldest">Oldest to Newest</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" size={14} />
          </div>

          {/* Country Filter */}
          <div className="relative">
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm font-medium text-primary focus:outline-none focus:border-zinc-600 cursor-pointer hover:bg-surface transition-colors min-w-[120px]"
            >
              <option value="all">Country</option>
              {uniqueCountries.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none">
              <ChevronsUpDown size={14} />
            </div>
          </div>

          <div className="hidden xl:block xl:flex-1" />

          {/* View Toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewType('grid')}
              className={`p-2.5 transition-colors ${viewType === 'grid' ? 'bg-primary text-inverse' : 'bg-background text-secondary hover:text-primary hover:bg-surface'}`}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewType('table')}
              className={`p-2.5 transition-colors ${viewType === 'table' ? 'bg-primary text-inverse' : 'bg-background text-secondary hover:text-primary hover:bg-surface'}`}
              title="Table view"
            >
              <List size={16} />
            </button>
          </div>

          {/* Automation Rules */}
          <button className="flex items-center gap-2 px-4 py-2.5 bg-background border border-border rounded-lg text-sm font-medium text-primary hover:bg-surface transition-colors">
            <Settings size={16} />
            <span className="hidden sm:inline">Automation Rules</span>
          </button>

          {/* Archive Button */}
          <button className="p-2.5 bg-background border border-border rounded-lg text-primary hover:bg-surface transition-colors">
            <Archive size={18} />
          </button>
        </div>
      </div>

      {/* Needs Input Banner */}
      {viewMode === 'pending' && pendingNeedsInputCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <AlertCircle className="text-orange-500" size={20} />
          <p className="text-sm text-orange-800">
            <strong>{pendingNeedsInputCount} case(s)</strong> need your input. Admin has requested more information.
          </p>
        </div>
      )}

      {/* Content - Grid or Table */}
      {filteredItems.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-border rounded-lg">
          <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 text-secondary">
            <Search size={24} />
          </div>
          <p className="text-secondary">No infringements found matching your filters.</p>
        </div>
      ) : viewType === 'table' ? (
        <InfringementTable
          items={filteredItems}
          onRowClick={openDetail}
          selectedIds={selectedIds}
          onToggleSelect={viewMode === 'detections' ? toggleSelection : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map(item => (
            <div key={item.id} onClick={() => openDetail(item)} className="cursor-pointer relative group">
              <InfringementCard
                item={item}
                onReport={(e) => { e.stopPropagation(); handleReport(item.id); }}
                onDismiss={(e) => { e.stopPropagation(); handleDismiss(item.id, 'other'); }}
                isSelected={selectedIds.has(item.id)}
              />
              {viewMode === 'detections' && (
                <div className="absolute top-2 right-2 z-10 p-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelection(item.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 accent-primary cursor-pointer"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Case Detail Modal */}
      <CaseDetailModal
        item={selectedItem}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onConfirm={handleReport}
        onDismiss={(id) => handleDismiss(id, 'other')}
      />

      {/* Dismiss Reason Modal */}
      <DismissReasonPicker
        isOpen={showDismissModal}
        onClose={() => setShowDismissModal(false)}
        onConfirm={handleBulkDismiss}
        itemCount={selectedIds.size}
      />
    </div>
  );
};

export default Infringements;
