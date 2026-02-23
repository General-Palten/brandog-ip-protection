import React, { useState, useMemo } from 'react';
import StatsCard from '../StatsCard';
import InfringementCard from '../InfringementCard';
import CaseDetailModal from '../CaseDetailModal';
import { useDashboard } from '../../context/DashboardContext';
import { InfringementItem } from '../../types';
import { 
  Flag, Users, DollarSign, Search, Settings, Archive, ChevronDown, ChevronsUpDown
} from 'lucide-react';

const SearchCopycats: React.FC = () => {
  const { infringements, reportInfringement, dismissInfringement, undoInfringementStatus, takedownRequests } = useDashboard();

  // Count cases with unread messages (for the "In Progress" badge)
  const inProgressWithUnread = takedownRequests.filter(req => {
    const infringement = infringements.find(i => i.id === req.caseId);
    const isInProgress = infringement && (infringement.status === 'pending_review' || infringement.status === 'in_progress');
    const hasUnread = (req.updates || []).some(u => !u.isRead);
    return isInProgress && hasUnread;
  }).length;
  
  // Toolbar State
  const [selectedPlatformTab, setSelectedPlatformTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [countryFilter, setCountryFilter] = useState('all');
  const [selectionMode, setSelectionMode] = useState(false);
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InfringementItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'pending' | 'in_progress' | 'resolved'>('pending');

  const totalPotentialInfringers = infringements.filter(i => i.status === 'detected').length;
  const combinedTraffic = infringements.reduce((acc, curr) => acc + curr.siteVisitors, 0);
  const revenueLoss = infringements.reduce((acc, curr) => acc + curr.revenueLost, 0);

  const uniqueCountries = useMemo(() => {
    return Array.from(new Set(infringements.map(i => i.country))).sort();
  }, [infringements]);

  const handleReport = (id: string) => reportInfringement(id);
  const handleDismiss = (id: string) => {
    dismissInfringement(id);
  };
  
  const openDetail = (item: InfringementItem) => {
      setSelectedItem(item);
      setIsDetailOpen(true);
  };

  const handleCalculate = () => {
    setIsCalculating(true);
    setTimeout(() => setIsCalculating(false), 1500);
  };

  const filteredItems = useMemo(() => {
    let items = infringements.filter(item => {
      // New Detections shows only 'detected' status
      // In Progress shows 'pending_review' and 'in_progress' status
      // Processed shows 'resolved' and 'rejected' status
      if (viewMode === 'pending' && item.status !== 'detected') return false;
      if (viewMode === 'in_progress' && item.status !== 'pending_review' && item.status !== 'in_progress') return false;
      if (viewMode === 'resolved' && item.status !== 'resolved' && item.status !== 'rejected') return false;
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
  }, [infringements, selectedPlatformTab, searchQuery, viewMode, countryFilter, sortOrder]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
         <div>
            <h1 className="font-serif text-3xl text-primary font-medium">Search Copycats</h1>
            <p className="text-secondary mt-1 text-sm">Real-time scan results from your active keywords.</p>
         </div>
         <div className="flex bg-surface border border-border p-1 rounded-lg">
             <button
                onClick={() => setViewMode('pending')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'pending' ? 'bg-zinc-800 text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
             >
                 New Detections
             </button>
             <button
                onClick={() => setViewMode('in_progress')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${viewMode === 'in_progress' ? 'bg-zinc-800 text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
             >
                 In Progress
                 {inProgressWithUnread > 0 && (
                   <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-500 text-white rounded-full min-w-[18px] text-center">
                     {inProgressWithUnread}
                   </span>
                 )}
             </button>
             <button
                onClick={() => setViewMode('resolved')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'resolved' ? 'bg-zinc-800 text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
             >
                 Processed
             </button>
        </div>
      </div>

      {/* STATS CARDS */}
      {viewMode === 'pending' && (
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

      {/* TOOLBAR */}
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between mb-6">
        <div className="flex flex-wrap items-center gap-3 w-full">
            
            {/* Select Multiple */}
            <button 
                onClick={() => setSelectionMode(!selectionMode)}
                className={`px-4 py-2.5 bg-background border border-border rounded-lg text-sm font-medium transition-colors ${selectionMode ? 'bg-primary text-inverse border-primary' : 'text-primary hover:bg-surface'}`}
            >
                {selectionMode ? 'Cancel Selection' : 'Select Multiple'}
            </button>

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
                 className="appearance-none pl-4 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm font-medium text-primary focus:outline-none focus:border-zinc-600 cursor-pointer hover:bg-surface transition-colors min-w-[160px]"
              >
                <option value="all">Filter by Platform</option>
                <option value="social">Social</option>
                <option value="marketplace">Marketplace</option>
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

      {/* Grid */}
      {filteredItems.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-border rounded-lg">
             <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 text-secondary">
                 <Search size={24} />
             </div>
             <p className="text-secondary">No copycats found matching your filters.</p>
          </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map(item => (
            <div key={item.id} onClick={() => openDetail(item)} className="cursor-pointer relative group">
                <InfringementCard 
                    item={item} 
                    onReport={(e) => { e.stopPropagation(); handleReport(item.id); }}
                    onDismiss={(e) => { e.stopPropagation(); handleDismiss(item.id); }}
                />
                {selectionMode && (
                    <div className="absolute top-2 right-2 z-10 p-2">
                        <input type="checkbox" className="w-5 h-5 accent-primary cursor-pointer" onClick={(e) => e.stopPropagation()} />
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
        onDismiss={handleDismiss}
      />
    </div>
  );
};

export default SearchCopycats;