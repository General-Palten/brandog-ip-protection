import React, { useState, useEffect, useRef } from 'react';
import BentoCard from '../ui/BentoCard';
import Button from '../ui/Button';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import {
  User, Bell, Shield, CreditCard, Globe, Moon,
  Smartphone, LogOut, Camera, Loader2, CheckCircle,
  Crown, BarChart3, History, Download, Filter, Monitor, Lock,
  Users, ChevronDown, ChevronUp, Search, Calendar, AlertTriangle,
  FileText, Type, Zap, X, Phone, Mail, Plug
} from 'lucide-react';
import { isOpenWebNinjaEnabled } from '../../lib/api-config';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  JOB_TITLES, BRAND_ROLES, DASHBOARD_VIEWS, DATE_FORMATS, TIMEZONES,
  PLAN_TIERS, LOG_ACTION_TYPES, MOCK_AUDIT_LOGS
} from '../../constants';
import {
  JobTitle, BrandRole, DashboardView, DateFormatPreference,
  PlanTier, PlanUsage, SessionInfo, TeamMember, AuditLogEntry, AuditLogActionType, AuditLogLevel
} from '../../types';
import { uploadAvatar, getAvatarUrl } from '../../lib/storage';

interface SettingsProps {
  initialSection?: string;
}

interface RolloutPolicyState {
  pilotEnabled: boolean;
  cohortName: string;
  pilotOwners: string;
  precisionGate: number;
  duplicateGate: number;
  appealGate: number;
  weeklyReviewDay: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
  lastReviewAt?: string;
  legalSignoff: boolean;
  productSignoff: boolean;
  goLiveApproved: boolean;
  reviewNotes: string[];
  updatedAt?: string;
}

const ROLLOUT_POLICY_STORAGE_KEY = 'brandog_rollout_policy_v1';

const DEFAULT_ROLLOUT_POLICY: RolloutPolicyState = {
  pilotEnabled: true,
  cohortName: 'Pilot Cohort A',
  pilotOwners: 'Legal + Product',
  precisionGate: 90,
  duplicateGate: 5,
  appealGate: 20,
  weeklyReviewDay: 'monday',
  legalSignoff: false,
  productSignoff: false,
  goLiveApproved: false,
  reviewNotes: [],
};

// Helper component for usage progress bars
const UsageBar: React.FC<{ label: string; used: number; limit: number | string; unit?: string }> = ({ label, used, limit, unit = '' }) => {
  const isUnlimited = limit === 'Unlimited' || limit === Infinity;
  const percentage = isUnlimited ? 0 : (used / (limit as number)) * 100;
  const colorClass = percentage >= 90 ? 'bg-red-500' : percentage >= 70 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-secondary">{label}</span>
        <span className="text-primary font-mono">
          {used.toLocaleString()}{unit} / {isUnlimited ? '∞' : `${(limit as number).toLocaleString()}${unit}`}
        </span>
      </div>
      <div className="h-2 bg-surface border border-border rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} transition-all`}
          style={{ width: isUnlimited ? '0%' : `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};

// Toggle Switch component
const Toggle: React.FC<{ enabled: boolean; onChange: (val: boolean) => void; size?: 'sm' | 'md' }> = ({ enabled, onChange, size = 'md' }) => {
  const sizeClasses = size === 'sm'
    ? 'h-5 w-9'
    : 'h-6 w-11';
  const dotSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const translateX = size === 'sm' ? 'translate-x-5' : 'translate-x-6';

  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex ${sizeClasses} items-center rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-border'}`}
    >
      <span className={`inline-block ${dotSize} transform rounded-full bg-inverse transition-transform ${enabled ? translateX : 'translate-x-1'}`} />
    </button>
  );
};

const Settings: React.FC<SettingsProps> = ({ initialSection = 'profile' }) => {
  const { theme, toggleTheme, addNotification } = useDashboard();
  const { user, profile, updateProfile, currentBrand } = useAuth();
  const [activeSection, setActiveSection] = useState(initialSection);

  // Profile form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [jobTitle, setJobTitle] = useState<JobTitle>('brand_manager');
  const [timezone, setTimezone] = useState('America/New_York');
  const [brandRole, setBrandRole] = useState<BrandRole>('primary_contact');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [defaultDashboardView, setDefaultDashboardView] = useState<DashboardView>('overview');
  const [dateFormat, setDateFormat] = useState<DateFormatPreference>('DD/MM/YYYY');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Notification settings state
  const [highSeverityEnabled, setHighSeverityEnabled] = useState(true);
  const [highSeverityFreq, setHighSeverityFreq] = useState<'instant' | 'digest'>('instant');
  const [mediumSeverityEnabled, setMediumSeverityEnabled] = useState(true);
  const [mediumSeverityFreq, setMediumSeverityFreq] = useState<'daily' | 'weekly'>('daily');
  const [lowSeverityEnabled, setLowSeverityEnabled] = useState(false);
  const [newPlatformDetection, setNewPlatformDetection] = useState(true);
  const [repeatOffenderAlert, setRepeatOffenderAlert] = useState(true);
  const [takedownInitiated, setTakedownInitiated] = useState(true);
  const [platformResponse, setPlatformResponse] = useState(true);
  const [caseResolved, setCaseResolved] = useState(true);
  const [caseEscalated, setCaseEscalated] = useState(true);
  const [weeklyProgressSummary, setWeeklyProgressSummary] = useState(true);
  const [weeklySummaryReport, setWeeklySummaryReport] = useState(true);
  const [monthlyAnalyticsReport, setMonthlyAnalyticsReport] = useState(true);
  const [reportDeliveryDay, setReportDeliveryDay] = useState('monday');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [smsForCritical, setSmsForCritical] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [marketingEmails, setMarketingEmails] = useState(false);

  // Security state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [requireApprovalForTakedowns, setRequireApprovalForTakedowns] = useState(false);
  const [auditLogAccess, setAuditLogAccess] = useState(true);
  const [accountLockdown, setAccountLockdown] = useState(false);

  // Integrations state
  const SERVICE_TOGGLES = [
    { key: 'enable_reverse_image_search', label: 'Reverse Image Search', desc: 'Core detection engine — finds where your protected images appear across the web', cost: 0.0025, defaultOn: true, endpoint: 'reverse-image-search' },
    { key: 'enable_product_search', label: 'Product Search', desc: 'Enrich detected listings with pricing, seller, and product metadata', cost: 0.0025, defaultOn: false, endpoint: 'product-search' },
    { key: 'enable_amazon_data', label: 'Visual Search', desc: 'Visual matches, object detection, and OCR via Google Lens', cost: 0.0025, defaultOn: false, endpoint: 'lens-data' },
    { key: 'enable_website_contacts', label: 'Website Contacts', desc: 'Extract emails, phone numbers, and social links from infringing seller sites', cost: 0.0025, defaultOn: false, endpoint: 'website-contacts' },
    { key: 'enable_social_links', label: 'Social Links', desc: 'Discover social media profiles associated with infringing sellers', cost: 0.0025, defaultOn: false, endpoint: 'social-links' },
    { key: 'enable_web_unblocker', label: 'Web Unblocker', desc: 'Access protected and JS-heavy pages to verify if listings are still active', cost: 0.0005, defaultOn: false, endpoint: 'web-unblocker' },
  ] as const;

  type ToggleKey = typeof SERVICE_TOGGLES[number]['key'];
  const [serviceToggles, setServiceToggles] = useState<Record<ToggleKey, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    for (const svc of SERVICE_TOGGLES) defaults[svc.key] = svc.defaultOn;
    return defaults as Record<ToggleKey, boolean>;
  });
  const [togglesLoading, setTogglesLoading] = useState(true);
  const [togglesSaving, setTogglesSaving] = useState<ToggleKey | null>(null);

  // Usage stats
  interface ServiceUsageRow { endpoint: string; calls: number; cost: number; }
  const [serviceUsage, setServiceUsage] = useState<ServiceUsageRow[]>([]);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usagePeriod, setUsagePeriod] = useState<'7' | '30' | '90'>('30');

  // Load service toggles from scan_settings
  useEffect(() => {
    if (!currentBrand?.id || !isSupabaseConfigured()) {
      setTogglesLoading(false);
      return;
    }
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('scan_settings')
          .select('enable_reverse_image_search, enable_product_search, enable_amazon_data, enable_website_contacts, enable_social_links, enable_web_unblocker')
          .eq('brand_id', currentBrand.id)
          .maybeSingle();
        if (data) {
          setServiceToggles({
            enable_reverse_image_search: data.enable_reverse_image_search ?? true,
            enable_product_search: data.enable_product_search ?? false,
            enable_amazon_data: data.enable_amazon_data ?? false,
            enable_website_contacts: data.enable_website_contacts ?? false,
            enable_social_links: data.enable_social_links ?? false,
            enable_web_unblocker: data.enable_web_unblocker ?? false,
          });
        }
      } catch { /* use defaults */ }
      setTogglesLoading(false);
    })();
  }, [currentBrand?.id]);

  // Load usage stats from provider_search_runs
  useEffect(() => {
    if (!currentBrand?.id || !isSupabaseConfigured()) {
      setUsageLoading(false);
      return;
    }
    (async () => {
      setUsageLoading(true);
      try {
        const since = new Date();
        since.setDate(since.getDate() - Number(usagePeriod));
        const { data } = await (supabase as any)
          .from('provider_search_runs')
          .select('endpoint, estimated_cost_usd')
          .eq('brand_id', currentBrand.id)
          .gte('created_at', since.toISOString());
        if (data && data.length > 0) {
          const byEndpoint: Record<string, { calls: number; cost: number }> = {};
          for (const row of data) {
            const ep = (row.endpoint || 'unknown').toString();
            if (!byEndpoint[ep]) byEndpoint[ep] = { calls: 0, cost: 0 };
            byEndpoint[ep].calls += 1;
            byEndpoint[ep].cost += Number(row.estimated_cost_usd || 0);
          }
          setServiceUsage(
            Object.entries(byEndpoint).map(([endpoint, stats]) => ({
              endpoint,
              calls: stats.calls,
              cost: Number(stats.cost.toFixed(4)),
            })).sort((a, b) => b.calls - a.calls)
          );
        } else {
          setServiceUsage([]);
        }
      } catch { setServiceUsage([]); }
      setUsageLoading(false);
    })();
  }, [currentBrand?.id, usagePeriod]);

  const totalUsageCalls = serviceUsage.reduce((s, r) => s + r.calls, 0);
  const totalUsageCost = serviceUsage.reduce((s, r) => s + r.cost, 0);

  const handleToggleService = async (key: ToggleKey, enabled: boolean) => {
    if (!currentBrand?.id || !isSupabaseConfigured()) {
      addNotification('error', 'No brand selected or Supabase not configured');
      return;
    }
    setTogglesSaving(key);
    const prev = serviceToggles[key];
    setServiceToggles(s => ({ ...s, [key]: enabled }));

    try {
      const { error } = await (supabase as any)
        .from('scan_settings')
        .upsert(
          { brand_id: currentBrand.id, [key]: enabled },
          { onConflict: 'brand_id' }
        );
      if (error) throw error;
      const svcLabel = SERVICE_TOGGLES.find(s => s.key === key)?.label || key;
      addNotification('success', `${svcLabel} ${enabled ? 'enabled' : 'disabled'}`);
    } catch {
      setServiceToggles(s => ({ ...s, [key]: prev }));
      addNotification('error', 'Failed to update setting');
    }
    setTogglesSaving(null);
  };

  // Plan state
  const [currentPlan] = useState<PlanTier>('pro');
  const [planComparisonOpen, setPlanComparisonOpen] = useState(false);
  const [planUsage] = useState<PlanUsage>({
    scansUsed: 847,
    scansLimit: 1000,
    keywordsMonitored: 12,
    keywordsLimit: 50,
    assetsProtected: 45,
    assetsLimit: 100,
    teamSeats: 4,
    teamSeatsLimit: 10,
    apiCalls: 2500,
    apiCallsLimit: 5000,
    storageUsedGB: 2.4,
    storageLimitGB: 10,
  });
  const [rolloutPolicy, setRolloutPolicy] = useState<RolloutPolicyState>(DEFAULT_ROLLOUT_POLICY);
  const [rolloutReviewInput, setRolloutReviewInput] = useState('');

  // Logs state
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logDateRange, setLogDateRange] = useState('7');
  const [logActionTypeFilter, setLogActionTypeFilter] = useState<AuditLogActionType[]>([]);
  const [logLevelFilter, setLogLevelFilter] = useState<AuditLogLevel[]>(['info', 'warning', 'success', 'danger']);
  const [exportFormat, setExportFormat] = useState('csv');

  // Mock sessions
  const [sessions] = useState<SessionInfo[]>([
    { id: '1', device: 'MacBook Pro', browser: 'Chrome 120', location: 'New York, US', ipAddress: '192.168.1.1', lastActive: 'Now', isCurrent: true },
    { id: '2', device: 'iPhone 15', browser: 'Safari Mobile', location: 'New York, US', ipAddress: '192.168.1.2', lastActive: '2 hours ago', isCurrent: false },
    { id: '3', device: 'Windows PC', browser: 'Firefox 121', location: 'London, UK', ipAddress: '10.0.0.5', lastActive: '1 day ago', isCurrent: false },
  ]);

  // Mock team members
  const [teamMembers] = useState<TeamMember[]>([
    { id: '1', name: 'Viktor S.', email: 'viktor@company.com', role: 'owner', lastActive: 'Now' },
    { id: '2', name: 'Sarah J.', email: 'sarah@company.com', role: 'admin', lastActive: '1 hour ago' },
    { id: '3', name: 'Mike R.', email: 'mike@company.com', role: 'member', lastActive: '3 days ago' },
    { id: '4', name: 'Emma L.', email: 'emma@legal.com', role: 'viewer', lastActive: '1 week ago' },
  ]);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  // Initialize profile form with user data
  useEffect(() => {
    const fullName = profile?.fullName || user?.user_metadata?.full_name || '';
    const nameParts = fullName.split(' ');
    setFirstName(nameParts[0] || '');
    setLastName(nameParts.slice(1).join(' ') || '');
  }, [profile, user]);

  useEffect(() => {
    const raw = localStorage.getItem(ROLLOUT_POLICY_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as RolloutPolicyState;
      if (!parsed || typeof parsed !== 'object') return;
      setRolloutPolicy({
        ...DEFAULT_ROLLOUT_POLICY,
        ...parsed,
        reviewNotes: Array.isArray(parsed.reviewNotes) ? parsed.reviewNotes : [],
      });
    } catch {
      setRolloutPolicy(DEFAULT_ROLLOUT_POLICY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(ROLLOUT_POLICY_STORAGE_KEY, JSON.stringify(rolloutPolicy));
  }, [rolloutPolicy]);

  // Initialize avatar URL from profile
  useEffect(() => {
    if (profile?.avatarUrl) {
      setAvatarUrl(getAvatarUrl(profile.avatarUrl));
    }
  }, [profile?.avatarUrl]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      addNotification('error', 'Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      addNotification('error', 'Image must be less than 5MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const { path, error: uploadError } = await uploadAvatar(user.id, file);
      if (uploadError) {
        addNotification('error', uploadError.message || 'Failed to upload avatar');
        return;
      }

      // Update profile with new avatar path
      const { error: profileError } = await updateProfile({ avatarUrl: path });
      if (profileError) {
        addNotification('error', profileError.message || 'Failed to update profile');
        return;
      }

      // Update local state with new URL
      setAvatarUrl(getAvatarUrl(path));
      addNotification('success', 'Profile picture updated');
    } catch {
      addNotification('error', 'Failed to upload profile picture');
    } finally {
      setIsUploadingAvatar(false);
      // Reset input so the same file can be selected again
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleSaveProfile = async () => {
    const fullName = `${firstName} ${lastName}`.trim();
    if (!fullName) {
      addNotification('error', 'Please enter your name');
      return;
    }

    setIsSavingProfile(true);
    try {
      const { error } = await updateProfile({ fullName });
      if (error) {
        addNotification('error', error.message || 'Failed to update profile');
      } else {
        addNotification('success', 'Profile updated successfully');
      }
    } catch (err) {
      addNotification('error', 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    addNotification('success', 'Session revoked successfully');
  };

  const handleRevokeAllSessions = () => {
    addNotification('success', 'All other sessions have been revoked');
  };

  const handleExportLogs = () => {
    addNotification('success', `Exporting logs as ${exportFormat.toUpperCase()}...`);
  };

  const handleSaveRolloutPolicy = () => {
    const next = {
      ...rolloutPolicy,
      updatedAt: new Date().toISOString(),
    };
    setRolloutPolicy(next);
    addNotification('success', 'Rollout policy saved');
  };

  const handleAddRolloutReview = () => {
    const note = rolloutReviewInput.trim();
    if (!note) {
      addNotification('error', 'Add a short review note before recording weekly review');
      return;
    }

    const timestamp = new Date().toISOString();
    setRolloutPolicy((prev) => ({
      ...prev,
      lastReviewAt: timestamp,
      updatedAt: timestamp,
      reviewNotes: [`${new Date(timestamp).toLocaleString()}: ${note}`, ...prev.reviewNotes].slice(0, 8),
    }));
    setRolloutReviewInput('');
    addNotification('success', 'Weekly rollout review logged');
  };

  // Filter logs based on current filters
  const filteredLogs = MOCK_AUDIT_LOGS.filter(log => {
    if (logSearchQuery && !log.title.toLowerCase().includes(logSearchQuery.toLowerCase()) && !log.target.toLowerCase().includes(logSearchQuery.toLowerCase())) {
      return false;
    }
    if (logActionTypeFilter.length > 0 && !logActionTypeFilter.includes(log.actionType)) {
      return false;
    }
    if (!logLevelFilter.includes(log.level)) {
      return false;
    }
    return true;
  });

  const getLogLevelColor = (level: AuditLogLevel) => {
    switch (level) {
      case 'success': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'warning': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'danger': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    }
  };

  const getActionIcon = (actionType: AuditLogActionType) => {
    switch (actionType) {
      case 'detection': return AlertTriangle;
      case 'takedown': return Shield;
      case 'case_update': return FileText;
      case 'resolution': return CheckCircle;
      case 'scan': return Search;
      case 'keyword': return Type;
      case 'user_action': return User;
      case 'security': return Lock;
      case 'report': return BarChart3;
      default: return FileText;
    }
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'plan', label: 'Plan', icon: Crown },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'logs', label: 'Logs', icon: History },
  ];

  return (
    <div className="space-y-8 animate-in fade-in h-full">
      <div className="flex justify-between items-end">
         <div>
            <h1 className="font-serif text-3xl text-primary font-medium">Settings</h1>
            <p className="text-secondary mt-1 text-sm">Manage your account preferences and workspace configuration.</p>
         </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-stretch min-h-[500px]">
        {/* Settings Navigation */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col">
            <div className="space-y-2">
                {sections.map(section => (
                    <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border border-transparent
                        ${activeSection === section.id
                            ? 'bg-surface text-primary border-border'
                            : 'text-secondary hover:text-primary hover:bg-surface/50'}`}
                    >
                        <section.icon size={18} />
                        {section.label}
                    </button>
                ))}
            </div>

            <div className="mt-auto pt-4">
                <div className="pt-4 border-t border-border">
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors">
                        <LogOut size={18} />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-6">

            {/* PROFILE SECTION */}
            {activeSection === 'profile' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <BentoCard title="Account Profile">
                        <div className="flex flex-col md:flex-row gap-8 items-start mt-4">
                            <div className="relative group cursor-pointer" onClick={() => !isUploadingAvatar && avatarInputRef.current?.click()}>
                                <input
                                    ref={avatarInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                    className="hidden"
                                />
                                <div className="w-24 h-24 bg-surface border border-border rounded-full overflow-hidden">
                                    <img
                                        src={avatarUrl || 'https://i.pravatar.cc/150?u=a042581f4e29026704d'}
                                        alt="Profile"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className={`absolute inset-0 bg-black/50 rounded-full flex items-center justify-center transition-opacity ${isUploadingAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                    {isUploadingAvatar ? (
                                        <Loader2 className="text-white animate-spin" size={24} />
                                    ) : (
                                        <Camera className="text-white" size={24} />
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 space-y-4 w-full">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">First Name</label>
                                        <input
                                          type="text"
                                          value={firstName}
                                          onChange={(e) => setFirstName(e.target.value)}
                                          placeholder="Enter your first name"
                                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Last Name</label>
                                        <input
                                          type="text"
                                          value={lastName}
                                          onChange={(e) => setLastName(e.target.value)}
                                          placeholder="Enter your last name"
                                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Email</label>
                                    <input
                                      type="email"
                                      value={user?.email || ''}
                                      disabled
                                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-secondary cursor-not-allowed"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Job Title</label>
                                        <select
                                          value={jobTitle}
                                          onChange={(e) => setJobTitle(e.target.value as JobTitle)}
                                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none"
                                        >
                                          {Object.entries(JOB_TITLES).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                          ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Timezone</label>
                                        <select
                                          value={timezone}
                                          onChange={(e) => setTimezone(e.target.value)}
                                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none"
                                        >
                                          {TIMEZONES.map((tz) => (
                                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                                          ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Bio</label>
                                    <textarea
                                      rows={3}
                                      value={bio}
                                      onChange={(e) => setBio(e.target.value)}
                                      placeholder="Tell us about yourself..."
                                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </BentoCard>

                    <BentoCard title="Preferences">
                        <div className="mt-4 space-y-4">
                            <div className="flex items-center justify-between py-3 border-b border-border border-dashed">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-surface border border-border text-primary">
                                        <Globe size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-primary">Language</p>
                                        <p className="text-xs text-secondary">Select your interface language</p>
                                    </div>
                                </div>
                                <select className="bg-background border border-border text-sm px-3 py-1.5 outline-none">
                                    <option>English (US)</option>
                                    <option>French</option>
                                    <option>German</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-border border-dashed">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-surface border border-border text-primary">
                                        <Moon size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-primary">Theme</p>
                                        <p className="text-xs text-secondary">Toggle dark mode</p>
                                    </div>
                                </div>
                                <Toggle enabled={theme === 'dark'} onChange={toggleTheme} />
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-border border-dashed">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-surface border border-border text-primary">
                                        <BarChart3 size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-primary">Default Dashboard View</p>
                                        <p className="text-xs text-secondary">What to show when you open the app</p>
                                    </div>
                                </div>
                                <select
                                    value={defaultDashboardView}
                                    onChange={(e) => setDefaultDashboardView(e.target.value as DashboardView)}
                                    className="bg-background border border-border text-sm px-3 py-1.5 outline-none"
                                >
                                    {Object.entries(DASHBOARD_VIEWS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-surface border border-border text-primary">
                                        <Calendar size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-primary">Date Format</p>
                                        <p className="text-xs text-secondary">How dates are displayed</p>
                                    </div>
                                </div>
                                <select
                                    value={dateFormat}
                                    onChange={(e) => setDateFormat(e.target.value as DateFormatPreference)}
                                    className="bg-background border border-border text-sm px-3 py-1.5 outline-none"
                                >
                                    {Object.entries(DATE_FORMATS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <Button
                              size="sm"
                              onClick={handleSaveProfile}
                              disabled={isSavingProfile}
                            >
                              {isSavingProfile ? (
                                <>
                                  <Loader2 size={14} className="animate-spin mr-1" />
                                  Saving...
                                </>
                              ) : (
                                'Save Changes'
                              )}
                            </Button>
                        </div>
                    </BentoCard>
                </div>
            )}

            {/* NOTIFICATIONS SECTION */}
            {activeSection === 'notifications' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <BentoCard title="Detection Alerts">
                        <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between py-3 border-b border-border border-dashed">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-primary">High Severity (90%+ match)</p>
                                    <p className="text-xs text-secondary">Critical infringements requiring immediate attention</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={highSeverityFreq}
                                        onChange={(e) => setHighSeverityFreq(e.target.value as 'instant' | 'digest')}
                                        className="bg-background border border-border text-xs px-2 py-1 outline-none"
                                        disabled={!highSeverityEnabled}
                                    >
                                        <option value="instant">Instant</option>
                                        <option value="digest">Digest</option>
                                    </select>
                                    <Toggle enabled={highSeverityEnabled} onChange={setHighSeverityEnabled} size="sm" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-border border-dashed">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-primary">Medium Severity (70-89%)</p>
                                    <p className="text-xs text-secondary">Potential infringements worth reviewing</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={mediumSeverityFreq}
                                        onChange={(e) => setMediumSeverityFreq(e.target.value as 'daily' | 'weekly')}
                                        className="bg-background border border-border text-xs px-2 py-1 outline-none"
                                        disabled={!mediumSeverityEnabled}
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                    </select>
                                    <Toggle enabled={mediumSeverityEnabled} onChange={setMediumSeverityEnabled} size="sm" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-border border-dashed">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-primary">Low Severity (&lt;70%)</p>
                                    <p className="text-xs text-secondary">Possible matches to keep an eye on</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-secondary">Weekly</span>
                                    <Toggle enabled={lowSeverityEnabled} onChange={setLowSeverityEnabled} size="sm" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-border border-dashed">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-primary">New Platform Detection</p>
                                    <p className="text-xs text-secondary">When your content appears on a new platform</p>
                                </div>
                                <Toggle enabled={newPlatformDetection} onChange={setNewPlatformDetection} size="sm" />
                            </div>
                            <div className="flex items-center justify-between py-3">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-primary">Repeat Offender Alert</p>
                                    <p className="text-xs text-secondary">When a previously flagged seller reappears</p>
                                </div>
                                <Toggle enabled={repeatOffenderAlert} onChange={setRepeatOffenderAlert} size="sm" />
                            </div>
                        </div>
                    </BentoCard>

                    <BentoCard title="Case Progress Alerts">
                        <div className="mt-4 space-y-3">
                            {[
                                { label: 'Takedown Initiated', desc: 'When a takedown request is submitted', state: takedownInitiated, setter: setTakedownInitiated },
                                { label: 'Platform Response', desc: 'When a platform responds to your request', state: platformResponse, setter: setPlatformResponse },
                                { label: 'Case Resolved', desc: 'When content is successfully removed', state: caseResolved, setter: setCaseResolved },
                                { label: 'Case Escalated', desc: 'When a case requires escalation', state: caseEscalated, setter: setCaseEscalated },
                                { label: 'Weekly Progress Summary', desc: 'Overview of all case activity', state: weeklyProgressSummary, setter: setWeeklyProgressSummary },
                            ].map((item, i) => (
                                <div key={i} className={`flex items-center justify-between py-3 ${i < 4 ? 'border-b border-border border-dashed' : ''}`}>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-primary">{item.label}</p>
                                        <p className="text-xs text-secondary">{item.desc}</p>
                                    </div>
                                    <Toggle enabled={item.state} onChange={item.setter} size="sm" />
                                </div>
                            ))}
                        </div>
                    </BentoCard>

                    <BentoCard title="Report Settings">
                        <div className="mt-4 space-y-4">
                            <div className="flex items-center justify-between py-3 border-b border-border border-dashed">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-primary">Weekly Summary Report</p>
                                    <p className="text-xs text-secondary">Comprehensive weekly digest of brand protection activity</p>
                                </div>
                                <Toggle enabled={weeklySummaryReport} onChange={setWeeklySummaryReport} size="sm" />
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-border border-dashed">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-primary">Monthly Analytics Report</p>
                                    <p className="text-xs text-secondary">Detailed monthly analytics and trends</p>
                                </div>
                                <Toggle enabled={monthlyAnalyticsReport} onChange={setMonthlyAnalyticsReport} size="sm" />
                            </div>
                            <div className="flex items-center justify-between py-3">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-primary">Delivery Preferences</p>
                                    <p className="text-xs text-secondary">When to receive your reports</p>
                                </div>
                                <select
                                    value={reportDeliveryDay}
                                    onChange={(e) => setReportDeliveryDay(e.target.value)}
                                    className="bg-background border border-border text-xs px-2 py-1 outline-none"
                                >
                                    <option value="monday">Monday 9:00 AM</option>
                                    <option value="tuesday">Tuesday 9:00 AM</option>
                                    <option value="wednesday">Wednesday 9:00 AM</option>
                                    <option value="thursday">Thursday 9:00 AM</option>
                                    <option value="friday">Friday 9:00 AM</option>
                                </select>
                            </div>
                        </div>
                    </BentoCard>

                    <BentoCard title="Communication Preferences">
                        <div className="mt-4 space-y-4">
                            <div className="flex items-center justify-between py-3 border-b border-border border-dashed">
                                <div className="flex items-center gap-3">
                                    <Mail size={18} className="text-secondary" />
                                    <div>
                                        <p className="text-sm font-medium text-primary">Email Notifications</p>
                                        <p className="text-xs text-secondary">Master toggle for all email alerts</p>
                                    </div>
                                </div>
                                <Toggle enabled={emailEnabled} onChange={setEmailEnabled} size="sm" />
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-border border-dashed">
                                <div className="flex items-center gap-3">
                                    <Bell size={18} className="text-secondary" />
                                    <div>
                                        <p className="text-sm font-medium text-primary">In-App Notifications</p>
                                        <p className="text-xs text-secondary">Show notifications within the dashboard</p>
                                    </div>
                                </div>
                                <Toggle enabled={inAppEnabled} onChange={setInAppEnabled} size="sm" />
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-border border-dashed">
                                <div className="flex items-center gap-3">
                                    <Smartphone size={18} className="text-secondary" />
                                    <div>
                                        <p className="text-sm font-medium text-primary">SMS for Critical Alerts</p>
                                        <p className="text-xs text-secondary">Text messages for high-priority issues only</p>
                                    </div>
                                </div>
                                <Toggle enabled={smsForCritical} onChange={setSmsForCritical} size="sm" />
                            </div>
                            <div className="py-3 border-b border-border border-dashed">
                                <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Slack Webhook URL</label>
                                <input
                                    type="url"
                                    value={slackWebhookUrl}
                                    onChange={(e) => setSlackWebhookUrl(e.target.value)}
                                    placeholder="https://hooks.slack.com/services/..."
                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none font-mono"
                                />
                            </div>
                            <div className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-3">
                                    <Zap size={18} className="text-secondary" />
                                    <div>
                                        <p className="text-sm font-medium text-primary">Marketing Emails</p>
                                        <p className="text-xs text-secondary">Product updates and feature announcements</p>
                                    </div>
                                </div>
                                <Toggle enabled={marketingEmails} onChange={setMarketingEmails} size="sm" />
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button size="sm" variant="secondary">Update Preferences</Button>
                        </div>
                    </BentoCard>
                </div>
            )}

            {/* SECURITY SECTION */}
            {activeSection === 'security' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <BentoCard title="Two-Factor Authentication">
                        <div className="mt-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 flex items-center justify-center rounded-lg border ${twoFactorEnabled ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-surface text-secondary border-border'}`}>
                                        <Smartphone size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-primary">2FA is {twoFactorEnabled ? 'Enabled' : 'Disabled'}</p>
                                        <p className="text-xs text-secondary">
                                            {twoFactorEnabled ? 'Your account is secured with an authenticator app.' : 'Add an extra layer of security to your account.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm">Configure Authenticator</Button>
                                <Button variant="outline" size="sm">Generate Backup Codes</Button>
                            </div>
                            <div className="mt-4 pt-4 border-t border-border">
                                <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">SMS Backup Phone (Optional)</label>
                                <input
                                    type="tel"
                                    placeholder="+1 (555) 000-0000"
                                    className="w-full md:w-1/2 px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none"
                                />
                            </div>
                        </div>
                    </BentoCard>

                    <BentoCard title="Session Management">
                        <div className="mt-4">
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-sm text-secondary">Active sessions across your devices</p>
                                <Button variant="outline" size="sm" onClick={handleRevokeAllSessions}>
                                    Sign Out All Other Sessions
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {sessions.map((session) => (
                                    <div key={session.id} className="flex items-center justify-between p-3 bg-surface border border-border">
                                        <div className="flex items-center gap-3">
                                            <Monitor size={18} className="text-secondary" />
                                            <div>
                                                <p className="text-sm font-medium text-primary">
                                                    {session.device} - {session.browser}
                                                    {session.isCurrent && <span className="ml-2 text-xs text-green-500">(Current)</span>}
                                                </p>
                                                <p className="text-xs text-secondary">
                                                    {session.location} • {session.ipAddress} • {session.lastActive}
                                                </p>
                                            </div>
                                        </div>
                                        {!session.isCurrent && (
                                            <Button variant="ghost" size="sm" onClick={() => handleRevokeSession(session.id)}>
                                                Revoke
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </BentoCard>

                    <BentoCard title="Password & Account">
                        <div className="mt-4 space-y-4">
                            <div className="flex items-center justify-between py-3 border-b border-border border-dashed">
                                <div>
                                    <p className="text-sm font-medium text-primary">Password</p>
                                    <p className="text-xs text-secondary">Last changed 30 days ago</p>
                                </div>
                                <Button variant="outline" size="sm">Change Password</Button>
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-border border-dashed">
                                <div>
                                    <p className="text-sm font-medium text-primary">Login History</p>
                                    <p className="text-xs text-secondary">View recent login attempts</p>
                                </div>
                                <Button variant="ghost" size="sm">View History</Button>
                            </div>
                            <div className="flex items-center justify-between py-3">
                                <div>
                                    <p className="text-sm font-medium text-primary">Account Lockdown Mode</p>
                                    <p className="text-xs text-secondary">Temporarily restrict all account changes</p>
                                </div>
                                <Toggle enabled={accountLockdown} onChange={setAccountLockdown} size="sm" />
                            </div>
                        </div>
                    </BentoCard>

                    <BentoCard title="Team Access Control">
                        <div className="mt-4">
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-sm text-secondary">{teamMembers.length} team members</p>
                                <Button variant="outline" size="sm" icon={Users}>Manage Team</Button>
                            </div>
                            <div className="space-y-2 mb-4">
                                {teamMembers.map((member) => (
                                    <div key={member.id} className="flex items-center justify-between p-2 bg-surface border border-border">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-xs font-medium text-primary">
                                                {member.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-primary">{member.name}</p>
                                                <p className="text-xs text-secondary">{member.email}</p>
                                            </div>
                                        </div>
                                        <span className={`text-xs px-2 py-1 border ${
                                            member.role === 'owner' ? 'text-purple-500 bg-purple-500/10 border-purple-500/20' :
                                            member.role === 'admin' ? 'text-blue-500 bg-blue-500/10 border-blue-500/20' :
                                            member.role === 'member' ? 'text-green-500 bg-green-500/10 border-green-500/20' :
                                            'text-gray-500 bg-gray-500/10 border-gray-500/20'
                                        }`}>
                                            {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t border-border space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-primary">Require Approval for Takedowns</p>
                                        <p className="text-xs text-secondary">Admin must approve before submission</p>
                                    </div>
                                    <Toggle enabled={requireApprovalForTakedowns} onChange={setRequireApprovalForTakedowns} size="sm" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-primary">Audit Log Access</p>
                                        <p className="text-xs text-secondary">Allow all team members to view logs</p>
                                    </div>
                                    <Toggle enabled={auditLogAccess} onChange={setAuditLogAccess} size="sm" />
                                </div>
                            </div>
                        </div>
                    </BentoCard>
                </div>
            )}

            {/* INTEGRATIONS SECTION */}
            {activeSection === 'integrations' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    {/* Usage Overview */}
                    <BentoCard title="Usage Overview">
                        <div className="mt-4">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-xs text-secondary">API calls and estimated spend across all services.</p>
                                <select
                                    value={usagePeriod}
                                    onChange={(e) => setUsagePeriod(e.target.value as '7' | '30' | '90')}
                                    className="px-2 py-1 bg-background border border-border rounded text-xs text-primary focus:border-primary outline-none"
                                >
                                    <option value="7">Last 7 days</option>
                                    <option value="30">Last 30 days</option>
                                    <option value="90">Last 90 days</option>
                                </select>
                            </div>

                            {usageLoading ? (
                                <div className="flex items-center justify-center py-6 text-secondary">
                                    <Loader2 className="animate-spin mr-2" size={16} />
                                    <span className="text-sm">Loading usage data...</span>
                                </div>
                            ) : (
                                <>
                                    {/* Summary row */}
                                    <div className="grid grid-cols-2 gap-4 mb-5">
                                        <div className="p-3 bg-surface border border-border rounded-lg">
                                            <p className="text-[10px] text-secondary uppercase tracking-wider">Total Calls</p>
                                            <p className="text-xl font-mono font-semibold text-primary mt-1">
                                                {totalUsageCalls.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-surface border border-border rounded-lg">
                                            <p className="text-[10px] text-secondary uppercase tracking-wider">Estimated Spend</p>
                                            <p className="text-xl font-mono font-semibold text-primary mt-1">
                                                ${totalUsageCost.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Per-service breakdown */}
                                    {serviceUsage.length > 0 ? (
                                        <div className="space-y-2">
                                            <p className="text-[10px] text-secondary uppercase tracking-wider mb-2">By Service</p>
                                            {serviceUsage.map((row) => {
                                                const pct = totalUsageCalls > 0 ? (row.calls / totalUsageCalls) * 100 : 0;
                                                // Match endpoint to a friendly label
                                                const match = SERVICE_TOGGLES.find(s => row.endpoint.includes(s.endpoint));
                                                const label = match?.label || row.endpoint;
                                                return (
                                                    <div key={row.endpoint} className="flex items-center gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-xs font-medium text-primary truncate">{label}</span>
                                                                <span className="text-xs text-secondary font-mono shrink-0 ml-2">
                                                                    {row.calls.toLocaleString()} calls &middot; ${row.cost.toFixed(2)}
                                                                </span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-primary rounded-full transition-all"
                                                                    style={{ width: `${Math.max(2, pct)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-secondary text-center py-4">
                                            No API calls recorded in this period.
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    </BentoCard>

                    {/* Service Toggles */}
                    <BentoCard title="Services">
                        <div className="mt-4 space-y-1">
                            <p className="text-xs text-secondary mb-4">
                                Enable or disable detection and enrichment services. Changes take effect on the next scan.
                            </p>
                            {togglesLoading ? (
                                <div className="flex items-center justify-center py-8 text-secondary">
                                    <Loader2 className="animate-spin mr-2" size={16} />
                                    <span className="text-sm">Loading service settings...</span>
                                </div>
                            ) : (
                                SERVICE_TOGGLES.map((svc) => {
                                    const usageRow = serviceUsage.find(u => u.endpoint.includes(svc.endpoint));
                                    return (
                                        <div key={svc.key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                                            <div className="flex-1 min-w-0 mr-4">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium text-primary">{svc.label}</p>
                                                    <span className="text-[10px] font-mono text-secondary bg-surface px-1.5 py-0.5 border border-border rounded shrink-0">
                                                        ${svc.cost}/call
                                                    </span>
                                                </div>
                                                <p className="text-xs text-secondary mt-0.5">{svc.desc}</p>
                                                {usageRow && (
                                                    <p className="text-[10px] text-secondary mt-1 font-mono">
                                                        {usageRow.calls.toLocaleString()} calls &middot; ${usageRow.cost.toFixed(2)} in last {usagePeriod}d
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {togglesSaving === svc.key && <Loader2 className="animate-spin text-secondary" size={14} />}
                                                <Toggle
                                                    enabled={serviceToggles[svc.key]}
                                                    onChange={(val) => handleToggleService(svc.key, val)}
                                                    size="sm"
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            {!currentBrand && !togglesLoading && (
                                <p className="text-xs text-amber-500 mt-2">
                                    No brand selected. Sign in and select a brand to manage service toggles.
                                </p>
                            )}
                        </div>
                    </BentoCard>
                </div>
            )}

            {/* PLAN SECTION */}
            {activeSection === 'plan' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <BentoCard title="Current Plan">
                        <div className="mt-4">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className={`px-3 py-1.5 flex items-center gap-1.5 ${
                                        currentPlan === 'enterprise' ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' :
                                        currentPlan === 'pro' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                                        'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                                    }`}>
                                        <Crown size={14} />
                                        <span className="text-sm font-medium">{PLAN_TIERS[currentPlan].name}</span>
                                    </div>
                                </div>
                                <Button size="sm">
                                    {currentPlan === 'enterprise' ? 'Contact Sales' : 'Upgrade Plan'}
                                </Button>
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-4">
                                <div>
                                    <p className="text-[10px] text-secondary uppercase tracking-wider">Price</p>
                                    <p className="font-mono text-sm text-primary mt-1">${PLAN_TIERS[currentPlan].price}/mo</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-secondary uppercase tracking-wider">Billing Cycle</p>
                                    <p className="font-mono text-sm text-primary mt-1">Annual</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-secondary uppercase tracking-wider">Renewal Date</p>
                                    <p className="font-mono text-sm text-primary mt-1">Oct 24, 2024</p>
                                </div>
                            </div>
                        </div>
                    </BentoCard>

                    <BentoCard title="Usage Metrics">
                        <div className="mt-4 space-y-4">
                            <UsageBar
                                label="Scans Used"
                                used={planUsage.scansUsed}
                                limit={planUsage.scansLimit}
                            />
                            <UsageBar
                                label="Keywords Monitored"
                                used={planUsage.keywordsMonitored}
                                limit={planUsage.keywordsLimit}
                            />
                            <UsageBar
                                label="Assets Protected"
                                used={planUsage.assetsProtected}
                                limit={planUsage.assetsLimit}
                            />
                            <UsageBar
                                label="Team Seats"
                                used={planUsage.teamSeats}
                                limit={planUsage.teamSeatsLimit}
                            />
                            <UsageBar
                                label="API Calls"
                                used={planUsage.apiCalls}
                                limit={planUsage.apiCallsLimit}
                            />
                            <UsageBar
                                label="Storage Used"
                                used={planUsage.storageUsedGB}
                                limit={planUsage.storageLimitGB}
                                unit=" GB"
                            />
                        </div>
                    </BentoCard>

                    <BentoCard title="Plan Comparison">
                        <button
                            onClick={() => setPlanComparisonOpen(!planComparisonOpen)}
                            className="w-full flex items-center justify-between mt-2 text-sm text-secondary hover:text-primary"
                        >
                            <span>Compare all features</span>
                            {planComparisonOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {planComparisonOpen && (
                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="text-left py-2 text-secondary font-medium">Feature</th>
                                            <th className="text-center py-2 text-secondary font-medium">Free</th>
                                            <th className="text-center py-2 text-secondary font-medium">Pro</th>
                                            <th className="text-center py-2 text-secondary font-medium">Enterprise</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-border/50">
                                            <td className="py-2 text-primary">Monthly Scans</td>
                                            <td className="py-2 text-center text-secondary">100</td>
                                            <td className="py-2 text-center text-secondary">1,000</td>
                                            <td className="py-2 text-center text-secondary">Unlimited</td>
                                        </tr>
                                        <tr className="border-b border-border/50">
                                            <td className="py-2 text-primary">Keywords</td>
                                            <td className="py-2 text-center text-secondary">5</td>
                                            <td className="py-2 text-center text-secondary">50</td>
                                            <td className="py-2 text-center text-secondary">Unlimited</td>
                                        </tr>
                                        <tr className="border-b border-border/50">
                                            <td className="py-2 text-primary">Team Seats</td>
                                            <td className="py-2 text-center text-secondary">1</td>
                                            <td className="py-2 text-center text-secondary">10</td>
                                            <td className="py-2 text-center text-secondary">Unlimited</td>
                                        </tr>
                                        <tr className="border-b border-border/50">
                                            <td className="py-2 text-primary">Priority Support</td>
                                            <td className="py-2 text-center"><X size={14} className="inline text-secondary" /></td>
                                            <td className="py-2 text-center text-secondary">Email</td>
                                            <td className="py-2 text-center text-secondary">Dedicated</td>
                                        </tr>
                                        <tr className="border-b border-border/50">
                                            <td className="py-2 text-primary">API Access</td>
                                            <td className="py-2 text-center"><X size={14} className="inline text-secondary" /></td>
                                            <td className="py-2 text-center"><CheckCircle size={14} className="inline text-green-500" /></td>
                                            <td className="py-2 text-center"><CheckCircle size={14} className="inline text-green-500" /></td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 text-primary">Custom Reports</td>
                                            <td className="py-2 text-center"><X size={14} className="inline text-secondary" /></td>
                                            <td className="py-2 text-center"><CheckCircle size={14} className="inline text-green-500" /></td>
                                            <td className="py-2 text-center"><CheckCircle size={14} className="inline text-green-500" /></td>
                                        </tr>
                                    </tbody>
                                </table>
                                <div className="mt-4 flex gap-3 justify-center">
                                    <Button variant="outline" size="sm">Upgrade to Pro</Button>
                                    <Button variant="secondary" size="sm">Contact Sales</Button>
                                </div>
                            </div>
                        )}
                    </BentoCard>

                    <BentoCard title="Controlled Rollout Governance">
                        <div className="mt-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Pilot Cohort</label>
                                    <input
                                      type="text"
                                      value={rolloutPolicy.cohortName}
                                      onChange={(e) => setRolloutPolicy(prev => ({ ...prev, cohortName: e.target.value }))}
                                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Owners</label>
                                    <input
                                      type="text"
                                      value={rolloutPolicy.pilotOwners}
                                      onChange={(e) => setRolloutPolicy(prev => ({ ...prev, pilotOwners: e.target.value }))}
                                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Precision Gate %</label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={rolloutPolicy.precisionGate}
                                      onChange={(e) => setRolloutPolicy(prev => ({ ...prev, precisionGate: Number(e.target.value || 0) }))}
                                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Duplicate Gate %</label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={rolloutPolicy.duplicateGate}
                                      onChange={(e) => setRolloutPolicy(prev => ({ ...prev, duplicateGate: Number(e.target.value || 0) }))}
                                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Appeal Gate %</label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={rolloutPolicy.appealGate}
                                      onChange={(e) => setRolloutPolicy(prev => ({ ...prev, appealGate: Number(e.target.value || 0) }))}
                                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-primary">Pilot Enabled</p>
                                        <Toggle
                                          enabled={rolloutPolicy.pilotEnabled}
                                          onChange={(enabled) => setRolloutPolicy(prev => ({ ...prev, pilotEnabled: enabled }))}
                                          size="sm"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-primary">Legal Signoff</p>
                                        <Toggle
                                          enabled={rolloutPolicy.legalSignoff}
                                          onChange={(enabled) => setRolloutPolicy(prev => ({ ...prev, legalSignoff: enabled }))}
                                          size="sm"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-primary">Product Signoff</p>
                                        <Toggle
                                          enabled={rolloutPolicy.productSignoff}
                                          onChange={(enabled) => setRolloutPolicy(prev => ({ ...prev, productSignoff: enabled }))}
                                          size="sm"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-primary">GA Approved</p>
                                        <Toggle
                                          enabled={rolloutPolicy.goLiveApproved}
                                          onChange={(enabled) => setRolloutPolicy(prev => ({ ...prev, goLiveApproved: enabled }))}
                                          size="sm"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Weekly Review Day</label>
                                        <select
                                          value={rolloutPolicy.weeklyReviewDay}
                                          onChange={(e) => setRolloutPolicy(prev => ({ ...prev, weeklyReviewDay: e.target.value as RolloutPolicyState['weeklyReviewDay'] }))}
                                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none"
                                        >
                                          <option value="monday">Monday</option>
                                          <option value="tuesday">Tuesday</option>
                                          <option value="wednesday">Wednesday</option>
                                          <option value="thursday">Thursday</option>
                                          <option value="friday">Friday</option>
                                        </select>
                                    </div>
                                    <div className="text-xs text-secondary">
                                      Last weekly review: {rolloutPolicy.lastReviewAt ? new Date(rolloutPolicy.lastReviewAt).toLocaleString() : 'Not recorded'}
                                    </div>
                                    <div className="text-xs text-secondary">
                                      Last policy update: {rolloutPolicy.updatedAt ? new Date(rolloutPolicy.updatedAt).toLocaleString() : 'Not recorded'}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-border space-y-2">
                                <label className="block text-xs font-medium text-secondary uppercase tracking-wider">Weekly Review Notes</label>
                                <textarea
                                  value={rolloutReviewInput}
                                  onChange={(e) => setRolloutReviewInput(e.target.value)}
                                  placeholder="Record quality/legal/ops review outcomes..."
                                  className="w-full h-20 px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none"
                                />
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="secondary" size="sm" onClick={handleAddRolloutReview}>
                                      Record Weekly Review
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={handleSaveRolloutPolicy}>
                                      Save Rollout Policy
                                    </Button>
                                </div>
                                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                  {rolloutPolicy.reviewNotes.length === 0 && (
                                    <p className="text-xs text-secondary">No review notes recorded yet.</p>
                                  )}
                                  {rolloutPolicy.reviewNotes.map((note, index) => (
                                    <p key={`${note}-${index}`} className="text-xs text-primary bg-surface border border-border px-2 py-1 rounded">
                                      {note}
                                    </p>
                                  ))}
                                </div>
                            </div>
                        </div>
                    </BentoCard>
                </div>
            )}

             {/* BILLING SECTION */}
             {activeSection === 'billing' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <BentoCard title="Current Plan">
                         <div className="mt-4 flex justify-between items-start">
                             <div>
                                 <h3 className="text-xl font-medium text-primary">Enterprise</h3>
                                 <p className="text-secondary text-sm mt-1">$499 / month • Billed annually</p>
                             </div>
                             <span className="bg-primary text-inverse px-3 py-1 text-xs font-medium uppercase tracking-wider">Active</span>
                         </div>
                         <div className="mt-6 pt-6 border-t border-border grid grid-cols-3 gap-4">
                             <div>
                                 <p className="text-[10px] text-secondary uppercase tracking-wider">Next Invoice</p>
                                 <p className="font-mono text-sm text-primary mt-1">Oct 24, 2024</p>
                             </div>
                             <div>
                                 <p className="text-[10px] text-secondary uppercase tracking-wider">Keywords</p>
                                 <p className="font-mono text-sm text-primary mt-1">12 / 50 Used</p>
                             </div>
                             <div>
                                 <p className="text-[10px] text-secondary uppercase tracking-wider">Seats</p>
                                 <p className="font-mono text-sm text-primary mt-1">4 / 10 Used</p>
                             </div>
                         </div>
                    </BentoCard>
                    <BentoCard title="Payment Method">
                        <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-8 bg-surface border border-border flex items-center justify-center rounded-sm">
                                    <div className="flex gap-0.5">
                                        <div className="w-3 h-3 rounded-full bg-red-500 opacity-80"></div>
                                        <div className="w-3 h-3 rounded-full bg-yellow-500 opacity-80 -ml-1.5"></div>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-primary">Mastercard ending in 8822</p>
                                    <p className="text-xs text-secondary">Expires 12/25</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm">Edit</Button>
                        </div>
                    </BentoCard>
                </div>
             )}

            {/* LOGS SECTION (was Developer) */}
            {activeSection === 'logs' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <BentoCard title="Activity Log Filters">
                        <div className="mt-4 space-y-4">
                            <div className="flex flex-wrap gap-3">
                                <div className="flex-1 min-w-[200px]">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                                        <input
                                            type="text"
                                            value={logSearchQuery}
                                            onChange={(e) => setLogSearchQuery(e.target.value)}
                                            placeholder="Search logs..."
                                            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none"
                                        />
                                    </div>
                                </div>
                                <select
                                    value={logDateRange}
                                    onChange={(e) => setLogDateRange(e.target.value)}
                                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none"
                                >
                                    <option value="7">Last 7 days</option>
                                    <option value="30">Last 30 days</option>
                                    <option value="90">Last 90 days</option>
                                    <option value="custom">Custom range</option>
                                </select>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="text-xs text-secondary flex items-center gap-1">
                                    <Filter size={12} />
                                    Log Level:
                                </span>
                                {(['info', 'warning', 'success', 'danger'] as AuditLogLevel[]).map((level) => (
                                    <button
                                        key={level}
                                        onClick={() => {
                                            if (logLevelFilter.includes(level)) {
                                                setLogLevelFilter(logLevelFilter.filter(l => l !== level));
                                            } else {
                                                setLogLevelFilter([...logLevelFilter, level]);
                                            }
                                        }}
                                        className={`px-2 py-1 text-xs border transition-colors ${
                                            logLevelFilter.includes(level)
                                                ? getLogLevelColor(level)
                                                : 'text-secondary border-border bg-background'
                                        }`}
                                    >
                                        {level.charAt(0).toUpperCase() + level.slice(1)}
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="text-xs text-secondary flex items-center gap-1">
                                    <Type size={12} />
                                    Action Type:
                                </span>
                                {(Object.keys(LOG_ACTION_TYPES) as AuditLogActionType[]).map((actionType) => (
                                    <button
                                        key={actionType}
                                        onClick={() => {
                                            if (logActionTypeFilter.includes(actionType)) {
                                                setLogActionTypeFilter(logActionTypeFilter.filter(t => t !== actionType));
                                            } else {
                                                setLogActionTypeFilter([...logActionTypeFilter, actionType]);
                                            }
                                        }}
                                        className={`px-2 py-1 text-xs border transition-colors ${
                                            logActionTypeFilter.includes(actionType)
                                                ? 'bg-primary text-inverse border-primary'
                                                : 'text-secondary border-border bg-background hover:text-primary'
                                        }`}
                                    >
                                        {LOG_ACTION_TYPES[actionType].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </BentoCard>

                    <BentoCard title="Activity Timeline">
                        <div className="mt-4 space-y-3">
                            {filteredLogs.length === 0 ? (
                                <p className="text-sm text-secondary text-center py-8">No logs match your filters</p>
                            ) : (
                                filteredLogs.map((log) => {
                                    const ActionIcon = getActionIcon(log.actionType);
                                    return (
                                        <div key={log.id} className="flex gap-3 p-3 bg-surface border border-border">
                                            <div className={`p-2 ${getLogLevelColor(log.level)} border`}>
                                                <ActionIcon size={16} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-sm font-medium text-primary">{log.title}</p>
                                                    <span className={`text-[10px] px-2 py-0.5 border shrink-0 ${getLogLevelColor(log.level)}`}>
                                                        {LOG_ACTION_TYPES[log.actionType].label}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-secondary mt-1 truncate">{log.target}</p>
                                                <div className="flex items-center gap-3 mt-2 text-[10px] text-secondary">
                                                    <span>User: {log.user}</span>
                                                    <span>•</span>
                                                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </BentoCard>

                    <BentoCard title="Export & Audit">
                        <div className="mt-4 space-y-4">
                            <div className="flex flex-wrap gap-3 items-end">
                                <div>
                                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Export Format</label>
                                    <select
                                        value={exportFormat}
                                        onChange={(e) => setExportFormat(e.target.value)}
                                        className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none"
                                    >
                                        <option value="csv">CSV</option>
                                        <option value="json">JSON</option>
                                        <option value="pdf">PDF</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Date Range</label>
                                    <select
                                        className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none"
                                    >
                                        <option>Last 7 days</option>
                                        <option>Last 30 days</option>
                                        <option>Last 90 days</option>
                                        <option>All time</option>
                                    </select>
                                </div>
                                <Button size="sm" icon={Download} onClick={handleExportLogs}>
                                    Export Logs
                                </Button>
                            </div>
                            <div className="pt-4 border-t border-border">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-primary">Schedule Automated Export</p>
                                        <p className="text-xs text-secondary">Automatically export logs on a schedule (Pro/Enterprise)</p>
                                    </div>
                                    <Button variant="outline" size="sm" disabled={currentPlan === 'free'}>
                                        Configure
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </BentoCard>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
