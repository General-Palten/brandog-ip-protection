'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ToastContainer from './components/Toast';
import CommandPalette from './components/CommandPalette';
import CaseDetailModal from './components/CaseDetailModal';
import AIDrawer from './components/AIDrawer';
import AuthScreen from './components/AuthScreen';
import OnboardingScreen from './components/OnboardingScreen';
import NotificationBell from './components/NotificationBell';
import { InfringementItem } from './types';
import { User, Shield, CreditCard, LogOut, Building2, Scale, ArrowRight, Loader2, Bell } from 'lucide-react';
import { isSupabaseConfigured } from './lib/supabase';

// Views
import Infringements from './components/views/Infringements';
import Keywords from './components/views/Keywords';
import ImagesVideos from './components/views/ImagesVideos';
import Whitelist from './components/views/Whitelist';
import ReportBadActor from './components/views/ReportBadActor';
import IPDocuments from './components/views/IPDocuments';
import DashboardAnalytics from './components/views/DashboardAnalytics';
import ReportGenerator from './components/views/ReportGenerator';
import Settings from './components/views/Settings';
import AdminDashboard from './components/views/AdminDashboard';
import EnforcingWorkspace from './components/views/EnforcingWorkspace';
import { getBypassRole, isBypassAuthEnabled } from './lib/runtime-config';

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
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const [devRoleOverride, setDevRoleOverride] = useState<UserRole>(null);
  const effectiveRole = isDevelopment && devRoleOverride ? devRoleOverride : userRole;
  const isAdminMode = effectiveRole === 'admin';
  const [activeSidebarTab, setActiveSidebarTab] = useState(isAdminMode ? 'admin' : 'dashboard');
  const [settingsSection, setSettingsSection] = useState('profile');
  const { infringements, reportInfringement, dismissInfringement } = useDashboard();
  const { user, profile } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedNotificationCase, setSelectedNotificationCase] = useState<InfringementItem | null>(null);
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  // Load sidebar state from localStorage after hydration
  useEffect(() => {
    const saved = localStorage.getItem('sidebarExpanded');
    if (saved === 'true') {
      setIsSidebarExpanded(true);
    }
  }, []);

  useEffect(() => {
    if (!isAdminMode && activeSidebarTab === 'admin') {
      setActiveSidebarTab('dashboard');
    }
  }, [isAdminMode, activeSidebarTab]);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('sidebarExpanded', String(isSidebarExpanded));
  }, [isSidebarExpanded]);

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

  // Handle notification click to open case modal
  const handleNotificationClick = (caseId: string) => {
    const foundCase = infringements.find(inf => inf.id === caseId);
    if (foundCase) {
      setSelectedNotificationCase(foundCase);
    }
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
        isExpanded={isSidebarExpanded}
        onToggleExpanded={() => setIsSidebarExpanded(!isSidebarExpanded)}
      />
      
      {/* Global Command Palette */}
      <CommandPalette navigate={setActiveSidebarTab} />
      
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-h-screen relative transition-all duration-300 ${isSidebarExpanded ? 'ml-64' : 'ml-16'} ${isAIDrawerOpen ? 'mr-[380px]' : 'mr-0'}`}>
        
        {/* Top Bar - Solid background to prevent transparency on scroll */}
        <header className="sticky top-0 z-40 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
           {/* Left: Page Title */}
           <div className="flex items-center gap-4 flex-1">
              {/* Page Title */}
              <div>
                <h1 className="text-lg font-medium text-primary capitalize">
                  {activeSidebarTab === 'search' ? 'Infringements' :
                   activeSidebarTab === 'enforcing' ? 'Enforcing' :
                   activeSidebarTab === 'takedowns' ? 'Takedowns' :
                   activeSidebarTab === 'report-bad' ? 'Takedown Requests' :
                   activeSidebarTab === 'report-gen' ? 'Report Generator' :
                   activeSidebarTab === 'docs' ? 'IP Documents' :
                   activeSidebarTab}
                </h1>
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

              {/* Notification Bell */}
              <NotificationBell onNotificationClick={handleNotificationClick} />

              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-secondary transition-colors"
                >
                    <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="Profile" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
                </button>

                {isProfileOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setIsProfileOpen(false)}></div>
                      <div className="absolute right-0 top-full mt-2 w-56 bg-background border border-border shadow-xl z-40 animate-in slide-in-from-top-2 fade-in duration-200 flex flex-col p-1 rounded-xl">
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
                          
                          <button onClick={() => handleProfileNavigation('profile')} className="flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-surface text-left transition-colors rounded-lg">
                              <User size={16} />
                              <span>Profile</span>
                          </button>
                          <button onClick={() => handleProfileNavigation('notifications')} className="flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-surface text-left transition-colors rounded-lg">
                              <Bell size={16} />
                              <span>Notifications</span>
                          </button>
                          <button onClick={() => handleProfileNavigation('security')} className="flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-surface text-left transition-colors rounded-lg">
                              <Shield size={16} />
                              <span>Security</span>
                          </button>
                          <button onClick={() => handleProfileNavigation('billing')} className="flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-surface text-left transition-colors rounded-lg">
                              <CreditCard size={16} />
                              <span>Billing</span>
                          </button>
                          
                          <div className="h-px bg-border my-1"></div>
                          
                          <button
                            onClick={() => {
                              setIsProfileOpen(false);
                              onLogout();
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 text-left transition-colors rounded-lg"
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
              <Infringements />
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
          {activeSidebarTab === 'takedowns' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              {isAdminMode ? <AdminDashboard /> : <ReportBadActor />}
            </div>
          )}
          {activeSidebarTab === 'enforcing' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <EnforcingWorkspace mode={isAdminMode ? 'lawyer' : 'member'} />
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

      <AIDrawer isOpen={isAIDrawerOpen} onToggle={setIsAIDrawerOpen} />
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
          dismissInfringement(id, 'other');
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
  const bypassAuth = isBypassAuthEnabled();
  const bypassRole = getBypassRole();

  // Legacy role state for demo mode (when Supabase not configured)
  const [demoRole, setDemoRole] = useState<UserRole>(null);

  // Load demo role from sessionStorage after hydration
  useEffect(() => {
    const saved = sessionStorage.getItem('userRole');
    if (saved === 'brand' || saved === 'admin') {
      setDemoRole(saved);
    }
  }, []);

  if (bypassAuth) {
    return (
      <NotificationProvider>
        <DashboardProvider>
          <MainLayout userRole={bypassRole} onLogout={() => undefined} />
        </DashboardProvider>
      </NotificationProvider>
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
      <NotificationProvider>
        <DashboardProvider>
          <MainLayout userRole={userRole} onLogout={signOut} />
        </DashboardProvider>
      </NotificationProvider>
    );
  }

  // Supabase not configured - use demo mode with role selection
  if (!demoRole) {
    return <RoleSelectionScreen onSelectRole={handleSelectDemoRole} />;
  }

  return (
    <NotificationProvider>
      <DashboardProvider>
        <MainLayout userRole={demoRole} onLogout={handleDemoLogout} />
      </DashboardProvider>
    </NotificationProvider>
  );
};

const ConsoleAppRoot: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

const App: React.FC = () => <ConsoleAppRoot />;

export default App;
