import React, { useState } from 'react';
import {
  Search, LayoutDashboard, Settings, Check, Command, PanelLeft,
  ShieldOff, BarChart3, FolderOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CreateBrandModal from './CreateBrandModal';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdminMode?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  onSearchClick?: () => void;
}

const MinimalistDogLogo = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 5c2 0 5 2 5 6v3c0 3-2.5 5-5 5s-5-2-5-5v-3c0-4 3-6 5-6z" />
    <path d="M7 11L5 6l4 2" />
    <path d="M17 11l2-5-4 2" />
    <path d="M10 13h.01" />
    <path d="M14 13h.01" />
    <path d="M12 16v1" />
  </svg>
);

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isAdminMode,
  isExpanded = false,
  onToggleExpanded,
  onSearchClick
}) => {
  const { brands, currentBrand, setCurrentBrandId } = useAuth();
  const [isBrandMenuOpen, setIsBrandMenuOpen] = useState(false);
  const [isCreateBrandModalOpen, setIsCreateBrandModalOpen] = useState(false);

  // Generate color based on brand name for consistency
  const getBrandColor = (name: string) => {
    const colors = ['bg-green-500', 'bg-purple-500', 'bg-blue-500', 'bg-orange-500', 'bg-pink-500'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const navItems = [
    { group: null, items: [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { id: 'search', icon: Search, label: 'Infringements', hasAlert: true },
      { id: 'takedowns', icon: ShieldOff, label: 'Takedowns' },
      { id: 'assets', icon: FolderOpen, label: 'Assets' },
      { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    ]},
  ];

  // Map brands from AuthContext for display
  const brandItems = brands.map(b => ({
    id: b.id,
    label: b.name,
    color: getBrandColor(b.name)
  }));

  const handleSearchClick = () => {
    if (onSearchClick) {
      onSearchClick();
    } else {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    }
  };

  return (
    <div className={`fixed inset-y-0 left-0 z-50 bg-sidebar flex flex-col py-4 transition-all duration-300 ${isExpanded ? 'w-64 px-4' : 'w-16 items-center px-2'}`}>
      {/* Header: Logo + Collapse Button */}
      <div className={`flex items-center mb-4 ${isExpanded ? 'justify-between' : 'flex-col gap-3'}`}>
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center text-sidebar-primary transition-opacity hover:opacity-80 cursor-pointer ${isExpanded ? 'gap-3' : ''}`}
          title="Go to Dashboard"
        >
          {/* Square logo with rounded corners */}
          <div className="w-9 h-9 bg-sidebar-surface border border-sidebar-border rounded-lg flex items-center justify-center">
            <MinimalistDogLogo />
          </div>
          {isExpanded && (
            <div className="flex flex-col items-start">
              <span className="font-semibold text-sm leading-tight">Brandog</span>
              <span className="text-[10px] text-sidebar-secondary leading-tight">v1.0</span>
            </div>
          )}
        </button>

        {/* Collapse/Expand Button - same icon for both states */}
        {onToggleExpanded && (
          <button
            onClick={onToggleExpanded}
            className="p-1.5 text-sidebar-secondary hover:text-sidebar-primary hover:bg-sidebar-surface rounded-lg transition-colors"
            title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <PanelLeft size={18} />
          </button>
        )}
      </div>

      {/* Search Bar */}
      {isExpanded ? (
        <button
          onClick={handleSearchClick}
          className="mb-4 flex items-center gap-2 px-3 py-2.5 bg-sidebar-surface border border-sidebar-border rounded-lg text-sidebar-secondary hover:text-sidebar-primary hover:border-sidebar-secondary/50 transition-colors cursor-pointer group"
        >
          <Search size={14} />
          <span className="text-sm flex-1 text-left">Search...</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] bg-sidebar-bg border border-sidebar-border px-1 py-0.5 rounded text-sidebar-secondary/70 font-mono flex items-center justify-center">
              <Command size={10} />
            </span>
            <span className="text-[10px] bg-sidebar-bg border border-sidebar-border px-1.5 py-0.5 rounded text-sidebar-secondary/70 font-mono">
              K
            </span>
          </div>
        </button>
      ) : (
        <button
          onClick={handleSearchClick}
          className="mb-4 w-10 h-10 flex items-center justify-center text-sidebar-secondary hover:text-sidebar-primary hover:bg-sidebar-surface rounded-lg transition-colors"
          title="Search (⌘K)"
        >
          <Search size={18} />
        </button>
      )}

      {/* Nav */}
      <nav className={`flex-1 flex flex-col gap-4 w-full ${isExpanded ? '' : 'items-center'}`}>
        {navItems.map((group, idx) => (
          <React.Fragment key={idx}>
          <div className={`flex flex-col gap-1 w-full ${isExpanded ? 'items-stretch' : 'items-center'}`}>
            {isExpanded && group.group && (
              <span className="text-[10px] text-sidebar-secondary uppercase tracking-wider font-medium px-2 mb-1">{group.group}</span>
            )}
            {group.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`p-2 rounded-lg transition-all duration-200 group relative flex items-center
                  ${isExpanded ? 'w-full gap-2.5 justify-start' : 'w-9 h-9 justify-center'}
                  ${activeTab === item.id
                    ? 'text-sidebar-primary bg-sidebar-surface'
                    : 'text-sidebar-secondary hover:text-sidebar-primary hover:bg-sidebar-surface/50'}`}
                title={isExpanded ? undefined : item.label}
              >
                <item.icon size={16} strokeWidth={1.5} className="shrink-0" />
                {isExpanded && <span className="text-xs font-medium">{item.label}</span>}

                {item.hasAlert && (
                   <span className={`w-1.5 h-1.5 bg-green-500 rounded-full ${isExpanded ? 'ml-auto' : 'absolute top-1.5 right-1.5'}`}></span>
                )}

                {/* Tooltip - only show when collapsed */}
                {!isExpanded && (
                  <span className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-2 py-1 bg-sidebar-surface border border-sidebar-border text-sidebar-primary text-xs pointer-events-none whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                    {item.label}
                  </span>
                )}
              </button>
            ))}
          </div>
          {'hasSeparator' in group && group.hasSeparator && <div className="w-full h-px bg-sidebar-border my-1"></div>}
          </React.Fragment>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className={`mt-auto flex flex-col gap-3 w-full ${isExpanded ? '' : 'items-center'}`}>
        {/* Settings */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`p-2 rounded-lg transition-all duration-200 flex items-center
            ${isExpanded ? 'w-full gap-2.5 justify-start' : 'w-9 h-9 justify-center'}
            ${activeTab === 'settings'
              ? 'text-sidebar-primary bg-sidebar-surface'
              : 'text-sidebar-secondary hover:text-sidebar-primary hover:bg-sidebar-surface/50'}`}
          title={isExpanded ? undefined : 'Settings'}
        >
          <Settings size={16} strokeWidth={1.5} className="shrink-0" />
          {isExpanded && <span className="text-xs font-medium">Settings</span>}
        </button>

        <div className="w-full h-px bg-sidebar-border"></div>

        {/* Brand Selector */}
        <div className={`relative ${isExpanded ? 'w-full' : ''}`}>
          {isBrandMenuOpen && (
              <>
              <div className="fixed inset-0 z-10" onClick={() => setIsBrandMenuOpen(false)}></div>
              <div className={`absolute bottom-full mb-2 w-48 bg-sidebar-surface border border-sidebar-border shadow-xl z-20 animate-in slide-in-from-left-2 fade-in rounded-lg ${isExpanded ? 'left-0' : 'left-0 ml-1'}`}>
                  <div className="p-1">
                      {brandItems.map(brand => (
                          <button
                              key={brand.id}
                              onClick={() => { setCurrentBrandId(brand.id); setIsBrandMenuOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between group transition-colors rounded-md ${currentBrand?.id === brand.id ? 'bg-sidebar-accent/20 text-sidebar-primary' : 'text-sidebar-secondary hover:text-sidebar-primary hover:bg-sidebar-bg'}`}
                          >
                              <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${brand.color}`}></div>
                                  {brand.label}
                              </div>
                              {currentBrand?.id === brand.id && <Check size={12} />}
                          </button>
                      ))}
                      <div className="h-px bg-sidebar-border my-1"></div>
                      <button
                        onClick={() => {
                          setIsBrandMenuOpen(false);
                          setIsCreateBrandModalOpen(true);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-sidebar-secondary hover:text-sidebar-primary hover:bg-sidebar-bg transition-colors rounded-md"
                      >
                          + Add Brand
                      </button>
                  </div>
              </div>
              </>
          )}

          <button
            onClick={() => setIsBrandMenuOpen(!isBrandMenuOpen)}
            className={`border border-sidebar-border bg-sidebar-surface text-sidebar-primary hover:border-sidebar-secondary/50 transition-colors flex items-center group relative rounded-lg
              ${isExpanded ? 'w-full p-2.5 gap-3 justify-start' : 'w-10 h-10 justify-center'}`}
          >
             <div className="w-8 h-8 flex items-center justify-center shrink-0 relative">
               <span className="font-serif font-bold text-lg">{currentBrand?.name?.charAt(0) || '?'}</span>
               <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-sidebar border border-sidebar-border rounded-full flex items-center justify-center">
                   <div className={`w-1.5 h-1.5 rounded-full ${currentBrand ? getBrandColor(currentBrand.name) : 'bg-gray-500'}`}></div>
               </div>
             </div>
             {isExpanded && (
               <div className="flex flex-col items-start min-w-0">
                 <span className="text-sm font-medium truncate">{currentBrand?.name || 'Select Brand'}</span>
                 <span className="text-[10px] text-sidebar-secondary">Switch brand</span>
               </div>
             )}
          </button>
        </div>
      </div>

      <CreateBrandModal
        isOpen={isCreateBrandModalOpen}
        onClose={() => setIsCreateBrandModalOpen(false)}
      />
    </div>
  );
};

export default Sidebar;
