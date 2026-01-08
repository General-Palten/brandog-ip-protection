import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import ToastContainer from './components/Toast';
import CommandPalette from './components/CommandPalette';
import { Search, Sun, Moon, Bell, User, Shield, CreditCard, LogOut, Command } from 'lucide-react';

// Views
import SearchCopycats from './components/views/SearchCopycats';
import Keywords from './components/views/Keywords';
import ImagesVideos from './components/views/ImagesVideos';
import Whitelist from './components/views/Whitelist';
import ReportBadActor from './components/views/ReportBadActor';
import IPDocuments from './components/views/IPDocuments';
import DashboardAnalytics from './components/views/DashboardAnalytics';
import ReportGenerator from './components/views/ReportGenerator';
import Settings from './components/views/Settings';

const MainLayout: React.FC = () => {
  const [activeSidebarTab, setActiveSidebarTab] = useState('dashboard');
  const [settingsSection, setSettingsSection] = useState('profile');
  const { theme, toggleTheme, recentActivity } = useDashboard();
  const [currentBrand, setCurrentBrand] = useState('PrimeTrendz');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleProfileNavigation = (section: string) => {
    setSettingsSection(section);
    setActiveSidebarTab('settings');
    setIsProfileOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-background text-primary font-sans relative selection:bg-surface selection:text-primary">
      <Sidebar 
        activeTab={activeSidebarTab} 
        setActiveTab={setActiveSidebarTab}
        currentBrand={currentBrand}
        setCurrentBrand={setCurrentBrand}
      />
      
      {/* Global Command Palette */}
      <CommandPalette navigate={setActiveSidebarTab} />
      
      {/* Main Content Area */}
      <div className="flex-1 ml-16 flex flex-col min-h-screen relative transition-colors duration-300">
        
        {/* Top Bar - Solid background to prevent transparency on scroll */}
        <header className="sticky top-0 z-40 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
           {/* Left: Search */}
           <div className="flex items-center gap-4 flex-1">
              <div 
                className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-none text-secondary w-full max-w-sm group focus-within:border-primary/50 focus-within:text-primary transition-colors cursor-text"
                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              >
                  <Search size={14} />
                  <span className="text-sm text-secondary/70">Search...</span>
                  <div className="flex gap-1 ml-auto">
                    <span className="text-[10px] bg-background border border-border px-1.5 rounded-none text-secondary/70 font-mono flex items-center">
                        <Command size={8} className="mr-0.5"/>K
                    </span>
                  </div>
              </div>
           </div>

           {/* Right: Actions */}
           <div className="flex items-center gap-3">
              {/* Notification Bell with Dropdown */}
              <div className="relative">
                  <button 
                    onClick={() => {
                        setIsNotificationsOpen(!isNotificationsOpen);
                        if(isNotificationsOpen === false) {
                            setHasUnreadNotifications(false);
                        }
                    }}
                    className={`p-2 transition-colors relative ${isNotificationsOpen ? 'text-primary bg-surface' : 'text-secondary hover:text-primary'}`}
                    title="Updates"
                  >
                     <Bell size={18} />
                     {hasUnreadNotifications && (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full border border-background animate-pulse"></span>
                     )}
                  </button>

                  {isNotificationsOpen && (
                    <>
                        <div className="fixed inset-0 z-30" onClick={() => setIsNotificationsOpen(false)}></div>
                        <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-border shadow-xl z-40 animate-in slide-in-from-top-2 fade-in duration-200">
                            <div className="p-3 border-b border-border flex justify-between items-center bg-surface/30">
                                <span className="font-medium text-sm">Notifications</span>
                                <span className="text-[10px] text-secondary uppercase tracking-wider font-mono">Recent</span>
                            </div>
                            <div className="max-h-[320px] overflow-y-auto">
                                {recentActivity.length > 0 ? (
                                    recentActivity.map(log => (
                                        <div key={log.id} className="p-3 border-b border-border last:border-0 hover:bg-surface/50 transition-colors flex gap-3 group">
                                            <div className="text-lg pt-0.5">{log.icon || '•'}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <p className="text-xs font-medium text-primary truncate pr-2">{log.action}</p>
                                                    <span className="text-[9px] text-secondary/50 font-mono shrink-0 whitespace-nowrap">
                                                        {new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-secondary mt-0.5 leading-snug line-clamp-2 group-hover:text-primary/80 transition-colors">{log.target}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-6 text-center text-xs text-secondary">No recent notifications</div>
                                )}
                            </div>
                            <div className="p-2 border-t border-border bg-surface/50 text-center">
                                <button className="text-[10px] font-medium uppercase tracking-wider text-secondary hover:text-primary transition-colors">View All Activity</button>
                            </div>
                        </div>
                    </>
                  )}
              </div>

              <button 
                  onClick={toggleTheme}
                  className="p-2 text-secondary hover:text-primary transition-colors"
                  title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              
              <div className="relative">
                <button 
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="w-8 h-8 rounded-none bg-surface border border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-secondary transition-colors"
                >
                    <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="Profile" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
                </button>

                {isProfileOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setIsProfileOpen(false)}></div>
                      <div className="absolute right-0 top-full mt-2 w-56 bg-background border border-border shadow-xl z-40 animate-in slide-in-from-top-2 fade-in duration-200 flex flex-col p-1">
                          <div className="px-3 py-2 border-b border-border mb-1">
                              <p className="text-sm font-medium text-primary">Viktor Vaughn</p>
                              <p className="text-xs text-secondary">viktor@brandog.co</p>
                          </div>
                          
                          <button onClick={() => handleProfileNavigation('profile')} className="flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-surface text-left transition-colors">
                              <User size={16} />
                              <span>Profile</span>
                          </button>
                          <button onClick={() => handleProfileNavigation('notifications')} className="flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-surface text-left transition-colors">
                              <Bell size={16} />
                              <span>Notifications</span>
                          </button>
                          <button onClick={() => handleProfileNavigation('security')} className="flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-surface text-left transition-colors">
                              <Shield size={16} />
                              <span>Security</span>
                          </button>
                          <button onClick={() => handleProfileNavigation('billing')} className="flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-surface text-left transition-colors">
                              <CreditCard size={16} />
                              <span>Billing</span>
                          </button>
                          
                          <div className="h-px bg-border my-1"></div>
                          
                          <button onClick={() => setIsProfileOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 text-left transition-colors">
                              <LogOut size={16} />
                              <span>Sign Out</span>
                          </button>
                      </div>
                    </>
                )}
              </div>
           </div>
        </header>

        <main className="flex-1 p-6 lg:p-10 pb-32 max-w-[1600px] mx-auto w-full">
          {/* Keep-Alive Pattern */}
          <div className={activeSidebarTab === 'search' ? 'block animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
            <SearchCopycats />
          </div>
          <div className={activeSidebarTab === 'keywords' ? 'block animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
            <Keywords />
          </div>
          <div className={activeSidebarTab === 'images' ? 'block animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
            <ImagesVideos />
          </div>
          <div className={activeSidebarTab === 'whitelist' ? 'block animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
            <Whitelist />
          </div>
          <div className={activeSidebarTab === 'report-bad' ? 'block animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
            <ReportBadActor />
          </div>
          <div className={activeSidebarTab === 'docs' ? 'block animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
            <IPDocuments />
          </div>
          <div className={activeSidebarTab === 'dashboard' ? 'block animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
            <DashboardAnalytics />
          </div>
          <div className={activeSidebarTab === 'report-gen' ? 'block animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
            <ReportGenerator />
          </div>
          <div className={activeSidebarTab === 'settings' ? 'block animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
            <Settings initialSection={settingsSection} />
          </div>
        </main>
      </div>

      <ToastContainer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <DashboardProvider>
      <MainLayout />
    </DashboardProvider>
  );
};

export default App;