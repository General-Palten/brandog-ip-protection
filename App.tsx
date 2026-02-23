import React, { useState, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ToastContainer from './components/Toast';
import CommandPalette from './components/CommandPalette';
import CaseDetailModal from './components/CaseDetailModal';
import AuthScreen from './components/AuthScreen';
import OnboardingScreen from './components/OnboardingScreen';
import { InfringementItem } from './types';
import { Search, Sun, Moon, Bell, User, Shield, CreditCard, LogOut, Command, Building2, Scale, ArrowRight, ExternalLink, Loader2 } from 'lucide-react';
import { isSupabaseConfigured } from './lib/supabase';

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
import AdminDashboard from './components/views/AdminDashboard';
import MarketingSite from './components/site/MarketingSite';

// Role Selection / Login Screen
type UserRole = 'brand' | 'admin' | null;

const RoleSelectionScreen: React.FC<{ onSelectRole: (role: UserRole) => void }> = ({ onSelectRole }) => {
  const [hoveredRole, setHoveredRole] = useState<UserRole>(null);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Logo / Brand */}
      <div className="mb-12 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center">
            <Shield className="text-primary" size={28} />
          </div>
        </div>
        <h1 className="text-3xl font-serif font-medium text-primary mb-2">Brandog</h1>
        <p className="text-secondary text-sm">IP Protection Platform</p>
      </div>

      {/* Role Selection Cards */}
      <div className="w-full max-w-2xl">
        <p className="text-center text-secondary text-sm mb-6">Select your role to continue</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Brand Owner Card */}
          <button
            onClick={() => onSelectRole('brand')}
            onMouseEnter={() => setHoveredRole('brand')}
            onMouseLeave={() => setHoveredRole(null)}
            className={`p-6 border rounded-lg text-left transition-all duration-200 group ${
              hoveredRole === 'brand'
                ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                : 'border-border bg-surface/30 hover:bg-surface'
            }`}
          >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-colors ${
              hoveredRole === 'brand' ? 'bg-primary/20' : 'bg-surface border border-border'
            }`}>
              <Building2 size={24} className={hoveredRole === 'brand' ? 'text-primary' : 'text-secondary'} />
            </div>
            <h3 className="text-lg font-medium text-primary mb-2 flex items-center gap-2">
              Brand Owner
              <ArrowRight size={16} className={`transition-transform ${hoveredRole === 'brand' ? 'translate-x-1' : ''}`} />
            </h3>
            <p className="text-sm text-secondary leading-relaxed">
              Monitor your brand, detect infringements, and request takedowns for your intellectual property.
            </p>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-secondary">
                <span className="text-primary font-medium">Demo user:</span> Viktor Vaughn
              </p>
            </div>
          </button>

          {/* Admin / Lawyer Card */}
          <button
            onClick={() => onSelectRole('admin')}
            onMouseEnter={() => setHoveredRole('admin')}
            onMouseLeave={() => setHoveredRole(null)}
            className={`p-6 border rounded-lg text-left transition-all duration-200 group ${
              hoveredRole === 'admin'
                ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                : 'border-border bg-surface/30 hover:bg-surface'
            }`}
          >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-colors ${
              hoveredRole === 'admin' ? 'bg-primary/20' : 'bg-surface border border-border'
            }`}>
              <Scale size={24} className={hoveredRole === 'admin' ? 'text-primary' : 'text-secondary'} />
            </div>
            <h3 className="text-lg font-medium text-primary mb-2 flex items-center gap-2">
              Admin / Lawyer
              <ArrowRight size={16} className={`transition-transform ${hoveredRole === 'admin' ? 'translate-x-1' : ''}`} />
            </h3>
            <p className="text-sm text-secondary leading-relaxed">
              Review takedown requests, process cases, and send updates to brand owners.
            </p>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-secondary">
                <span className="text-primary font-medium">Demo user:</span> Sarah Chen (Legal)
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-xs text-secondary/60">
          This is a demo environment. No real data is being processed.
        </p>
      </div>
    </div>
  );
};

interface MainLayoutProps {
  userRole: UserRole;
  onLogout: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ userRole, onLogout }) => {
  const isDevelopment = import.meta.env.DEV;
  const [devRoleOverride, setDevRoleOverride] = useState<UserRole>(null);
  const effectiveRole = isDevelopment && devRoleOverride ? devRoleOverride : userRole;
  const isAdminMode = effectiveRole === 'admin';
  const [activeSidebarTab, setActiveSidebarTab] = useState(isAdminMode ? 'admin' : 'dashboard');
  const [settingsSection, setSettingsSection] = useState('profile');
  const { theme, toggleTheme, recentActivity, infringements, reportInfringement, dismissInfringement } = useDashboard();
  const { user, profile } = useAuth();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedNotificationCase, setSelectedNotificationCase] = useState<InfringementItem | null>(null);

  useEffect(() => {
    if (!isAdminMode && activeSidebarTab === 'admin') {
      setActiveSidebarTab('dashboard');
    }
  }, [isAdminMode, activeSidebarTab]);

  const handleDevRoleToggle = () => {
    const currentRole = devRoleOverride || userRole;
    const nextRole: UserRole = currentRole === 'admin' ? 'brand' : 'admin';
    setDevRoleOverride(nextRole);

    if (nextRole === 'admin') {
      setActiveSidebarTab('admin');
    } else if (activeSidebarTab === 'admin') {
      setActiveSidebarTab('dashboard');
    }
  };

  // Extract case ID from notification target text and find the infringement
  const handleNotificationClick = (target: string) => {
    // Try to extract case ID from patterns like "#mock_176", "#search_1", "Case #abc123"
    const caseIdMatch = target.match(/#([a-zA-Z0-9_-]+)/);
    if (caseIdMatch) {
      const caseId = caseIdMatch[1];
      // Find infringement that matches (could be full ID or partial)
      const foundCase = infringements.find(inf =>
        inf.id === caseId ||
        inf.id.includes(caseId) ||
        caseId.includes(inf.id.slice(0, 8))
      );
      if (foundCase) {
        setSelectedNotificationCase(foundCase);
        setIsNotificationsOpen(false);
      }
    }
  };

  // Check if notification is related to a case (clickable)
  const isCaseRelatedNotification = (target: string) => {
    return target.includes('#') || target.toLowerCase().includes('case');
  };

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
        isAdminMode={isAdminMode}
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
              {isDevelopment && (
                <button
                  onClick={handleDevRoleToggle}
                  className="px-2.5 py-1.5 text-xs border border-border bg-surface text-secondary hover:text-primary hover:border-secondary transition-colors flex items-center gap-2"
                  title="Development role toggle"
                >
                  <span className="font-mono uppercase tracking-wider">Admin/Member</span>
                  <span className={`px-1.5 py-0.5 rounded font-mono uppercase ${
                    isAdminMode
                      ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                      : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                  }`}>
                    {isAdminMode ? 'Admin' : 'Member'}
                  </span>
                </button>
              )}

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
                                    recentActivity.map(log => {
                                        const isClickable = isCaseRelatedNotification(log.target);
                                        return (
                                          <button
                                            key={log.id}
                                            onClick={() => isClickable && handleNotificationClick(log.target)}
                                            disabled={!isClickable}
                                            className={`w-full p-3 border-b border-border last:border-0 transition-colors flex gap-3 group text-left ${
                                              isClickable
                                                ? 'hover:bg-surface/50 cursor-pointer'
                                                : 'cursor-default opacity-80'
                                            }`}
                                          >
                                              <div className="text-lg pt-0.5">{log.icon || '•'}</div>
                                              <div className="flex-1 min-w-0">
                                                  <div className="flex justify-between items-start">
                                                      <p className="text-xs font-medium text-primary truncate pr-2">{log.action}</p>
                                                      <span className="text-[9px] text-secondary/50 font-mono shrink-0 whitespace-nowrap">
                                                          {new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                      </span>
                                                  </div>
                                                  <p className="text-[11px] text-secondary mt-0.5 leading-snug line-clamp-2 group-hover:text-primary/80 transition-colors">{log.target}</p>
                                                  {isClickable && (
                                                    <span className="text-[10px] text-primary mt-1 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                      View case <ExternalLink size={10} />
                                                    </span>
                                                  )}
                                              </div>
                                          </button>
                                        );
                                    })
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
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium text-primary">
                                  {profile?.fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                                </p>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${
                                  isAdminMode
                                    ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                                    : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                }`}>
                                  {isAdminMode ? 'Admin' : 'Brand'}
                                </span>
                              </div>
                              <p className="text-xs text-secondary">
                                {user?.email || 'No email'}
                              </p>
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
                          
                          <button
                            onClick={() => {
                              setIsProfileOpen(false);
                              onLogout();
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 text-left transition-colors"
                          >
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
          {activeSidebarTab === 'search' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <SearchCopycats />
            </div>
          )}
          {activeSidebarTab === 'keywords' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <Keywords />
            </div>
          )}
          {activeSidebarTab === 'images' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <ImagesVideos />
            </div>
          )}
          {activeSidebarTab === 'whitelist' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <Whitelist />
            </div>
          )}
          {activeSidebarTab === 'report-bad' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <ReportBadActor />
            </div>
          )}
          {activeSidebarTab === 'docs' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <IPDocuments />
            </div>
          )}
          {activeSidebarTab === 'dashboard' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <DashboardAnalytics />
            </div>
          )}
          {activeSidebarTab === 'report-gen' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <ReportGenerator />
            </div>
          )}
          {activeSidebarTab === 'settings' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <Settings initialSection={settingsSection} />
            </div>
          )}
          {isAdminMode && activeSidebarTab === 'admin' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <AdminDashboard />
            </div>
          )}
        </main>
      </div>

      <ToastContainer />

      {/* Case Detail Modal from Notification Click */}
      <CaseDetailModal
        item={selectedNotificationCase}
        isOpen={!!selectedNotificationCase}
        onClose={() => setSelectedNotificationCase(null)}
        onConfirm={(id) => {
          reportInfringement(id);
          setSelectedNotificationCase(null);
        }}
        onDismiss={(id) => {
          dismissInfringement(id);
          setSelectedNotificationCase(null);
        }}
      />
    </div>
  );
};

// Loading screen component
const LoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center">
    <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center mb-4">
      <Shield className="text-primary" size={28} />
    </div>
    <Loader2 className="animate-spin text-primary mb-2" size={24} />
    <p className="text-secondary text-sm">Loading...</p>
  </div>
);

// Inner app component that uses auth context
const AppContent: React.FC = () => {
  const { user, profile, loading, isConfigured, signOut, brands } = useAuth();
  const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true';
  const bypassRole = import.meta.env.VITE_BYPASS_ROLE === 'admin' ? 'admin' : 'brand';

  // Legacy role state for demo mode (when Supabase not configured)
  const [demoRole, setDemoRole] = useState<UserRole>(() => {
    const saved = sessionStorage.getItem('userRole');
    return (saved === 'brand' || saved === 'admin') ? saved : null;
  });

  if (bypassAuth) {
    return (
      <DashboardProvider>
        <MainLayout userRole={bypassRole} onLogout={() => undefined} />
      </DashboardProvider>
    );
  }

  const handleSelectDemoRole = (role: UserRole) => {
    setDemoRole(role);
    if (role) {
      sessionStorage.setItem('userRole', role);
    }
  };

  const handleDemoLogout = () => {
    setDemoRole(null);
    sessionStorage.removeItem('userRole');
  };

  // Show loading while checking auth
  if (loading) {
    return <LoadingScreen />;
  }

  // If Supabase is configured, use real auth
  if (isConfigured) {
    // Not logged in - show auth screen
    if (!user) {
      return <AuthScreen />;
    }

    // Logged in but no brands - show onboarding
    if (brands.length === 0) {
      return <OnboardingScreen />;
    }

    // Logged in with brands - determine role from profile (default to brand_owner if no profile)
    const userRole: UserRole = profile?.role === 'admin' || profile?.role === 'lawyer' ? 'admin' : 'brand';

    return (
      <DashboardProvider>
        <MainLayout userRole={userRole} onLogout={signOut} />
      </DashboardProvider>
    );
  }

  // Supabase not configured - use demo mode with role selection
  if (!demoRole) {
    return <RoleSelectionScreen onSelectRole={handleSelectDemoRole} />;
  }

  return (
    <DashboardProvider>
      <MainLayout userRole={demoRole} onLogout={handleDemoLogout} />
    </DashboardProvider>
  );
};

const ConsoleAppRoot: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

const App: React.FC = () => {
  const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true';

  return (
    <BrowserRouter>
      <Routes>
        {bypassAuth ? (
          <>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="/app/*" element={<ConsoleAppRoot />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<MarketingSite />} />
            <Route path="/app/*" element={<ConsoleAppRoot />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
};

export default App;
