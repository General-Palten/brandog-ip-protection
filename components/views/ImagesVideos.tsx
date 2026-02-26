import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { PersistedAsset } from '../../types';
import {
  ShieldCheck, Trash2, Loader2, Globe, FileText,
  Image as ImageIcon, Video, Search, ChevronDown, Plus, AlertTriangle,
  ExternalLink, Scan, Pencil, GripVertical, Type, Layout, Package, Quote,
  LayoutGrid, List
} from 'lucide-react';
import Modal from '../ui/Modal';
import { ShadButton } from '../ui/shadcn-button';
import SearchResultsModal from '../SearchResultsModal';

// ─── IP sub-category tab definitions ─────────────────────────────────────────

interface IPCategoryTab {
  id: string;
  label: string;
  icon: React.ElementType;
  filter: (asset: PersistedAsset) => boolean;
}

const ALL_IP_TABS: IPCategoryTab[] = [
  { id: 'all', label: 'All IP', icon: Layout, filter: () => true },
  { id: 'image', label: 'Images', icon: ImageIcon, filter: (a) => a.type === 'image' },
  { id: 'video', label: 'Videos', icon: Video, filter: (a) => a.type === 'video' },
  { id: 'logo', label: 'Logos', icon: ShieldCheck, filter: (a) => a.name.toLowerCase().includes('logo') },
  { id: 'text', label: 'Text', icon: Type, filter: (a) => a.type === 'text' },
  { id: 'domain', label: 'Domains', icon: Globe, filter: (a) => a.name.toLowerCase().includes('domain') || (a.sourceUrl?.includes('.') ?? false) },
  { id: 'trade-dress', label: 'Trade Dress', icon: Package, filter: (a) => a.name.toLowerCase().includes('trade dress') || a.name.toLowerCase().includes('packaging') },
  { id: 'slogan', label: 'Slogans', icon: Quote, filter: (a) => a.name.toLowerCase().includes('slogan') || a.name.toLowerCase().includes('tagline') },
];

const DEFAULT_VISIBLE_IP_TABS = ['all', 'image', 'video', 'logo', 'text', 'domain'];

const LS_IP_TABS_KEY = 'assets_ip_visible_tabs';
const LS_IP_ACTIVE_KEY = 'assets_ip_active_tab';

function loadIPTabIds(): string[] {
  try {
    const raw = localStorage.getItem(LS_IP_TABS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed) && parsed.includes('all')) return parsed;
    }
  } catch {}
  return DEFAULT_VISIBLE_IP_TABS;
}

function loadIPActiveTab(): string {
  try { return localStorage.getItem(LS_IP_ACTIVE_KEY) || 'all'; } catch { return 'all'; }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ImagesVideosProps {
  onUploadRef?: React.RefObject<(() => void) | null>;
}

const ImagesVideos: React.FC<ImagesVideosProps> = ({ onUploadRef }) => {
  const {
    assets,
    assetsLoading,
    addAsset,
    deleteAsset,
    getAssetURL,
    addNotification
  } = useDashboard();

  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // IP category tabs
  const [visibleIPTabIds, setVisibleIPTabIds] = useState<string[]>(loadIPTabIds);
  const [activeIPTab, setActiveIPTab] = useState<string>(loadIPActiveTab);
  const [isEditTabsOpen, setIsEditTabsOpen] = useState(false);
  const [editTabIds, setEditTabIds] = useState<string[]>([]);
  const [dragTabId, setDragTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

  // Persist tabs
  useEffect(() => { localStorage.setItem(LS_IP_TABS_KEY, JSON.stringify(visibleIPTabIds)); }, [visibleIPTabIds]);
  useEffect(() => { localStorage.setItem(LS_IP_ACTIVE_KEY, activeIPTab); }, [activeIPTab]);

  const visibleTabs = useMemo(
    () => visibleIPTabIds.map((id) => ALL_IP_TABS.find((t) => t.id === id)).filter(Boolean) as IPCategoryTab[],
    [visibleIPTabIds],
  );

  // Edit tabs modal
  const openEditTabs = () => { setEditTabIds([...visibleIPTabIds]); setIsEditTabsOpen(true); };
  const editRemoveTab = (id: string) => { if (id === 'all') return; setEditTabIds((p) => p.filter((t) => t !== id)); };
  const editAddTab = (id: string) => { setEditTabIds((p) => [...p, id]); };
  const editHiddenTabs = useMemo(() => ALL_IP_TABS.filter((t) => !editTabIds.includes(t.id)), [editTabIds]);

  const handleDragStart = (id: string) => { if (id !== 'all') setDragTabId(id); };
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); if (id !== 'all' && id !== dragTabId) setDragOverTabId(id); };
  const handleDrop = (targetId: string) => {
    if (!dragTabId || targetId === 'all' || dragTabId === targetId) { setDragTabId(null); setDragOverTabId(null); return; }
    setEditTabIds((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragTabId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragTabId);
      return next;
    });
    setDragTabId(null); setDragOverTabId(null);
  };
  const handleDragEnd = () => { setDragTabId(null); setDragOverTabId(null); };
  const saveEditTabs = () => {
    setVisibleIPTabIds(editTabIds);
    if (!editTabIds.includes(activeIPTab)) setActiveIPTab('all');
    setIsEditTabsOpen(false);
  };

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tab of ALL_IP_TABS) counts[tab.id] = assets.filter(tab.filter).length;
    return counts;
  }, [assets]);

  // Sorting & search
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'protected' | 'infringement'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Asset URL cache
  const [assetURLs, setAssetURLs] = useState<Map<string, string>>(new Map());
  const [loadingURLs, setLoadingURLs] = useState<Set<string>>(new Set());

  // Search modal
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchingAsset, setSearchingAsset] = useState<PersistedAsset | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load URLs
  useEffect(() => {
    const loadURLs = async () => {
      for (const asset of assets) {
        if (asset.type !== 'text' && !assetURLs.has(asset.id) && !loadingURLs.has(asset.id)) {
          setLoadingURLs(prev => new Set(prev).add(asset.id));
          try {
            const url = await getAssetURL(asset.id);
            setAssetURLs(prev => new Map(prev).set(asset.id, url));
          } catch (error) {
            console.error('Failed to load asset URL:', asset.id, error);
          } finally {
            setLoadingURLs(prev => { const next = new Set(prev); next.delete(asset.id); return next; });
          }
        }
      }
    };
    loadURLs();
  }, [assets, getAssetURL, assetURLs, loadingURLs]);

  const handleDelete = async (id: string) => {
    try {
      await deleteAsset(id);
      setAssetURLs(prev => { const next = new Map(prev); next.delete(id); return next; });
    } catch (error) {
      addNotification('error', 'Failed to delete asset');
    }
  };

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const selectedFiles = Array.from(files);
    let successCount = 0;
    const failedFiles: string[] = [];
    for (const file of selectedFiles) {
      try { await addAsset(file); successCount++; } catch { failedFiles.push(file.name); }
    }
    if (successCount > 0) addNotification('success', `${successCount}/${selectedFiles.length} file(s) uploaded successfully`);
    if (failedFiles.length > 0) {
      const preview = failedFiles.slice(0, 2).join(', ');
      const suffix = failedFiles.length > 2 ? ', ...' : '';
      addNotification('error', `Failed to upload ${failedFiles.length} file(s): ${preview}${suffix}`);
    }
    setIsUploading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  // Expose upload trigger to parent
  useEffect(() => {
    if (onUploadRef && 'current' in onUploadRef) {
      (onUploadRef as React.MutableRefObject<(() => void) | null>).current = triggerFileInput;
    }
    return () => {
      if (onUploadRef && 'current' in onUploadRef) {
        (onUploadRef as React.MutableRefObject<(() => void) | null>).current = null;
      }
    };
  }, [onUploadRef]);

  const handleDragOverZone = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDropZone = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); processFiles(e.dataTransfer.files); };

  const handleSearchForCopies = (asset: PersistedAsset) => {
    if (asset.type === 'text') { addNotification('info', 'Text search is not supported yet'); return; }
    setSearchingAsset(asset);
    setSearchModalOpen(true);
  };

  // Filter
  const activeTabDef = ALL_IP_TABS.find((t) => t.id === activeIPTab) || ALL_IP_TABS[0];
  const filteredAssets = assets
    .filter(a => {
      if (!activeTabDef.filter(a)) return false;
      if (statusFilter === 'protected' && !a.protected) return false;
      if (statusFilter === 'infringement' && a.protected) return false;
      if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'newest') return b.dateAdded - a.dateAdded;
      if (sortOrder === 'oldest') return a.dateAdded - b.dateAdded;
      if (sortOrder === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  if (assetsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-secondary">Loading assets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        accept="image/*,video/*,text/*,.md,.json"
        onChange={handleFileSelect}
      />

      {/* IP Sub-category Tabs */}
      <div className="border-b border-border">
        <div className="flex items-center gap-1 overflow-x-auto pb-px scrollbar-thin">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveIPTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0 border-b-2 ${
                activeIPTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-secondary hover:text-primary hover:border-border'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
              <span
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full min-w-[20px] text-center ${
                  activeIPTab === tab.id ? 'bg-primary text-inverse' : 'bg-surface text-secondary'
                }`}
              >
                {tabCounts[tab.id] ?? 0}
              </span>
            </button>
          ))}
          <button
            onClick={openEditTabs}
            className="p-2 text-secondary hover:text-primary hover:bg-surface rounded transition-colors shrink-0 ml-1"
            title="Edit tabs"
          >
            <Pencil size={14} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full">
          {/* Search */}
          <div className="relative group min-w-[240px] flex-1 sm:flex-none">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-primary transition-colors"
              size={16}
            />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm font-medium text-primary focus:outline-none focus:border-zinc-600 cursor-pointer hover:bg-surface transition-colors min-w-[160px]"
            >
              <option value="all">All Statuses</option>
              <option value="protected">Protected</option>
              <option value="infringement">Infringement</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" size={14} />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm font-medium text-primary focus:outline-none focus:border-zinc-600 cursor-pointer hover:bg-surface transition-colors min-w-[160px]"
            >
              <option value="newest">Newest to Oldest</option>
              <option value="oldest">Oldest to Newest</option>
              <option value="name">Name A–Z</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" size={14} />
          </div>

          <div className="hidden xl:block xl:flex-1" />

          {/* Asset count */}
          <span className="text-sm text-secondary tabular-nums">
            {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''}
          </span>

          {/* View Toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-primary text-inverse'
                  : 'bg-background text-secondary hover:text-primary hover:bg-surface'
              }`}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary text-inverse'
                  : 'bg-background text-secondary hover:text-primary hover:bg-surface'
              }`}
              title="List view"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {filteredAssets.length === 0 && !assetsLoading ? (
        <div className="py-20 text-center border border-dashed border-border rounded-lg">
          <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 text-secondary">
            <Search size={24} />
          </div>
          <p className="text-secondary">No assets found matching your filters.</p>
        </div>
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-secondary text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Date Added</th>
                <th className="text-right px-4 py-3 font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => (
                <tr key={asset.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-zinc-900 flex items-center justify-center shrink-0 overflow-hidden">
                        {asset.type === 'image' && assetURLs.get(asset.id) ? (
                          <img src={assetURLs.get(asset.id)} alt={asset.name} className="w-full h-full object-cover" />
                        ) : asset.type === 'video' ? (
                          <Video size={14} className="text-secondary" />
                        ) : (
                          <FileText size={14} className="text-secondary" />
                        )}
                      </div>
                      <span className="font-medium text-primary truncate max-w-[240px]" title={asset.name}>{asset.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-secondary uppercase text-xs tracking-wider">{asset.type}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                      asset.protected ? 'text-green-500' : 'text-amber-500'
                    }`}>
                      {asset.protected ? <><ShieldCheck size={12} /> Protected</> : <><AlertTriangle size={12} /> Infringement</>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-secondary text-xs tabular-nums">{new Date(asset.dateAdded).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {asset.type === 'image' && (
                        <button
                          onClick={() => handleSearchForCopies(asset)}
                          className="p-1.5 text-secondary hover:text-primary hover:bg-surface rounded transition-colors opacity-0 group-hover:opacity-100"
                          title="Search Web"
                        >
                          <Scan size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(asset.id)}
                        className="p-1.5 text-secondary hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredAssets.map((asset) => {
            const assetUrl = assetURLs.get(asset.id);
            const isLoadingUrl = loadingURLs.has(asset.id);

            return (
              <div key={asset.id} className="group relative bg-surface border border-border rounded-xl overflow-hidden shadow-sm hover:border-primary/30 transition-all animate-in fade-in zoom-in duration-300 flex flex-col min-h-[200px]">

                {/* Preview Area */}
                <div className="flex-1 relative overflow-hidden bg-zinc-900 flex items-center justify-center">

                  {/* Status Badge */}
                  <div className={`absolute top-2 right-2 z-20 px-2 py-0.5 rounded backdrop-blur-md flex items-center gap-1 text-[10px] font-bold border shadow-sm
                    ${asset.protected
                      ? 'bg-green-500/20 border-green-500/30 text-green-400'
                      : 'bg-amber-500/20 border-amber-500/30 text-amber-500'
                    }`}
                  >
                    {asset.protected ? (
                      <><ShieldCheck size={10} /> SECURE</>
                    ) : (
                      <><AlertTriangle size={10} /> INFRINGEMENT</>
                    )}
                  </div>

                  {/* Media Type Icon */}
                  {asset.type !== 'text' && (
                    <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-1.5 rounded backdrop-blur-sm text-white">
                      {asset.type === 'video' ? <Video size={14} /> : <ImageIcon size={14} />}
                    </div>
                  )}

                  {/* Search Button */}
                  {asset.type === 'image' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSearchForCopies(asset); }}
                      className="absolute bottom-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-inverse px-2 py-1 rounded text-xs font-medium flex items-center gap-1 hover:bg-primary/90"
                    >
                      <Scan size={12} /> Search Web
                    </button>
                  )}

                  {isLoadingUrl ? (
                    <div className="flex items-center justify-center w-full h-full">
                      <Loader2 className="animate-spin text-secondary" size={24} />
                    </div>
                  ) : asset.type === 'video' && assetUrl ? (
                    <video src={assetUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                  ) : asset.type === 'image' && assetUrl ? (
                    <img src={assetUrl} alt={asset.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                  ) : (
                    <div className="w-full h-full p-5 flex flex-col bg-background text-primary overflow-hidden relative group-hover:bg-surface transition-colors pt-8">
                      <div className="absolute -right-6 -bottom-6 text-secondary/5 rotate-12 pointer-events-none transition-colors group-hover:text-secondary/10">
                        <FileText size={100} strokeWidth={1} />
                      </div>
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center gap-2 mb-3 opacity-50">
                          <FileText size={12} />
                          <span className="text-[10px] font-mono uppercase tracking-widest">Document</span>
                        </div>
                        <div className="border-t border-dashed border-border/50 w-full mb-3"></div>
                        <p className="text-xs leading-relaxed line-clamp-5 text-secondary group-hover:text-primary transition-colors font-mono">
                          {asset.content || "No preview available."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 bg-background border-t border-border z-10 flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-medium text-primary text-xs truncate flex-1" title={asset.name}>{asset.name}</h4>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(asset.id); }}
                      className="text-secondary hover:text-red-500 transition-colors -mr-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {!asset.protected && asset.sourceUrl && (
                    <a
                      href={asset.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 text-[10px] text-amber-500 hover:text-amber-600 transition-colors truncate w-full bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10"
                    >
                      <ExternalLink size={10} className="shrink-0" />
                      <span className="truncate">{asset.sourceUrl.replace(/^https?:\/\/(www\.)?/, '')}</span>
                    </a>
                  )}

                  <div className="flex justify-between items-center">
                    <p className="text-[10px] text-secondary uppercase tracking-wider">{asset.type}</p>
                    <p className="text-[10px] text-secondary/50">{new Date(asset.dateAdded).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit IP Tabs Modal */}
      <Modal isOpen={isEditTabsOpen} onClose={() => setIsEditTabsOpen(false)} title="Edit IP Tabs">
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-xs font-medium text-secondary uppercase tracking-wider mb-3">Visible Tabs</h3>
            <div className="space-y-1">
              {editTabIds.map((id) => {
                const tab = ALL_IP_TABS.find((t) => t.id === id);
                if (!tab) return null;
                const isAll = id === 'all';
                const isDraggingThis = dragTabId === id;
                const isDragOverThis = dragOverTabId === id;
                return (
                  <div
                    key={id}
                    draggable={!isAll}
                    onDragStart={() => handleDragStart(id)}
                    onDragOver={(e) => handleDragOver(e, id)}
                    onDrop={() => handleDrop(id)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-background transition-all ${
                      isDraggingThis ? 'opacity-40 border-border'
                        : isDragOverThis ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-secondary/50'
                    } ${!isAll ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <GripVertical size={14} className={`shrink-0 ${isAll ? 'text-transparent' : 'text-secondary'}`} />
                    <tab.icon size={14} className="shrink-0 text-secondary" />
                    <span className="flex-1 text-sm font-medium text-primary select-none">{tab.label}</span>
                    <span className="text-xs text-secondary tabular-nums">{tabCounts[tab.id] ?? 0}</span>
                    {!isAll && (
                      <button onClick={() => editRemoveTab(id)} className="p-1 text-secondary hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Remove">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {editHiddenTabs.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-secondary uppercase tracking-wider mb-3">Available Tabs</h3>
              <div className="space-y-1">
                {editHiddenTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => editAddTab(tab.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-border bg-background hover:border-secondary/50 hover:bg-surface transition-colors"
                  >
                    <Plus size={14} className="text-secondary shrink-0" />
                    <tab.icon size={14} className="text-secondary shrink-0" />
                    <span className="flex-1 text-sm text-secondary text-left">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <ShadButton variant="ghost" className="flex-1" onClick={() => setIsEditTabsOpen(false)}>Cancel</ShadButton>
            <ShadButton className="flex-1" onClick={saveEditTabs}>Save Changes</ShadButton>
          </div>
        </div>
      </Modal>

      {/* Search Results Modal */}
      <SearchResultsModal
        isOpen={searchModalOpen}
        onClose={() => { setSearchModalOpen(false); setSearchingAsset(null); }}
        asset={searchingAsset}
      />
    </div>
  );
};

export default ImagesVideos;
