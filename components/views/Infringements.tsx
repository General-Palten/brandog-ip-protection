import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import StatsCard from '../StatsCard';
import InfringementCard from '../InfringementCard';
import InfringementTable from '../InfringementTable';
import CaseDetailModal from '../CaseDetailModal';
import DismissReasonPicker from '../DismissReasonPicker';
import { useDashboard } from '../../context/DashboardContext';
import { InfringementItem, PlatformType, DismissReason, PersistedAsset } from '../../types';
import { PLATFORM_CONFIG } from '../../constants';
import {
  isDetectionStatus,
  isPendingStatus,
  isEnforcingStatus,
  isDismissedStatus,
} from '../../lib/case-status';
import {
  DollarSign, ShieldCheck, Clock, Globe, Search, ChevronDown, ChevronsUpDown,
  LayoutGrid, List, X, Shield, Image, Plus, Trash2,
  Pencil, GripVertical, AlertTriangle
} from 'lucide-react';
import ReportBadActorModal from '../ReportBadActorModal';
import { ShadButton } from '../ui/shadcn-button';
import { ShadTabs, ShadTabsList, ShadTabsTrigger } from '../ui/shadcn-tabs';
import { ShadInput } from '../ui/shadcn-input';
import { DataToolbar, DataToolbarGroup } from '../ui/data-toolbar';
import Modal from '../ui/Modal';
import Whitelist from './Whitelist';

// ─── Category tab definitions ────────────────────────────────────────────────

interface CategoryTab {
  id: string;
  label: string;
  filter: (item: InfringementItem) => boolean;
}

const ALL_CATEGORY_TABS: CategoryTab[] = [
  { id: 'all', label: 'All', filter: () => true },
  {
    id: 'enforcing',
    label: 'Enforcing',
    filter: (item) => isEnforcingStatus(item.status),
  },
  {
    id: 'marketplace',
    label: 'Marketplaces',
    filter: (item) => PLATFORM_CONFIG[item.platform]?.category === 'marketplace',
  },
  {
    id: 'third-party',
    label: 'Third Party',
    filter: (item) => PLATFORM_CONFIG[item.platform]?.category === 'social',
  },
  {
    id: 'flagged',
    label: 'Flagged',
    filter: (item) => item.priority === 'high',
  },
  {
    id: 'auto-takedown',
    label: 'Auto-Takedown',
    filter: (item) => item.autoTakedown === true,
  },
  {
    id: 'pending',
    label: 'Pending',
    filter: (item) =>
      isPendingStatus(item.status) ||
      isDetectionStatus(item.status),
  },
  {
    id: 'resolved',
    label: 'Resolved',
    filter: (item) =>
      item.status === 'resolved_success' || item.status === 'resolved_partial',
  },
  {
    id: 'denied',
    label: 'Denied',
    filter: (item) => item.status === 'resolved_failed',
  },
  {
    id: 'ignored',
    label: 'Ignored',
    filter: (item) => isDismissedStatus(item.status),
  },
];

const DEFAULT_VISIBLE_TAB_IDS = [
  'all',
  'enforcing',
  'marketplace',
  'third-party',
  'flagged',
  'auto-takedown',
  'pending',
  'resolved',
  'denied',
  'ignored',
];

const LS_VISIBLE_TABS_KEY = 'infringements_visible_tabs';
const LS_ACTIVE_TAB_KEY = 'infringements_active_tab';

function loadVisibleTabIds(): string[] {
  try {
    const raw = localStorage.getItem(LS_VISIBLE_TABS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed) && parsed.includes('all')) return parsed;
    }
  } catch {}
  return DEFAULT_VISIBLE_TAB_IDS;
}

function loadActiveTab(): string {
  try {
    return localStorage.getItem(LS_ACTIVE_TAB_KEY) || 'all';
  } catch {
    return 'all';
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

const Infringements: React.FC = () => {
  const {
    infringements,
    assets,
    reportInfringement,
    reportInfringementBulk,
    dismissInfringement,
    dismissInfringementBulk,
    takedownRequests,
  } = useDashboard();

  // ── Category tabs ──────────────────────────────────────────────────────────
  const [visibleTabIds, setVisibleTabIds] = useState<string[]>(loadVisibleTabIds);
  const [activeTabId, setActiveTabId] = useState<string>(loadActiveTab);
  const [isEditTabsOpen, setIsEditTabsOpen] = useState(false);
  const [editTabIds, setEditTabIds] = useState<string[]>([]);

  // Persist tab state
  useEffect(() => {
    localStorage.setItem(LS_VISIBLE_TABS_KEY, JSON.stringify(visibleTabIds));
  }, [visibleTabIds]);
  useEffect(() => {
    localStorage.setItem(LS_ACTIVE_TAB_KEY, activeTabId);
  }, [activeTabId]);

  const visibleTabs = useMemo(
    () => visibleTabIds.map((id) => ALL_CATEGORY_TABS.find((t) => t.id === id)).filter(Boolean) as CategoryTab[],
    [visibleTabIds],
  );

  const hiddenTabs = useMemo(
    () => ALL_CATEGORY_TABS.filter((t) => !visibleTabIds.includes(t.id)),
    [visibleTabIds],
  );

  // ── Edit tabs modal helpers ────────────────────────────────────────────────
  const [dragTabId, setDragTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

  const openEditTabs = () => {
    setEditTabIds([...visibleTabIds]);
    setIsEditTabsOpen(true);
  };

  const editRemoveTab = (id: string) => {
    if (id === 'all') return;
    setEditTabIds((prev) => prev.filter((t) => t !== id));
  };

  const editAddTab = (id: string) => {
    setEditTabIds((prev) => [...prev, id]);
  };

  const editHiddenTabs = useMemo(
    () => ALL_CATEGORY_TABS.filter((t) => !editTabIds.includes(t.id)),
    [editTabIds],
  );

  const handleDragStart = (id: string) => {
    if (id === 'all') return;
    setDragTabId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id === 'all' || id === dragTabId) return;
    setDragOverTabId(id);
  };

  const handleDrop = (targetId: string) => {
    if (!dragTabId || targetId === 'all' || dragTabId === targetId) {
      setDragTabId(null);
      setDragOverTabId(null);
      return;
    }
    setEditTabIds((prev) => {
      const next = [...prev];
      const fromIndex = next.indexOf(dragTabId);
      const toIndex = next.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, dragTabId);
      return next;
    });
    setDragTabId(null);
    setDragOverTabId(null);
  };

  const handleDragEnd = () => {
    setDragTabId(null);
    setDragOverTabId(null);
  };

  const saveEditTabs = () => {
    setVisibleTabIds(editTabIds);
    if (!editTabIds.includes(activeTabId)) setActiveTabId('all');
    setIsEditTabsOpen(false);
  };

  // ── Filter by Asset ────────────────────────────────────────────────────────
  const [assetFilterId, setAssetFilterId] = useState<string | null>(null);
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  const assetDropdownRef = useRef<HTMLDivElement>(null);
  const assetBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        showAssetDropdown &&
        assetDropdownRef.current &&
        !assetDropdownRef.current.contains(e.target as Node) &&
        assetBtnRef.current &&
        !assetBtnRef.current.contains(e.target as Node)
      ) {
        setShowAssetDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAssetDropdown]);

  const selectedAsset = assets.find((a) => a.id === assetFilterId);

  // ── Toolbar State ──────────────────────────────────────────────────────────
  const [selectedPlatformTab, setSelectedPlatformTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [countryFilter, setCountryFilter] = useState('all');
  const [viewType, setViewType] = useState<'grid' | 'table'>('table');

  const [selectedItem, setSelectedItem] = useState<InfringementItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDismissModal, setShowDismissModal] = useState(false);
  const [isManageRulesOpen, setIsManageRulesOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const selectionMode = selectedIds.size > 0;

  // ── Unique countries ───────────────────────────────────────────────────────
  const uniqueCountries = useMemo(
    () => Array.from(new Set(infringements.map((i) => i.country))).sort(),
    [infringements],
  );

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const resolved = infringements.filter(
      (i) => i.status === 'resolved_success' || i.status === 'resolved_partial',
    );
    const pendingCount = infringements.filter((i) => isPendingStatus(i.status)).length;
    const enforcingCount = infringements.filter((i) => isEnforcingStatus(i.status)).length;
    const resolvedCount = resolved.length;

    const valueRemoved = resolved.reduce((s, i) => s + i.revenueLost, 0);

    const total = resolvedCount + pendingCount + enforcingCount;
    const completionRate = total > 0 ? (resolvedCount / total) * 100 : 0;

    // Median resolution time (days) — approximate using detectedAt to now for resolved items
    const resolutionDays = resolved
      .map((i) => {
        const detected = new Date(i.detectedAt).getTime();
        const now = Date.now();
        return (now - detected) / (1000 * 60 * 60 * 24);
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

    const platformCount = new Set(infringements.map((i) => i.platform)).size;

    return { valueRemoved, completionRate, medianDays, platformCount };
  }, [infringements]);

  // ── Tab counts ─────────────────────────────────────────────────────────────
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tab of ALL_CATEGORY_TABS) {
      counts[tab.id] = infringements.filter(tab.filter).length;
    }
    return counts;
  }, [infringements]);

  // ── Selection handlers ─────────────────────────────────────────────────────
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectAll = useCallback(
    (items: InfringementItem[]) => setSelectedIds(new Set(items.map((i) => i.id))),
    [],
  );

  // ── Action handlers ────────────────────────────────────────────────────────
  const handleReport = useCallback(
    (id: string) => reportInfringement(id),
    [reportInfringement],
  );

  const handleDismiss = useCallback(
    (id: string, reason: DismissReason = 'other', reasonText?: string) =>
      dismissInfringement(id, reason, reasonText),
    [dismissInfringement],
  );

  const handleBulkReport = useCallback(async () => {
    if (selectedIds.size === 0) return;
    await reportInfringementBulk(Array.from(selectedIds));
    clearSelection();
  }, [selectedIds, reportInfringementBulk, clearSelection]);

  const handleBulkDismiss = useCallback(
    async (reason: DismissReason, reasonText?: string) => {
      if (selectedIds.size === 0) return;
      await dismissInfringementBulk(Array.from(selectedIds), reason, reasonText);
      clearSelection();
      setShowDismissModal(false);
    },
    [selectedIds, dismissInfringementBulk, clearSelection],
  );

  const openDetail = useCallback((item: InfringementItem) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  }, []);

  // ── Filtered items ─────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    const activeTab = ALL_CATEGORY_TABS.find((t) => t.id === activeTabId) || ALL_CATEGORY_TABS[0];

    let items = infringements.filter((item) => {
      // Category tab filter
      if (!activeTab.filter(item)) return false;

      // Asset filter
      if (assetFilterId && item.originalAssetId !== assetFilterId) return false;

      // Platform filter
      if (selectedPlatformTab !== 'all' && !item.platform.toLowerCase().includes(selectedPlatformTab))
        return false;

      // Country filter
      if (countryFilter !== 'all' && item.country !== countryFilter) return false;

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          item.brandName.toLowerCase().includes(q) ||
          item.platform.toLowerCase().includes(q) ||
          item.sellerName?.toLowerCase().includes(q)
        );
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
  }, [infringements, activeTabId, assetFilterId, selectedPlatformTab, searchQuery, countryFilter, sortOrder]);

  // Clear selection when changing category tabs
  const handleTabChange = (id: string) => {
    setActiveTabId(id);
    clearSelection();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl text-primary font-medium">Infringements</h1>
          <p className="text-secondary mt-1 text-sm">
            Real-time scan results from your active keywords.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Report Bad Actor */}
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-inverse rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <AlertTriangle size={16} />
            Report Bad Actor
          </button>

          {/* Manage Rules */}
          <button
            onClick={() => setIsManageRulesOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-border text-primary rounded-lg text-sm font-medium hover:bg-surface transition-colors"
          >
            <Shield size={16} />
            Manage Rules
          </button>

          {/* Filter by Asset */}
          <div className="relative">
            <button
              ref={assetBtnRef}
              onClick={() => setShowAssetDropdown((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                assetFilterId
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-primary hover:bg-surface'
              }`}
            >
              <Image size={16} />
              {selectedAsset ? selectedAsset.name : 'Filter by Asset'}
            </button>

            {showAssetDropdown && (
              <div
                ref={assetDropdownRef}
                className="absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
              >
                {assetFilterId && (
                  <button
                    onClick={() => {
                      setAssetFilterId(null);
                      setShowAssetDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-surface/80 transition-colors border-b border-border"
                  >
                    <X size={14} />
                    Clear filter
                  </button>
                )}
                {assets.length === 0 && (
                  <div className="px-4 py-6 text-center text-secondary text-sm">
                    No assets found.
                  </div>
                )}
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => {
                      setAssetFilterId(asset.id);
                      setShowAssetDropdown(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface/80 transition-colors ${
                      assetFilterId === asset.id ? 'bg-primary/10 text-primary' : 'text-primary'
                    }`}
                  >
                    {asset.sourceUrl ? (
                      <img
                        src={asset.sourceUrl}
                        alt={asset.name}
                        className="w-8 h-8 rounded object-cover border border-border"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded bg-surface border border-border flex items-center justify-center text-secondary">
                        <Image size={14} />
                      </div>
                    )}
                    <span className="truncate font-medium">{asset.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={DollarSign}
          title="Value of Listings Removed"
          value={`$${stats.valueRemoved.toLocaleString('en-US')}`}
        />
        <StatsCard
          icon={ShieldCheck}
          title="Completion Rate"
          value={`${stats.completionRate.toFixed(1)}%`}
        />
        <StatsCard
          icon={Clock}
          title="Resolution Time"
          value={`${stats.medianDays.toFixed(1)} days`}
        />
        <StatsCard
          icon={Globe}
          title="Platforms"
          value={stats.platformCount.toString()}
        />
      </div>

      {/* ── Category Tabs ───────────────────────────────────────────────────── */}
      <ShadTabs>
        <ShadTabsList>
          {visibleTabs.map((tab) => (
            <ShadTabsTrigger
              key={tab.id}
              active={activeTabId === tab.id}
              count={tabCounts[tab.id] ?? 0}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </ShadTabsTrigger>
          ))}

          {/* Edit tabs button */}
          <button
            onClick={openEditTabs}
            className="p-2 text-secondary hover:text-primary hover:bg-surface rounded transition-colors shrink-0 ml-1"
            title="Edit tabs"
          >
            <Pencil size={14} />
          </button>
        </ShadTabsList>
      </ShadTabs>

      {/* ── Bulk Action Bar ─────────────────────────────────────────────────── */}
      {selectionMode && (
        <div className="sticky top-0 z-20 flex items-center justify-between gap-4 p-4 bg-zinc-800 text-white rounded-lg shadow-lg animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <button onClick={clearSelection} className="p-1 hover:bg-zinc-700 rounded">
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

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <DataToolbar>
        <DataToolbarGroup>
          {/* Search */}
          <div className="min-w-[240px] flex-1 sm:flex-none">
            <ShadInput
              icon={Search}
              type="text"
              placeholder="Website, Brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Platform Filter */}
          <div className="relative">
            <select
              value={selectedPlatformTab}
              onChange={(e) => setSelectedPlatformTab(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm font-medium text-primary focus:outline-none focus:border-primary cursor-pointer hover:bg-surface transition-colors min-w-[180px]"
            >
              <option value="all">All Platforms</option>
              <optgroup label="Social">
                {(
                  Object.entries(PLATFORM_CONFIG) as [PlatformType, (typeof PLATFORM_CONFIG)[PlatformType]][]
                )
                  .filter(([, config]) => config.category === 'social')
                  .map(([platform, config]) => (
                    <option key={platform} value={platform.toLowerCase()}>
                      {config.label}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Marketplace">
                {(
                  Object.entries(PLATFORM_CONFIG) as [PlatformType, (typeof PLATFORM_CONFIG)[PlatformType]][]
                )
                  .filter(([, config]) => config.category === 'marketplace')
                  .map(([platform, config]) => (
                    <option key={platform} value={platform.toLowerCase()}>
                      {config.label}
                    </option>
                  ))}
              </optgroup>
            </select>
            <ChevronDown
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none"
              size={14}
            />
          </div>

          {/* Sort */}
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

          {/* Country Filter */}
          <div className="relative">
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm font-medium text-primary focus:outline-none focus:border-primary cursor-pointer hover:bg-surface transition-colors min-w-[120px]"
            >
              <option value="all">Country</option>
              {uniqueCountries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none">
              <ChevronsUpDown size={14} />
            </div>
          </div>

          <div className="hidden xl:block xl:flex-1" />

          {/* Select All */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
              onChange={() => {
                if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
                  clearSelection();
                } else {
                  selectAll(filteredItems);
                }
              }}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
            <span className="text-sm text-secondary">Select all</span>
          </label>

          {/* View Toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewType('grid')}
              className={`p-2.5 transition-colors ${
                viewType === 'grid'
                  ? 'bg-primary text-inverse'
                  : 'bg-background text-secondary hover:text-primary hover:bg-surface'
              }`}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewType('table')}
              className={`p-2.5 transition-colors ${
                viewType === 'table'
                  ? 'bg-primary text-inverse'
                  : 'bg-background text-secondary hover:text-primary hover:bg-surface'
              }`}
              title="Table view"
            >
              <List size={16} />
            </button>
          </div>
        </DataToolbarGroup>
      </DataToolbar>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
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
          onToggleSelect={toggleSelection}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <div key={item.id} onClick={() => openDetail(item)} className="cursor-pointer relative group">
              <InfringementCard
                item={item}
                onReport={(e) => {
                  e.stopPropagation();
                  handleReport(item.id);
                }}
                onDismiss={(e) => {
                  e.stopPropagation();
                  handleDismiss(item.id, 'other');
                }}
                isSelected={selectedIds.has(item.id)}
              />
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
            </div>
          ))}
        </div>
      )}

      {/* ── Modals / Drawers ────────────────────────────────────────────────── */}
      <CaseDetailModal
        item={selectedItem}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onConfirm={handleReport}
        onDismiss={(id) => handleDismiss(id, 'other')}
      />

      <DismissReasonPicker
        isOpen={showDismissModal}
        onClose={() => setShowDismissModal(false)}
        onConfirm={handleBulkDismiss}
        itemCount={selectedIds.size}
      />

      {/* Edit Tabs Modal */}
      <Modal isOpen={isEditTabsOpen} onClose={() => setIsEditTabsOpen(false)} title="Edit Tabs">
        <div className="p-6 space-y-6">
          {/* Visible tabs — drag to reorder, trash to remove */}
          <div>
            <h3 className="text-xs font-medium text-secondary uppercase tracking-wider mb-3">
              Visible Tabs
            </h3>
            <div className="space-y-1">
              {editTabIds.map((id) => {
                const tab = ALL_CATEGORY_TABS.find((t) => t.id === id);
                if (!tab) return null;
                const isAll = id === 'all';
                const isDragging = dragTabId === id;
                const isDragOver = dragOverTabId === id;
                return (
                  <div
                    key={id}
                    draggable={!isAll}
                    onDragStart={() => handleDragStart(id)}
                    onDragOver={(e) => handleDragOver(e, id)}
                    onDrop={() => handleDrop(id)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-background transition-all ${
                      isDragging
                        ? 'opacity-40 border-border'
                        : isDragOver
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-secondary/50'
                    } ${!isAll ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <GripVertical
                      size={14}
                      className={`shrink-0 ${isAll ? 'text-transparent' : 'text-secondary'}`}
                    />
                    <span className="flex-1 text-sm font-medium text-primary select-none">
                      {tab.label}
                    </span>
                    <span className="text-xs text-secondary tabular-nums">
                      {tabCounts[tab.id] ?? 0}
                    </span>
                    {!isAll && (
                      <button
                        onClick={() => editRemoveTab(id)}
                        className="p-1 text-secondary hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hidden tabs — click to add back */}
          {editHiddenTabs.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-secondary uppercase tracking-wider mb-3">
                Available Tabs
              </h3>
              <div className="space-y-1">
                {editHiddenTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => editAddTab(tab.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-border bg-background hover:border-secondary/50 hover:bg-surface transition-colors"
                  >
                    <Plus size={14} className="text-secondary shrink-0" />
                    <span className="flex-1 text-sm text-secondary text-left">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <ShadButton variant="ghost" className="flex-1" onClick={() => setIsEditTabsOpen(false)}>
              Cancel
            </ShadButton>
            <ShadButton className="flex-1" onClick={saveEditTabs}>
              Save Changes
            </ShadButton>
          </div>
        </div>
      </Modal>

      {/* Report Bad Actor Modal */}
      <ReportBadActorModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} />

      {/* Manage Rules Drawer */}
      {isManageRulesOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-in fade-in"
            onClick={() => setIsManageRulesOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-background border-l border-border shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-primary" />
                <h2 className="text-lg font-medium text-primary">Manage Rules</h2>
              </div>
              <button
                onClick={() => setIsManageRulesOpen(false)}
                className="p-2 text-secondary hover:text-primary hover:bg-surface rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <Whitelist />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Infringements;
