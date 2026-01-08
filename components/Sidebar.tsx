import React, { useState } from 'react';
import { 
  Search, Type, Image, UserCheck, UserX, FileText, 
  LayoutDashboard, FileBarChart, Settings, Check
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentBrand: string;
  setCurrentBrand: (brand: string) => void;
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

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, currentBrand, setCurrentBrand }) => {
  const [isBrandMenuOpen, setIsBrandMenuOpen] = useState(false);

  const navItems = [
    { group: 'Overview', items: [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { id: 'search', icon: Search, label: 'Search', hasAlert: true },
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

  const brands = [
    { id: 'PrimeTrendz', label: 'PrimeTrendz', color: 'bg-green-500' },
    { id: 'LuxeLife', label: 'LuxeLife', color: 'bg-purple-500' }
  ];

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-16 bg-background border-r border-border flex flex-col items-center py-6 gap-6">
      {/* Logo */}
      <button 
        onClick={() => setActiveTab('dashboard')}
        className="w-10 h-10 flex items-center justify-center text-primary transition-opacity hover:opacity-80 cursor-pointer"
        title="Go to Dashboard"
      >
         <MinimalistDogLogo />
      </button>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-8 w-full px-2 mt-4">
        {navItems.map((group, idx) => (
          <div key={idx} className="flex flex-col gap-2 items-center w-full border-t border-border pt-4 first:border-0 first:pt-0">
            {group.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`p-2.5 rounded-none transition-all duration-200 group relative w-10 h-10 flex items-center justify-center
                  ${activeTab === item.id 
                    ? 'text-primary bg-surface border border-border' 
                    : 'text-secondary hover:text-primary hover:bg-surface/50'}`}
                title={item.label}
              >
                <item.icon size={20} strokeWidth={1.5} />
                
                {item.hasAlert && (
                   <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                )}
                
                {/* Tooltip */}
                <span className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-2 py-1 bg-surface border border-border text-primary text-xs pointer-events-none whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="mt-auto flex flex-col gap-4 items-center w-full px-2">
        {/* Settings - Moved Up */}
        <button 
          onClick={() => setActiveTab('settings')}
          className={`p-2.5 rounded-none transition-all duration-200 w-10 h-10 flex items-center justify-center
            ${activeTab === 'settings' 
              ? 'text-primary bg-surface border border-border' 
              : 'text-secondary hover:text-primary hover:bg-surface/50'}`}
          title="Settings"
        >
          <Settings size={20} strokeWidth={1.5} />
        </button>

        <div className="w-full h-px bg-border"></div>

        {/* Brand Selector */}
        <div className="relative">
          {isBrandMenuOpen && (
              <>
              <div className="fixed inset-0 z-10" onClick={() => setIsBrandMenuOpen(false)}></div>
              <div className="absolute bottom-full left-0 mb-2 ml-1 w-48 bg-background border border-border shadow-xl z-20 animate-in slide-in-from-left-2 fade-in">
                  <div className="p-1">
                      {brands.map(brand => (
                          <button 
                              key={brand.id}
                              onClick={() => { setCurrentBrand(brand.id); setIsBrandMenuOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between group transition-colors ${currentBrand === brand.id ? 'bg-surface text-primary' : 'text-secondary hover:text-primary hover:bg-surface/50'}`}
                          >
                              <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${brand.color}`}></div>
                                  {brand.label}
                              </div>
                              {currentBrand === brand.id && <Check size={12} />}
                          </button>
                      ))}
                      <div className="h-px bg-border my-1"></div>
                      <button className="w-full text-left px-3 py-2 text-xs text-secondary hover:text-primary hover:bg-surface/50 transition-colors">
                          + Add Brand
                      </button>
                  </div>
              </div>
              </>
          )}
          
          <button 
            onClick={() => setIsBrandMenuOpen(!isBrandMenuOpen)}
            className="w-10 h-10 border border-border bg-surface text-primary hover:border-secondary transition-colors flex items-center justify-center group relative"
          >
             <span className="font-serif font-bold text-lg">{currentBrand.charAt(0)}</span>
             
             <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-background border border-border rounded-full flex items-center justify-center">
                 <div className={`w-1.5 h-1.5 rounded-full ${brands.find(b => b.id === currentBrand)?.color || 'bg-gray-500'}`}></div>
             </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;