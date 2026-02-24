import React, { useState } from 'react';
import {
  Search, Type, Image, UserCheck, UserX, FileText,
  LayoutDashboard, FileBarChart, Settings, Check, Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CreateBrandModal from './CreateBrandModal';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdminMode?: boolean;
  isExpanded?: boolean;
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

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isAdminMode, isExpanded = false }) => {
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
    { group: 'Overview', items: [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { id: 'search', icon: Search, label: 'Infringements', hasAlert: true },
      ...(isAdminMode ? [{ id: 'admin', icon: Shield, label: 'Admin', hasAlert: true }] : []),
    ]},
    { group: 'Protection', items: [
      { id: 'keywords', icon: Type, label: 'Keywords' },
      { id: 'images', icon: Image, label: 'Assets' },
      { id: 'whitelist', icon: UserCheck, label: 'Whitelist' },
      { id: 'report-bad', icon: UserX, label: 'Takedown', hasAlert: true },
    ]},
    { group: 'Resources', items: [
      { id: 'report-gen', icon: FileBarChart, label: 'Reports', hasAlert: true },
      { id: 'docs', icon: FileText, label: 'Docs' },
    ]}
  ];

  // Map brands from AuthContext for display
  const brandItems = brands.map(b => ({
    id: b.id,
    label: b.name,
    color: getBrandColor(b.name)
  }));

  return (
    <div className={`fixed inset-y-0 left-0 z-50 bg-background border-r border-border flex flex-col py-6 gap-6 transition-all duration-300 ${isExpanded ? 'w-56 px-4' : 'w-16 items-center'}`}>
      {/* Logo */}
      <button
        onClick={() => setActiveTab('dashboard')}
        className={`flex items-center text-primary transition-opacity hover:opacity-80 cursor-pointer ${isExpanded ? 'gap-3 px-2' : 'w-10 h-10 justify-center'}`}
        title="Go to Dashboard"
      >
         <MinimalistDogLogo />
         {isExpanded && <span className="font-serif font-bold text-lg">Brandog</span>}
      </button>

      {/* Nav */}
      <nav className={`flex-1 flex flex-col gap-6 w-full mt-4 ${isExpanded ? 'px-0' : 'px-2'}`}>
        {navItems.map((group, idx) => (
          <div key={idx} className={`flex flex-col gap-2 w-full border-t border-border pt-4 first:border-0 first:pt-0 ${isExpanded ? 'items-stretch' : 'items-center'}`}>
            {isExpanded && (
              <span className="text-[10px] text-secondary uppercase tracking-wider font-medium px-2 mb-1">{group.group}</span>
            )}
            {group.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`p-2.5 rounded-none transition-all duration-200 group relative flex items-center
                  ${isExpanded ? 'w-full gap-3 justify-start' : 'w-10 h-10 justify-center'}
                  ${activeTab === item.id
                    ? 'text-primary bg-surface border border-border'
                    : 'text-secondary hover:text-primary hover:bg-surface/50'}`}
                title={isExpanded ? undefined : item.label}
              >
                <item.icon size={20} strokeWidth={1.5} className="shrink-0" />
                {isExpanded && <span className="text-sm font-medium">{item.label}</span>}

                {item.hasAlert && (
                   <span className={`w-1.5 h-1.5 bg-green-500 rounded-full ${isExpanded ? 'ml-auto' : 'absolute top-2 right-2'}`}></span>
                )}

                {/* Tooltip - only show when collapsed */}
                {!isExpanded && (
                  <span className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-2 py-1 bg-surface border border-border text-primary text-xs pointer-events-none whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className={`mt-auto flex flex-col gap-4 w-full ${isExpanded ? 'px-0 items-stretch' : 'px-2 items-center'}`}>
        {/* Settings */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`p-2.5 rounded-none transition-all duration-200 flex items-center
            ${isExpanded ? 'w-full gap-3 justify-start' : 'w-10 h-10 justify-center'}
            ${activeTab === 'settings'
              ? 'text-primary bg-surface border border-border'
              : 'text-secondary hover:text-primary hover:bg-surface/50'}`}
          title={isExpanded ? undefined : 'Settings'}
        >
          <Settings size={20} strokeWidth={1.5} className="shrink-0" />
          {isExpanded && <span className="text-sm font-medium">Settings</span>}
        </button>

        <div className="w-full h-px bg-border"></div>

        {/* Brand Selector */}
        <div className={`relative ${isExpanded ? 'w-full' : ''}`}>
          {isBrandMenuOpen && (
              <>
              <div className="fixed inset-0 z-10" onClick={() => setIsBrandMenuOpen(false)}></div>
              <div className={`absolute bottom-full mb-2 w-48 bg-background border border-border shadow-xl z-20 animate-in slide-in-from-left-2 fade-in ${isExpanded ? 'left-0' : 'left-0 ml-1'}`}>
                  <div className="p-1">
                      {brandItems.map(brand => (
                          <button
                              key={brand.id}
                              onClick={() => { setCurrentBrandId(brand.id); setIsBrandMenuOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between group transition-colors ${currentBrand?.id === brand.id ? 'bg-surface text-primary' : 'text-secondary hover:text-primary hover:bg-surface/50'}`}
                          >
                              <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${brand.color}`}></div>
                                  {brand.label}
                              </div>
                              {currentBrand?.id === brand.id && <Check size={12} />}
                          </button>
                      ))}
                      <div className="h-px bg-border my-1"></div>
                      <button
                        onClick={() => {
                          setIsBrandMenuOpen(false);
                          setIsCreateBrandModalOpen(true);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-secondary hover:text-primary hover:bg-surface/50 transition-colors"
                      >
                          + Add Brand
                      </button>
                  </div>
              </div>
              </>
          )}

          <button
            onClick={() => setIsBrandMenuOpen(!isBrandMenuOpen)}
            className={`border border-border bg-surface text-primary hover:border-secondary transition-colors flex items-center group relative
              ${isExpanded ? 'w-full p-2.5 gap-3 justify-start' : 'w-10 h-10 justify-center'}`}
          >
             <div className="w-8 h-8 flex items-center justify-center shrink-0 relative">
               <span className="font-serif font-bold text-lg">{currentBrand?.name?.charAt(0) || '?'}</span>
               <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-background border border-border rounded-full flex items-center justify-center">
                   <div className={`w-1.5 h-1.5 rounded-full ${currentBrand ? getBrandColor(currentBrand.name) : 'bg-gray-500'}`}></div>
               </div>
             </div>
             {isExpanded && (
               <div className="flex flex-col items-start min-w-0">
                 <span className="text-sm font-medium truncate">{currentBrand?.name || 'Select Brand'}</span>
                 <span className="text-[10px] text-secondary">Switch brand</span>
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