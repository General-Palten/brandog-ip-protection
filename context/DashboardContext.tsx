import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { InfringementItem, KeywordItem, ActivityLogItem, PlatformType, PersistedAsset, VisionSearchResult, TakedownRequest, InfringementStatus, CaseUpdate, CaseUpdateType, AssetScanStatus } from '../types';
import { fileToArrayBuffer, arrayBufferToBase64, getMimeType, getAssetType, readTextContent } from '../lib/asset-utils';
import { searchByImage } from '../lib/vision-api';
import { isVisionConfigured, getVisionConfig } from '../lib/api-config';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { uploadAsset as uploadToStorage, getAssetUrl as getStorageUrl, deleteAsset as deleteFromStorage } from '../lib/storage';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

type CreateInfringementReason = 'duplicate' | 'invalid_url' | 'db_error';

interface CreateInfringementResult {
  created: boolean;
  reason?: CreateInfringementReason;
}

interface CreateInfringementOptions {
  detectionProvider?: string;
  detectionMethod?: string;
  sourceFingerprint?: string;
}

interface DashboardContextType {
  infringements: InfringementItem[];
  keywords: KeywordItem[];
  notifications: Notification[];
  recentActivity: ActivityLogItem[];
  isMobileMenuOpen: boolean;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  toggleMobileMenu: () => void;
  isLoading: boolean;
  isConfigured: boolean;
  // Actions
  reportInfringement: (id: string) => void;
  dismissInfringement: (id: string) => void;
  undoInfringementStatus: (id: string) => void;
  addKeyword: (text: string, type: 'active' | 'negative' | 'suggested') => void;
  deleteKeyword: (id: string) => void;
  addNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  removeNotification: (id: string) => void;
  resetData: () => void;
  // Asset management
  assets: PersistedAsset[];
  assetsLoading: boolean;
  addAsset: (file: File) => Promise<string>;
  deleteAsset: (id: string) => Promise<void>;
  getAssetURL: (id: string) => Promise<string>;
  getAssetBase64: (id: string) => Promise<string>;
  createInfringementFromSearch: (
    result: VisionSearchResult,
    originalAsset: PersistedAsset,
    fallbackImages?: string[],
    options?: CreateInfringementOptions
  ) => Promise<CreateInfringementResult>;
  // Takedown management
  takedownRequests: TakedownRequest[];
  requestTakedown: (infringementId: string) => void;
  updateTakedownStatus: (caseId: string, status: InfringementStatus, adminNotes?: string) => void;
  getTakedownForCase: (caseId: string) => TakedownRequest | undefined;
  // Case update management
  addCaseUpdate: (caseId: string, type: CaseUpdateType, message: string, createdBy?: 'lawyer' | 'system' | 'brand_owner') => void;
  getCaseUpdates: (caseId: string) => CaseUpdate[];
  markUpdatesAsRead: (caseId: string) => void;
  getUnreadUpdateCount: (caseId: string) => number;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// Transform Supabase infringement to local type
const transformSupabaseInfringement = (dbInf: any, brandName: string = 'Unknown'): InfringementItem => ({
  id: dbInf.id,
  brandName,
  isTrademarked: false,
  originalImage: '',
  copycatImage: dbInf.copycat_image_url || '',
  similarityScore: dbInf.similarity_score || 0,
  siteVisitors: dbInf.site_visitors || 0,
  platform: dbInf.platform,
  revenueLost: Number(dbInf.revenue_lost) || 0,
  status: dbInf.status,
  detectedAt: dbInf.detected_at?.split('T')[0] || new Date().toISOString().split('T')[0],
  country: dbInf.country || 'Unknown',
  originalAssetId: dbInf.original_asset_id || undefined,
  infringingUrl: dbInf.infringing_url || undefined,
  sellerName: dbInf.seller_name || undefined,
  whois: {
    registrar: dbInf.whois_registrar || 'Unknown',
    creationDate: dbInf.whois_creation_date || 'Unknown',
    registrantCountry: dbInf.whois_registrant_country || 'Unknown',
  },
  hosting: {
    provider: dbInf.hosting_provider || 'Unknown',
    ipAddress: dbInf.hosting_ip_address || 'Unknown',
  },
});

// Transform Supabase keyword to local type
const transformSupabaseKeyword = (dbKw: any): KeywordItem => ({
  id: dbKw.id,
  text: dbKw.text,
  tags: dbKw.tags || [],
  matches: dbKw.matches_count || 0,
  type: dbKw.type,
  trend: dbKw.trend,
});

// Transform Supabase asset to local type
const transformSupabaseAsset = (dbAsset: any): PersistedAsset => ({
  id: dbAsset.id,
  type: dbAsset.type,
  name: dbAsset.name,
  mimeType: dbAsset.mime_type,
  protected: dbAsset.is_protected,
  dateAdded: new Date(dbAsset.created_at).getTime(),
  sourceUrl: dbAsset.source_url || undefined,
  content: dbAsset.content || undefined,
  fingerprint: dbAsset.fingerprint || undefined,
  scanStatus: dbAsset.scan_status || undefined,
  scanAttempts: dbAsset.scan_attempts ?? undefined,
  lastScannedAt: dbAsset.last_scanned_at || undefined,
  nextScanAt: dbAsset.next_scan_at || undefined,
  scanProvider: dbAsset.scan_provider || undefined,
  lastScanError: dbAsset.last_scan_error || undefined,
});

const normalizeExternalUrl = (url: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
};

const extractHostname = (url: string): string | null => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
};

const getUrlHashOffset = (url: string, modulo: number): number => {
  if (modulo <= 0) return 0;
  const hash = url.split('').reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
  return Math.abs(hash % modulo);
};

const computeSimilarityScore = (result: VisionSearchResult, hasFallbackImage: boolean): number => {
  if (typeof result.score === 'number' && Number.isFinite(result.score)) {
    const normalized = result.score <= 1 ? Math.round(result.score * 100) : Math.round(result.score);
    return Math.max(0, Math.min(100, normalized));
  }

  const hasExactMatch = result.fullMatchingImages.length > 0;
  const hasPartialMatch = result.partialMatchingImages.length > 0;
  const hashOffset = getUrlHashOffset(result.url, 10);

  if (hasExactMatch) return 95 + (hashOffset % 6); // 95-100
  if (hasPartialMatch) return 70 + (hashOffset % 25); // 70-94
  if (hasFallbackImage) return 50 + (hashOffset % 20); // 50-69
  return 45 + (hashOffset % 15); // 45-59
};

const GOOGLE_VISION_PROVIDER = 'google_vision';
const GOOGLE_WEB_DETECTION_METHOD = 'web_detection';
const SERPAPI_LENS_PROVIDER = 'serpapi_google_lens';
const SERPAPI_LENS_METHOD = 'google_lens';
const GOOGLE_VISION_WEB_DETECTION_USD = 0.0015;
const SCAN_RETRY_HOURS = 6;
const DEFAULT_RESCAN_DAYS = 14;
const RECENT_FINGERPRINT_SCAN_HOURS = 72;
const SCAN_WORKER_POLL_INTERVAL_MS = 30000;
const MAX_SCAN_CLAIM_BATCH_SIZE = 20;
const SERPAPI_SIGNED_URL_TTL_SECONDS = 120;
const NO_MATCH_STALE_THRESHOLD = 3;

interface BrandScanSettings {
  maxScansPerDay: number;
  maxSpendUsdPerDay: number;
  maxParallelScans: number;
  highRiskIntervalHours: number;
  mediumRiskIntervalHours: number;
  lowRiskIntervalHours: number;
  staleIntervalHours: number;
  retryDelayHours: number;
  googleVisionEstimatedCostUsd: number;
  serpapiEstimatedCostUsd: number;
}

interface DailyBudgetUsage {
  scansExecuted: number;
  spendUsd: number;
}

interface ClaimedScanJob {
  id: string;
  brand_id: string;
  name: string;
  storage_path: string;
  fingerprint: string | null;
  scan_provider: string | null;
  scan_attempts: number;
}

interface ScanExecutionResult {
  externalCallMade: boolean;
  estimatedCostUsd: number;
}

const DEFAULT_SCAN_SETTINGS: BrandScanSettings = {
  maxScansPerDay: 250,
  maxSpendUsdPerDay: 25,
  maxParallelScans: 3,
  highRiskIntervalHours: 24,
  mediumRiskIntervalHours: 72,
  lowRiskIntervalHours: 336,
  staleIntervalHours: 720,
  retryDelayHours: SCAN_RETRY_HOURS,
  googleVisionEstimatedCostUsd: GOOGLE_VISION_WEB_DETECTION_USD,
  serpapiEstimatedCostUsd: 0.01,
};

const addHoursToNowIso = (hours: number): string => {
  return new Date(Date.now() + Math.max(1, hours) * 60 * 60 * 1000).toISOString();
};

const nextUtcDayIso = (): string => {
  const next = new Date();
  next.setUTCHours(0, 0, 0, 0);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
};

const providerToSearchProvider = (scanProvider: string | null | undefined): 'google_vision' | 'serpapi_lens' => {
  return scanProvider === SERPAPI_LENS_PROVIDER ? 'serpapi_lens' : 'google_vision';
};

const estimatedProviderCostUsd = (settings: BrandScanSettings, scanProvider: string | null | undefined): number => {
  return scanProvider === SERPAPI_LENS_PROVIDER
    ? settings.serpapiEstimatedCostUsd
    : settings.googleVisionEstimatedCostUsd;
};

const computeAdaptiveNextScanAt = (
  settings: BrandScanSettings,
  matchesFound: number,
  noMatchStreak: number
): string => {
  if (matchesFound >= 5) {
    return addHoursToNowIso(settings.highRiskIntervalHours);
  }

  if (matchesFound > 0) {
    return addHoursToNowIso(settings.mediumRiskIntervalHours);
  }

  if (noMatchStreak >= NO_MATCH_STALE_THRESHOLD) {
    return addHoursToNowIso(settings.staleIntervalHours);
  }

  return addHoursToNowIso(settings.lowRiskIntervalHours);
};

const isMissingTableError = (error: { code?: string; message?: string } | null | undefined): boolean => {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || message.includes('relation') && message.includes('does not exist')
    || message.includes('schema cache');
};

const isMissingRpcError = (error: { code?: string; message?: string } | null | undefined): boolean => {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return error.code === 'PGRST202'
    || (message.includes('function') && message.includes('does not exist'))
    || message.includes('could not find the function');
};

const isMissingColumnError = (error: { code?: string; message?: string } | null | undefined): boolean => {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return error.code === '42703'
    || error.code === 'PGRST204'
    || message.includes('column') && message.includes('does not exist');
};

const UUID_V4_LIKE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isLikelyUuid = (value: string | null | undefined): boolean => {
  if (!value) return false;
  return UUID_V4_LIKE_PATTERN.test(value.trim());
};

const sha256Hex = async (buffer: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const DashboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, currentBrand, isConfigured: isAuthConfigured } = useAuth();
  const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true';
  const isLocalDemoMode = bypassAuth && (!user || !currentBrand);
  const isConfigured = isSupabaseConfigured() && isAuthConfigured;
  const canLoadData = isConfigured && !!user && !!currentBrand;

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedFromSupabase = useRef(false);
  const currentBrandIdRef = useRef<string | null>(null);

  // Theme - white/light default with local persistence
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem('brandog-theme') === 'dark' ? 'dark' : 'light';
  });

  // All data from Supabase
  const [infringements, setInfringements] = useState<InfringementItem[]>([]);
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLogItem[]>([]);
  const [assets, setAssets] = useState<PersistedAsset[]>([]);
  const [takedownRequests, setTakedownRequests] = useState<TakedownRequest[]>([]);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetURLCache] = useState<Map<string, string>>(new Map());
  const localAssetFilesRef = useRef<Map<string, File>>(new Map());
  const scanWorkerRunningRef = useRef(false);

  // Load all data from Supabase
  useEffect(() => {
    const loadSupabaseData = async () => {
      if (!canLoadData || !currentBrand || !user) {
        setIsLoading(false);
        setAssetsLoading(false);
        return;
      }

      // Check if brand changed
      if (currentBrandIdRef.current === currentBrand.id && hasLoadedFromSupabase.current) {
        return;
      }

      currentBrandIdRef.current = currentBrand.id;
      hasLoadedFromSupabase.current = true;
      setIsLoading(true);
      setAssetsLoading(true);

      console.log('[DashboardContext] Loading data from Supabase for brand:', currentBrand.name);

      try {
        // Load infringements
        const { data: infData, error: infError } = await supabase
          .from('infringements')
          .select('*')
          .eq('brand_id', currentBrand.id)
          .order('detected_at', { ascending: false });

        if (infError) {
          console.error('Error loading infringements:', infError);
        } else {
          setInfringements((infData || []).map(inf => transformSupabaseInfringement(inf, currentBrand.name)));
        }

        // Load keywords
        const { data: kwData, error: kwError } = await supabase
          .from('keywords')
          .select('*')
          .eq('brand_id', currentBrand.id)
          .order('created_at', { ascending: false });

        if (kwError) {
          console.error('Error loading keywords:', kwError);
        } else {
          setKeywords((kwData || []).map(transformSupabaseKeyword));
        }

        // Load assets
        const { data: assetData, error: assetError } = await supabase
          .from('assets')
          .select('*')
          .eq('brand_id', currentBrand.id)
          .order('created_at', { ascending: false });

        if (assetError) {
          console.error('Error loading assets:', assetError);
        } else {
          setAssets((assetData || []).map(transformSupabaseAsset));
        }

        // Load activity logs
        const { data: activityData, error: activityError } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (activityError) {
          console.error('Error loading activity:', activityError);
        } else {
          setRecentActivity((activityData || []).map(log => ({
            id: log.id,
            action: log.action,
            target: log.target,
            user: 'You',
            timestamp: new Date(log.created_at),
            type: log.log_type as ActivityLogItem['type'],
            icon: log.icon || undefined,
          })));
        }

        // Load takedown requests with case updates
        const { data: takedownData, error: takedownError } = await supabase
          .from('takedown_requests')
          .select(`
            *,
            infringement:infringements!inner(id, brand_id),
            case_updates(*)
          `)
          .eq('infringement.brand_id', currentBrand.id)
          .order('requested_at', { ascending: false });

        if (takedownError) {
          console.error('Error loading takedowns:', takedownError);
        } else if (takedownData) {
          const transformedTakedowns: TakedownRequest[] = takedownData.map((td: any) => ({
            id: td.id,
            caseId: td.infringement_id,
            originalAssetId: '',
            infringingUrl: '',
            detectedDate: td.requested_at?.split('T')[0] || '',
            platform: 'Website' as PlatformType,
            status: td.status,
            adminNotes: td.admin_notes,
            requestedAt: td.requested_at,
            processedAt: td.processed_at,
            updates: (td.case_updates || []).map((cu: any) => ({
              id: cu.id,
              caseId: td.infringement_id,
              type: cu.update_type,
              message: cu.message,
              createdAt: cu.created_at,
              createdBy: cu.created_by,
              isRead: cu.is_read,
            })),
          }));
          setTakedownRequests(transformedTakedowns);
        }

        console.log('[DashboardContext] Supabase data loaded successfully');
      } catch (error) {
        console.error('Error loading Supabase data:', error);
      } finally {
        setIsLoading(false);
        setAssetsLoading(false);
      }
    };

    loadSupabaseData();
  }, [canLoadData, currentBrand?.id, user?.id]);

  // Reset when brand changes
  useEffect(() => {
    if (currentBrand?.id && currentBrand.id !== currentBrandIdRef.current) {
      hasLoadedFromSupabase.current = false;
      setInfringements([]);
      setKeywords([]);
      setAssets([]);
      setTakedownRequests([]);
    }
  }, [currentBrand?.id]);

  // Theme effect (UI only)
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('brandog-theme', theme);
  }, [theme]);

  // --- Actions ---

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const addNotification = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const addActivity = useCallback(async (action: string, target: string, type: ActivityLogItem['type'] = 'info') => {
    if (!user || !currentBrand) return;

    const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';

    // Save to Supabase
    const { data, error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        brand_id: currentBrand.id,
        action,
        target,
        log_type: type,
        icon,
      })
      .select()
      .single();

    if (!error && data) {
      const newLog: ActivityLogItem = {
        id: data.id,
        action,
        target,
        user: 'You',
        timestamp: new Date(data.created_at),
        type,
        icon,
      };
      setRecentActivity(prev => [newLog, ...prev]);
    }
  }, [user, currentBrand]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Request takedown
  const requestTakedown = useCallback(async (infringementId: string) => {
    const infringement = infringements.find(i => i.id === infringementId);
    if (!infringement) return;

    // Update infringement status in Supabase
    const { error: updateError } = await supabase
      .from('infringements')
      .update({ status: 'pending_review' })
      .eq('id', infringementId);

    if (updateError) {
      addNotification('error', 'Failed to update infringement status');
      return;
    }

    // Update local state
    setInfringements(prev => prev.map(item =>
      item.id === infringementId ? { ...item, status: 'pending_review' as InfringementStatus } : item
    ));

    // Create takedown request in Supabase
    const { data: takedown, error: takedownError } = await supabase
      .from('takedown_requests')
      .insert({
        infringement_id: infringementId,
        status: 'pending_review',
      })
      .select()
      .single();

    if (takedownError || !takedown) {
      addNotification('error', 'Failed to create takedown request');
      return;
    }

    // Create initial case update
    const initialMessage = 'Your takedown request has been received. Our legal team will review your case and begin the enforcement process.';
    const { data: caseUpdate } = await supabase
      .from('case_updates')
      .insert({
        takedown_id: takedown.id,
        update_type: 'takedown_initiated',
        message: initialMessage,
        created_by: 'system',
      })
      .select()
      .single();

    // Update local state
    const newRequest: TakedownRequest = {
      id: takedown.id,
      caseId: infringementId,
      originalAssetId: infringement.originalAssetId || '',
      infringingUrl: infringement.infringingUrl || '',
      detectedDate: infringement.detectedAt,
      platform: infringement.platform,
      status: 'pending_review',
      requestedAt: takedown.requested_at,
      updates: caseUpdate ? [{
        id: caseUpdate.id,
        caseId: infringementId,
        type: 'takedown_initiated',
        message: initialMessage,
        createdAt: caseUpdate.created_at,
        createdBy: 'system',
        isRead: false,
      }] : [],
    };

    setTakedownRequests(prev => [newRequest, ...prev]);
    addNotification('success', 'Takedown request submitted for review');
    addActivity('Takedown Requested', `${infringement.brandName} - ${infringement.sellerName}`, 'info');
  }, [infringements, addNotification, addActivity]);

  const reportInfringement = (id: string) => requestTakedown(id);

  const dismissInfringement = useCallback(async (id: string) => {
    const item = infringements.find(i => i.id === id);

    const { error } = await supabase
      .from('infringements')
      .update({ status: 'rejected' })
      .eq('id', id);

    if (error) {
      addNotification('error', 'Failed to dismiss infringement');
      return;
    }

    setInfringements(prev => prev.map(item =>
      item.id === id ? { ...item, status: 'rejected' as InfringementStatus } : item
    ));

    addNotification('info', 'Case rejected');
    if (item) addActivity('Case Rejected', item.brandName, 'info');
  }, [infringements, addNotification, addActivity]);

  const undoInfringementStatus = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('infringements')
      .update({ status: 'detected' })
      .eq('id', id);

    if (error) {
      addNotification('error', 'Failed to undo status');
      return;
    }

    setInfringements(prev => prev.map(item =>
      item.id === id ? { ...item, status: 'detected' as InfringementStatus } : item
    ));

    addNotification('info', 'Status reverted to Detected');
    addActivity('Status Reverted', 'Case #' + id.slice(0, 8), 'warning');
  }, [addNotification, addActivity]);

  const updateTakedownStatus = useCallback(async (caseId: string, newStatus: InfringementStatus, adminNotes?: string) => {
    // Update infringement
    await supabase
      .from('infringements')
      .update({ status: newStatus })
      .eq('id', caseId);

    // Find and update takedown request
    const takedown = takedownRequests.find(t => t.caseId === caseId);
    if (takedown) {
      await supabase
        .from('takedown_requests')
        .update({
          status: newStatus,
          admin_notes: adminNotes,
          processed_at: new Date().toISOString(),
        })
        .eq('id', takedown.id);
    }

    setInfringements(prev => prev.map(item =>
      item.id === caseId ? { ...item, status: newStatus } : item
    ));

    setTakedownRequests(prev => prev.map(req =>
      req.caseId === caseId ? {
        ...req,
        status: newStatus,
        adminNotes: adminNotes || req.adminNotes,
        processedAt: new Date().toISOString()
      } : req
    ));

    addNotification('success', `Case status updated to ${newStatus.replace('_', ' ')}`);
    addActivity('Case Updated', `Status changed to ${newStatus.replace('_', ' ')}`, 'success');
  }, [takedownRequests, addNotification, addActivity]);

  const getTakedownForCase = (caseId: string): TakedownRequest | undefined => {
    return takedownRequests.find(req => req.caseId === caseId);
  };

  const addCaseUpdate = useCallback(async (caseId: string, type: CaseUpdateType, message: string, createdBy: 'lawyer' | 'system' | 'brand_owner' = 'lawyer') => {
    let takedown = takedownRequests.find(req => req.caseId === caseId);

    // Create takedown request if it doesn't exist
    if (!takedown) {
      const infringement = infringements.find(i => i.id === caseId);
      if (!infringement) return;

      const { data: newTakedown, error } = await supabase
        .from('takedown_requests')
        .insert({
          infringement_id: caseId,
          status: infringement.status,
        })
        .select()
        .single();

      if (error || !newTakedown) {
        addNotification('error', 'Failed to create case');
        return;
      }

      takedown = {
        id: newTakedown.id,
        caseId,
        originalAssetId: infringement.originalAssetId || '',
        infringingUrl: infringement.infringingUrl || '',
        detectedDate: infringement.detectedAt,
        platform: infringement.platform,
        status: infringement.status,
        requestedAt: newTakedown.requested_at,
        updates: [],
      };

      setTakedownRequests(prev => [takedown!, ...prev]);
    }

    // Create case update
    const { data: caseUpdate, error } = await supabase
      .from('case_updates')
      .insert({
        takedown_id: takedown.id,
        update_type: type,
        message,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error || !caseUpdate) {
      addNotification('error', 'Failed to add case update');
      return;
    }

    const newUpdate: CaseUpdate = {
      id: caseUpdate.id,
      caseId,
      type,
      message,
      createdAt: caseUpdate.created_at,
      createdBy,
      isRead: false,
    };

    setTakedownRequests(prev => prev.map(req =>
      req.caseId === caseId
        ? { ...req, updates: [...(req.updates || []), newUpdate] }
        : req
    ));

    addNotification('info', 'Case update sent');
    addActivity('Case Update', `Update sent to case #${caseId.slice(0, 8)}`, 'info');
  }, [takedownRequests, infringements, addNotification, addActivity]);

  const getCaseUpdates = (caseId: string): CaseUpdate[] => {
    const request = takedownRequests.find(req => req.caseId === caseId);
    return request?.updates || [];
  };

  const markUpdatesAsRead = useCallback(async (caseId: string) => {
    const takedown = takedownRequests.find(t => t.caseId === caseId);
    if (!takedown) return;

    await supabase
      .from('case_updates')
      .update({ is_read: true })
      .eq('takedown_id', takedown.id);

    setTakedownRequests(prev => prev.map(req =>
      req.caseId === caseId
        ? { ...req, updates: (req.updates || []).map(u => ({ ...u, isRead: true })) }
        : req
    ));
  }, [takedownRequests]);

  const getUnreadUpdateCount = (caseId: string): number => {
    const request = takedownRequests.find(req => req.caseId === caseId);
    return (request?.updates || []).filter(u => !u.isRead).length;
  };

  const addKeyword = useCallback(async (text: string, type: 'active' | 'negative' | 'suggested') => {
    if (!currentBrand) {
      addNotification('error', 'No brand selected');
      return;
    }

    const { data, error } = await supabase
      .from('keywords')
      .insert({
        brand_id: currentBrand.id,
        text,
        type,
        tags: ['Manual'],
      })
      .select()
      .single();

    if (error) {
      addNotification('error', 'Failed to add keyword');
      return;
    }

    setKeywords(prev => [transformSupabaseKeyword(data), ...prev]);
    addNotification('success', `Keyword "${text}" added`);
    addActivity('Keyword Added', text, 'info');
  }, [currentBrand, isLocalDemoMode, infringements, addActivity]);

  const deleteKeyword = useCallback(async (id: string) => {
    const kw = keywords.find(k => k.id === id);

    const { error } = await supabase
      .from('keywords')
      .delete()
      .eq('id', id);

    if (error) {
      addNotification('error', 'Failed to delete keyword');
      return;
    }

    setKeywords(prev => prev.filter(k => k.id !== id));
    addNotification('info', 'Keyword removed');
    if (kw) addActivity('Keyword Removed', kw.text, 'warning');
  }, [keywords, addNotification, addActivity]);

  const createInfringementFromSearch = useCallback(async (
    result: VisionSearchResult,
    originalAsset: PersistedAsset,
    fallbackImages?: string[],
    options?: CreateInfringementOptions
  ): Promise<CreateInfringementResult> => {
    const normalizedUrl = normalizeExternalUrl(result.url);
    if (!normalizedUrl) {
      return { created: false, reason: 'invalid_url' };
    }

    if (!currentBrand && !isLocalDemoMode) {
      return { created: false, reason: 'db_error' };
    }

    const originalAssetIdForDb = isLikelyUuid(originalAsset.id) ? originalAsset.id : null;
    const domain = extractHostname(normalizedUrl) || 'unknown-domain';

    let platform: PlatformType = 'Website';
    if (domain.includes('instagram')) platform = 'Instagram';
    else if (domain.includes('facebook') || domain.includes('meta')) platform = 'Meta Ads';
    else if (domain.includes('tiktok')) platform = 'TikTok Shop';
    else if (domain.includes('amazon')) platform = 'Amazon';
    else if (domain.includes('aliexpress') || domain.includes('alibaba')) platform = 'AliExpress';
    else if (domain.includes('ebay')) platform = 'eBay';
    else if (domain.includes('shopify') || domain.includes('myshopify')) platform = 'Shopify';

    const copycatImage =
      result.fullMatchingImages[0] ||
      result.partialMatchingImages[0] ||
      (fallbackImages && fallbackImages.length > 0 ? fallbackImages[0] : '');

    let hostingProvider = 'Unknown';
    if (domain.includes('shopify') || domain.includes('myshopify')) hostingProvider = 'Shopify Inc.';
    else if (domain.includes('amazon')) hostingProvider = 'Amazon Web Services';
    else if (domain.includes('aliexpress') || domain.includes('alibaba')) hostingProvider = 'Alibaba Cloud';
    else if (domain.includes('instagram') || domain.includes('facebook')) hostingProvider = 'Meta Platforms';
    else if (domain.includes('tiktok')) hostingProvider = 'ByteDance';

    let registrar = 'Unknown Registrar';
    if (domain.endsWith('.com')) registrar = 'GoDaddy.com, LLC';
    else if (domain.endsWith('.shop')) registrar = 'GMO Registry, Inc.';
    else if (domain.endsWith('.net')) registrar = 'Network Solutions, LLC';

    const similarityScore = computeSimilarityScore(result, Boolean(copycatImage));
    const siteVisitors = Math.floor(Math.random() * 10000) + 100;
    const revenueLost = Math.floor(Math.random() * 1000) + 50;
    const activeSearchProvider = getVisionConfig().provider;
    const defaultDetectionProvider = activeSearchProvider === 'serpapi_lens'
      ? SERPAPI_LENS_PROVIDER
      : GOOGLE_VISION_PROVIDER;
    const defaultDetectionMethod = activeSearchProvider === 'serpapi_lens'
      ? SERPAPI_LENS_METHOD
      : GOOGLE_WEB_DETECTION_METHOD;

    if (!currentBrand && isLocalDemoMode) {
      const duplicate = infringements.some((item) =>
        item.originalAssetId === originalAsset.id &&
        normalizeExternalUrl(item.infringingUrl || '') === normalizedUrl
      );

      if (duplicate) {
        return { created: false, reason: 'duplicate' };
      }

      const localInfringement: InfringementItem = {
        id: `local_inf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        brandName: 'Demo Brand',
        isTrademarked: false,
        originalImage: '',
        copycatImage: copycatImage || '',
        similarityScore,
        siteVisitors,
        platform,
        revenueLost,
        status: 'detected',
        detectedAt: new Date().toISOString().split('T')[0],
        country: 'Unknown',
        originalAssetId: originalAsset.id,
        infringingUrl: normalizedUrl,
        sellerName: result.pageTitle || domain,
        whois: {
          registrar,
          creationDate: 'Not available',
          registrantCountry: 'Unknown',
        },
        hosting: {
          provider: hostingProvider,
          ipAddress: 'Not resolved',
        },
      };

      setInfringements(prev => [localInfringement, ...prev]);
      return { created: true };
    }

    let existingQuery = supabase
      .from('infringements')
      .select('id')
      .eq('brand_id', currentBrand.id)
      .eq('infringing_url', normalizedUrl)
      .limit(1);

    if (originalAssetIdForDb) {
      existingQuery = existingQuery.eq('original_asset_id', originalAssetIdForDb);
    }

    const { data: existing, error: existingError } = await existingQuery;

    if (existingError) {
      console.error('Failed to check duplicate infringement:', existingError);
      return { created: false, reason: 'db_error' };
    }

    if (existing && existing.length > 0) {
      return { created: false, reason: 'duplicate' };
    }

    const fullInsertPayload = {
      brand_id: currentBrand.id,
      original_asset_id: originalAssetIdForDb,
      copycat_image_url: copycatImage,
      similarity_score: similarityScore,
      detection_provider: options?.detectionProvider || defaultDetectionProvider,
      detection_method: options?.detectionMethod || defaultDetectionMethod,
      source_fingerprint: options?.sourceFingerprint || originalAsset.fingerprint || null,
      platform,
      infringing_url: normalizedUrl,
      seller_name: result.pageTitle || domain,
      country: 'Unknown',
      site_visitors: siteVisitors,
      revenue_lost: revenueLost,
      whois_registrar: registrar,
      whois_creation_date: 'Not available',
      whois_registrant_country: 'Unknown',
      hosting_provider: hostingProvider,
      hosting_ip_address: 'Not resolved',
      status: 'detected',
    };

    const { data, error } = await supabase
      .from('infringements')
      .insert(fullInsertPayload)
      .select()
      .single();

    let insertedData = data;
    let insertError = error;

    if (insertError && isMissingColumnError(insertError)) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('infringements')
        .insert({
          brand_id: currentBrand.id,
          original_asset_id: originalAssetIdForDb,
          copycat_image_url: copycatImage,
          similarity_score: similarityScore,
          platform,
          infringing_url: normalizedUrl,
          seller_name: result.pageTitle || domain,
          country: 'Unknown',
          site_visitors: siteVisitors,
          revenue_lost: revenueLost,
          whois_registrar: registrar,
          whois_creation_date: 'Not available',
          whois_registrant_country: 'Unknown',
          hosting_provider: hostingProvider,
          hosting_ip_address: 'Not resolved',
          status: 'detected',
        })
        .select()
        .single();

      insertedData = fallbackData;
      insertError = fallbackError;
    }

    if (insertError) {
      console.error('Failed to create infringement:', insertError);
      if ((insertError as { code?: string }).code === '23505') {
        return { created: false, reason: 'duplicate' };
      }
      return { created: false, reason: 'db_error' };
    }

    if (!insertedData) {
      return { created: false, reason: 'db_error' };
    }

    setInfringements(prev => [transformSupabaseInfringement(insertedData, currentBrand.name), ...prev]);
    addActivity('Infringement Detected', `Found on ${result.pageTitle || domain}`, 'warning');
    return { created: true };
  }, [currentBrand, addActivity]);

  const updateAssetScanState = useCallback(async (
    assetId: string,
    updates: {
      scanStatus?: AssetScanStatus;
      scanAttempts?: number;
      lastScannedAt?: string | null;
      nextScanAt?: string | null;
      scanProvider?: string | null;
      lastScanError?: string | null;
    }
  ): Promise<void> => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.scanStatus !== undefined) dbUpdates.scan_status = updates.scanStatus;
    if (updates.scanAttempts !== undefined) dbUpdates.scan_attempts = updates.scanAttempts;
    if (updates.lastScannedAt !== undefined) dbUpdates.last_scanned_at = updates.lastScannedAt;
    if (updates.nextScanAt !== undefined) dbUpdates.next_scan_at = updates.nextScanAt;
    if (updates.scanProvider !== undefined) dbUpdates.scan_provider = updates.scanProvider;
    if (updates.lastScanError !== undefined) dbUpdates.last_scan_error = updates.lastScanError;

    if (Object.keys(dbUpdates).length === 0) return;

    const isLocalAsset = localAssetFilesRef.current.has(assetId);
    if (isLocalDemoMode || isLocalAsset) {
      setAssets(prev => prev.map(asset => {
        if (asset.id !== assetId) return asset;
        return {
          ...asset,
          scanStatus: updates.scanStatus ?? asset.scanStatus,
          scanAttempts: updates.scanAttempts ?? asset.scanAttempts,
          lastScannedAt: updates.lastScannedAt === undefined ? asset.lastScannedAt : (updates.lastScannedAt || undefined),
          nextScanAt: updates.nextScanAt === undefined ? asset.nextScanAt : (updates.nextScanAt || undefined),
          scanProvider: updates.scanProvider === undefined ? asset.scanProvider : (updates.scanProvider || undefined),
          lastScanError: updates.lastScanError === undefined ? asset.lastScanError : (updates.lastScanError || undefined),
        };
      }));
      return;
    }

    const { error } = await supabase
      .from('assets')
      .update(dbUpdates)
      .eq('id', assetId);

    if (error) {
      console.error('Failed to update asset scan state:', error);
      return;
    }

    setAssets(prev => prev.map(asset => {
      if (asset.id !== assetId) return asset;
      return {
        ...asset,
        scanStatus: updates.scanStatus ?? asset.scanStatus,
        scanAttempts: updates.scanAttempts ?? asset.scanAttempts,
        lastScannedAt: updates.lastScannedAt === undefined ? asset.lastScannedAt : (updates.lastScannedAt || undefined),
        nextScanAt: updates.nextScanAt === undefined ? asset.nextScanAt : (updates.nextScanAt || undefined),
        scanProvider: updates.scanProvider === undefined ? asset.scanProvider : (updates.scanProvider || undefined),
        lastScanError: updates.lastScanError === undefined ? asset.lastScanError : (updates.lastScanError || undefined),
      };
    }));
  }, [isLocalDemoMode]);

  const logScanEvent = useCallback(async (payload: {
    assetId: string;
    status: 'queued' | 'success' | 'failed' | 'skipped';
    startedAt: string;
    finishedAt: string;
    provider?: string;
    matchesFound?: number;
    duplicatesSkipped?: number;
    invalidResults?: number;
    failedResults?: number;
    estimatedCostUsd?: number;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }) => {
    if (!currentBrand || isLocalDemoMode) return;

    const { error } = await supabase
      .from('scan_events')
      .insert({
        brand_id: currentBrand.id,
        asset_id: payload.assetId,
        provider: payload.provider || GOOGLE_VISION_PROVIDER,
        status: payload.status,
        started_at: payload.startedAt,
        finished_at: payload.finishedAt,
        matches_found: payload.matchesFound || 0,
        duplicates_skipped: payload.duplicatesSkipped || 0,
        invalid_results: payload.invalidResults || 0,
        failed_results: payload.failedResults || 0,
        estimated_cost_usd: payload.estimatedCostUsd || null,
        error_message: payload.errorMessage || null,
        metadata: payload.metadata || {},
      });

    if (error) {
      console.error('Failed to log scan event:', error);
    }
  }, [currentBrand, isLocalDemoMode]);

  const loadBrandScanSettings = useCallback(async (brandId: string): Promise<BrandScanSettings> => {
    if (isLocalDemoMode) return DEFAULT_SCAN_SETTINGS;

    const { data, error } = await supabase
      .from('scan_settings')
      .select(`
        max_scans_per_day,
        max_spend_usd_per_day,
        max_parallel_scans,
        high_risk_interval_hours,
        medium_risk_interval_hours,
        low_risk_interval_hours,
        stale_interval_hours,
        retry_delay_hours,
        google_vision_estimated_cost_usd,
        serpapi_estimated_cost_usd
      `)
      .eq('brand_id', brandId)
      .maybeSingle();

    if (error) {
      if (!isMissingTableError(error)) {
        console.error('Failed to load scan settings:', error);
      }
      return DEFAULT_SCAN_SETTINGS;
    }

    if (!data) {
      const { data: inserted, error: insertError } = await supabase
        .from('scan_settings')
        .insert({ brand_id: brandId })
        .select(`
          max_scans_per_day,
          max_spend_usd_per_day,
          max_parallel_scans,
          high_risk_interval_hours,
          medium_risk_interval_hours,
          low_risk_interval_hours,
          stale_interval_hours,
          retry_delay_hours,
          google_vision_estimated_cost_usd,
          serpapi_estimated_cost_usd
        `)
        .single();

      if (insertError || !inserted) {
        if (insertError && !isMissingTableError(insertError)) {
          console.error('Failed to initialize scan settings:', insertError);
        }
        return DEFAULT_SCAN_SETTINGS;
      }

      return {
        maxScansPerDay: inserted.max_scans_per_day ?? DEFAULT_SCAN_SETTINGS.maxScansPerDay,
        maxSpendUsdPerDay: Number(inserted.max_spend_usd_per_day ?? DEFAULT_SCAN_SETTINGS.maxSpendUsdPerDay),
        maxParallelScans: inserted.max_parallel_scans ?? DEFAULT_SCAN_SETTINGS.maxParallelScans,
        highRiskIntervalHours: inserted.high_risk_interval_hours ?? DEFAULT_SCAN_SETTINGS.highRiskIntervalHours,
        mediumRiskIntervalHours: inserted.medium_risk_interval_hours ?? DEFAULT_SCAN_SETTINGS.mediumRiskIntervalHours,
        lowRiskIntervalHours: inserted.low_risk_interval_hours ?? DEFAULT_SCAN_SETTINGS.lowRiskIntervalHours,
        staleIntervalHours: inserted.stale_interval_hours ?? DEFAULT_SCAN_SETTINGS.staleIntervalHours,
        retryDelayHours: inserted.retry_delay_hours ?? DEFAULT_SCAN_SETTINGS.retryDelayHours,
        googleVisionEstimatedCostUsd: Number(inserted.google_vision_estimated_cost_usd ?? DEFAULT_SCAN_SETTINGS.googleVisionEstimatedCostUsd),
        serpapiEstimatedCostUsd: Number(inserted.serpapi_estimated_cost_usd ?? DEFAULT_SCAN_SETTINGS.serpapiEstimatedCostUsd),
      };
    }

    return {
      maxScansPerDay: data.max_scans_per_day ?? DEFAULT_SCAN_SETTINGS.maxScansPerDay,
      maxSpendUsdPerDay: Number(data.max_spend_usd_per_day ?? DEFAULT_SCAN_SETTINGS.maxSpendUsdPerDay),
      maxParallelScans: data.max_parallel_scans ?? DEFAULT_SCAN_SETTINGS.maxParallelScans,
      highRiskIntervalHours: data.high_risk_interval_hours ?? DEFAULT_SCAN_SETTINGS.highRiskIntervalHours,
      mediumRiskIntervalHours: data.medium_risk_interval_hours ?? DEFAULT_SCAN_SETTINGS.mediumRiskIntervalHours,
      lowRiskIntervalHours: data.low_risk_interval_hours ?? DEFAULT_SCAN_SETTINGS.lowRiskIntervalHours,
      staleIntervalHours: data.stale_interval_hours ?? DEFAULT_SCAN_SETTINGS.staleIntervalHours,
      retryDelayHours: data.retry_delay_hours ?? DEFAULT_SCAN_SETTINGS.retryDelayHours,
      googleVisionEstimatedCostUsd: Number(data.google_vision_estimated_cost_usd ?? DEFAULT_SCAN_SETTINGS.googleVisionEstimatedCostUsd),
      serpapiEstimatedCostUsd: Number(data.serpapi_estimated_cost_usd ?? DEFAULT_SCAN_SETTINGS.serpapiEstimatedCostUsd),
    };
  }, [isLocalDemoMode]);

  const loadDailyBudgetUsage = useCallback(async (brandId: string): Promise<DailyBudgetUsage> => {
    if (isLocalDemoMode) {
      return { scansExecuted: 0, spendUsd: 0 };
    }

    const todayUtc = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('scan_budget_daily')
      .select('scans_executed, spend_usd')
      .eq('brand_id', brandId)
      .eq('budget_date', todayUtc)
      .maybeSingle();

    if (error) {
      if (!isMissingTableError(error)) {
        console.error('Failed to load scan budget usage:', error);
      }
      return { scansExecuted: 0, spendUsd: 0 };
    }

    return {
      scansExecuted: data?.scans_executed ?? 0,
      spendUsd: Number(data?.spend_usd ?? 0),
    };
  }, [isLocalDemoMode]);

  const syncClaimedJobsToAssetState = useCallback((jobs: ClaimedScanJob[]): void => {
    if (jobs.length === 0) return;
    const byId = new Map(jobs.map((job) => [job.id, job]));
    setAssets(prev => prev.map((asset) => {
      const claimed = byId.get(asset.id);
      if (!claimed) return asset;
      return {
        ...asset,
        scanStatus: 'scanning',
        scanAttempts: claimed.scan_attempts,
        scanProvider: claimed.scan_provider || asset.scanProvider,
        lastScanError: undefined,
      };
    }));
  }, []);

  const claimDueScanJobs = useCallback(async (brandId: string, limit: number): Promise<ClaimedScanJob[]> => {
    const safeLimit = Math.max(1, Math.min(limit, MAX_SCAN_CLAIM_BATCH_SIZE));

    const { data: claimedViaRpc, error: rpcError } = await supabase.rpc('claim_due_asset_scans', {
      p_brand_id: brandId,
      p_limit: safeLimit,
    });

    if (!rpcError && claimedViaRpc) {
      const claimedJobs = claimedViaRpc as ClaimedScanJob[];
      syncClaimedJobsToAssetState(claimedJobs);
      return claimedJobs;
    }

    if (rpcError && !isMissingRpcError(rpcError)) {
      console.error('Failed to claim scan jobs via RPC:', rpcError);
      return [];
    }

    const nowIso = new Date().toISOString();
    const { data: dueAssets, error: dueError } = await supabase
      .from('assets')
      .select('id, brand_id, name, storage_path, fingerprint, scan_provider, scan_attempts')
      .eq('brand_id', brandId)
      .eq('type', 'image')
      .in('scan_status', ['queued', 'failed', 'success'])
      .not('next_scan_at', 'is', null)
      .lte('next_scan_at', nowIso)
      .order('next_scan_at', { ascending: true })
      .limit(safeLimit);

    if (dueError || !dueAssets || dueAssets.length === 0) {
      if (dueError) {
        if (!isMissingColumnError(dueError) && !isMissingTableError(dueError)) {
          console.error('Failed to fetch due scan jobs fallback:', dueError);
        }
      }
      return [];
    }

    const claimedFallback: ClaimedScanJob[] = [];
    for (const row of dueAssets) {
      const updatedAttempts = (row.scan_attempts || 0) + 1;
      const { error: claimError } = await supabase
        .from('assets')
        .update({
          scan_status: 'scanning',
          scan_attempts: updatedAttempts,
          last_scan_error: null,
        })
        .eq('id', row.id)
        .in('scan_status', ['queued', 'failed', 'success']);

      if (claimError) {
        console.error('Failed to claim fallback scan job:', claimError);
        continue;
      }

      claimedFallback.push({
        id: row.id,
        brand_id: row.brand_id,
        name: row.name,
        storage_path: row.storage_path,
        fingerprint: row.fingerprint,
        scan_provider: row.scan_provider,
        scan_attempts: updatedAttempts,
      });
    }

    syncClaimedJobsToAssetState(claimedFallback);
    return claimedFallback;
  }, [syncClaimedJobsToAssetState]);

  const getAssetBase64FromStoragePath = useCallback(async (storagePath: string): Promise<string> => {
    const { data: blob, error } = await supabase.storage
      .from('assets')
      .download(storagePath);

    if (error || !blob) {
      throw new Error('Failed to download asset from storage for scanning.');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string | null;
        if (!result) {
          reject(new Error('Failed to convert scan asset to base64.'));
          return;
        }
        const base64 = result.split(',')[1];
        if (!base64) {
          reject(new Error('Failed to extract base64 data from scan asset.'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read scan asset.'));
      reader.readAsDataURL(blob);
    });
  }, []);

  const getRecentNoMatchStreak = useCallback(async (assetId: string): Promise<number> => {
    if (isLocalDemoMode) return 0;

    const { data, error } = await supabase
      .from('scan_events')
      .select('status, matches_found')
      .eq('asset_id', assetId)
      .order('started_at', { ascending: false })
      .limit(NO_MATCH_STALE_THRESHOLD);

    if (error) {
      if (!isMissingTableError(error)) {
        console.error('Failed to compute no-match streak:', error);
      }
      return 0;
    }

    let streak = 0;
    for (const event of data || []) {
      const matches = event.matches_found || 0;
      if ((event.status === 'success' || event.status === 'skipped') && matches === 0) {
        streak += 1;
        continue;
      }
      break;
    }
    return streak;
  }, [isLocalDemoMode]);

  const recordDailyBudgetUsage = useCallback(async (
    brandId: string,
    scanIncrement: number,
    spendIncrementUsd: number
  ): Promise<void> => {
    if (isLocalDemoMode) return;
    if (scanIncrement <= 0 && spendIncrementUsd <= 0) return;

    const budgetDate = new Date().toISOString().slice(0, 10);
    const normalizedScanIncrement = Math.max(0, scanIncrement);
    const normalizedSpendIncrement = Math.max(0, spendIncrementUsd);

    const { error: rpcError } = await supabase.rpc('record_scan_budget_usage', {
      p_brand_id: brandId,
      p_budget_date: budgetDate,
      p_scan_increment: normalizedScanIncrement,
      p_spend_increment: normalizedSpendIncrement,
    });

    if (!rpcError) return;
    if (!isMissingRpcError(rpcError)) {
      console.error('Failed to record scan budget usage via RPC:', rpcError);
      return;
    }

    const { data: existing, error: existingError } = await supabase
      .from('scan_budget_daily')
      .select('scans_executed, spend_usd')
      .eq('brand_id', brandId)
      .eq('budget_date', budgetDate)
      .maybeSingle();

    if (existingError) {
      if (!isMissingTableError(existingError)) {
        console.error('Failed to read fallback scan budget usage:', existingError);
      }
      return;
    }

    if (!existing) {
      const { error: insertError } = await supabase
        .from('scan_budget_daily')
        .insert({
          brand_id: brandId,
          budget_date: budgetDate,
          scans_executed: normalizedScanIncrement,
          spend_usd: normalizedSpendIncrement,
        });

      if (insertError && !isMissingTableError(insertError)) {
        console.error('Failed to create fallback scan budget usage row:', insertError);
      }
      return;
    }

    const { error: updateError } = await supabase
      .from('scan_budget_daily')
      .update({
        scans_executed: (existing.scans_executed || 0) + normalizedScanIncrement,
        spend_usd: Number(existing.spend_usd || 0) + normalizedSpendIncrement,
      })
      .eq('brand_id', brandId)
      .eq('budget_date', budgetDate);

    if (updateError && !isMissingTableError(updateError)) {
      console.error('Failed to update fallback scan budget usage row:', updateError);
    }
  }, [isLocalDemoMode]);

  const processClaimedScanJob = useCallback(async (
    job: ClaimedScanJob,
    settings: BrandScanSettings
  ): Promise<ScanExecutionResult> => {
    if (!currentBrand) {
      return { externalCallMade: false, estimatedCostUsd: 0 };
    }

    const startedAt = new Date().toISOString();
    const detectionProvider = job.scan_provider || GOOGLE_VISION_PROVIDER;
    const detectionMethod = detectionProvider === SERPAPI_LENS_PROVIDER
      ? SERPAPI_LENS_METHOD
      : GOOGLE_WEB_DETECTION_METHOD;
    const estimatedCostUsd = estimatedProviderCostUsd(settings, detectionProvider);
    let externalCallMade = false;

    const persistedAsset: PersistedAsset = assets.find((asset) => asset.id === job.id) || {
      id: job.id,
      type: 'image',
      name: job.name,
      mimeType: 'image/*',
      protected: true,
      dateAdded: Date.now(),
      fingerprint: job.fingerprint || undefined,
      scanStatus: 'scanning',
      scanAttempts: job.scan_attempts,
      scanProvider: detectionProvider,
    };

    try {
      if (job.fingerprint) {
        const { data: recentScanData, error: recentScanError } = await supabase
          .from('assets')
          .select('id, last_scanned_at')
          .eq('brand_id', currentBrand.id)
          .eq('fingerprint', job.fingerprint)
          .eq('scan_status', 'success')
          .not('last_scanned_at', 'is', null)
          .neq('id', job.id)
          .order('last_scanned_at', { ascending: false })
          .limit(1);

        if (recentScanError) {
          console.error('Failed to check recent fingerprint scans:', recentScanError);
        } else if (recentScanData && recentScanData.length > 0 && recentScanData[0].last_scanned_at) {
          const lastScanTimestamp = Date.parse(recentScanData[0].last_scanned_at);
          const freshnessWindowMs = RECENT_FINGERPRINT_SCAN_HOURS * 60 * 60 * 1000;

          if (Number.isFinite(lastScanTimestamp) && (Date.now() - lastScanTimestamp) < freshnessWindowMs) {
            const reusedAssetId = recentScanData[0].id;
            let clonedInfringements = 0;

            const { data: existingMatches, error: existingMatchesError } = await supabase
              .from('infringements')
              .select('*')
              .eq('brand_id', currentBrand.id)
              .eq('original_asset_id', reusedAssetId);

            if (existingMatchesError) {
              console.error('Failed to load reused fingerprint matches:', existingMatchesError);
            } else if (existingMatches && existingMatches.length > 0) {
              const cloneRows = existingMatches.map((match: any) => ({
                brand_id: currentBrand.id,
                original_asset_id: job.id,
                copycat_image_url: match.copycat_image_url,
                similarity_score: match.similarity_score,
                detection_provider: detectionProvider,
                detection_method: 'fingerprint_reuse',
                source_fingerprint: job.fingerprint || match.source_fingerprint || null,
                platform: match.platform,
                infringing_url: match.infringing_url,
                seller_name: match.seller_name,
                country: match.country,
                site_visitors: match.site_visitors,
                revenue_lost: match.revenue_lost,
                whois_registrar: match.whois_registrar,
                whois_creation_date: match.whois_creation_date,
                whois_registrant_country: match.whois_registrant_country,
                hosting_provider: match.hosting_provider,
                hosting_ip_address: match.hosting_ip_address,
                status: match.status || 'detected',
              }));

              const { data: clonedRows, error: cloneError } = await supabase
                .from('infringements')
                .insert(cloneRows)
                .select();

              if (cloneError) {
                console.error('Failed to clone infringements for reused fingerprint:', cloneError);
              } else if (clonedRows && clonedRows.length > 0) {
                clonedInfringements = clonedRows.length;
                setInfringements(prev => [
                  ...clonedRows.map((row: any) => transformSupabaseInfringement(row, currentBrand.name)),
                  ...prev,
                ]);
              }
            }

            const noMatchStreak = clonedInfringements > 0
              ? 0
              : (await getRecentNoMatchStreak(job.id)) + 1;
            const finishedAt = new Date().toISOString();
            const nextScanAt = computeAdaptiveNextScanAt(settings, clonedInfringements, noMatchStreak);

            await updateAssetScanState(job.id, {
              scanStatus: 'skipped',
              scanAttempts: job.scan_attempts,
              lastScannedAt: finishedAt,
              nextScanAt,
              scanProvider: detectionProvider,
              lastScanError: null,
            });

            await logScanEvent({
              assetId: job.id,
              status: 'skipped',
              startedAt,
              finishedAt,
              provider: detectionProvider,
              matchesFound: clonedInfringements,
              metadata: {
                reason: 'recent_fingerprint_scan',
                reusedAssetId,
                clonedInfringements,
                noMatchStreak,
                worker: true,
              },
            });

            return { externalCallMade: false, estimatedCostUsd: 0 };
          }
        }
      }

      const imageBase64 = await getAssetBase64FromStoragePath(job.storage_path);

      let providerImageUrl: string | undefined;
      if (detectionProvider === SERPAPI_LENS_PROVIDER) {
        providerImageUrl = await getStorageUrl(job.storage_path, SERPAPI_SIGNED_URL_TTL_SECONDS);
        if (!providerImageUrl) {
          throw new Error('SerpApi scan requires a signed storage URL, but one could not be created for this asset.');
        }
      }

      externalCallMade = true;
      const searchResults = await searchByImage(imageBase64, {
        providerOverride: providerToSearchProvider(detectionProvider),
        imageUrl: providerImageUrl,
      });

      const globalMatchingImages = [
        ...searchResults.fullMatchingImages.map(img => img.url),
        ...searchResults.partialMatchingImages.map(img => img.url),
        ...searchResults.visuallySimilarImages.map(img => img.url),
      ];

      let createdCount = 0;
      let duplicateCount = 0;
      let invalidUrlCount = 0;
      let failedCount = 0;

      for (const result of searchResults.pagesWithMatchingImages) {
        const hasPageImages = result.fullMatchingImages.length > 0 || result.partialMatchingImages.length > 0;
        const hasFallbackImages = globalMatchingImages.length > 0;

        if (!hasPageImages && !hasFallbackImages) continue;

        const creationResult = await createInfringementFromSearch(
          result,
          persistedAsset,
          globalMatchingImages,
          {
            detectionProvider,
            detectionMethod,
            sourceFingerprint: persistedAsset.fingerprint,
          }
        );

        if (creationResult.created) {
          createdCount += 1;
        } else if (creationResult.reason === 'duplicate') {
          duplicateCount += 1;
        } else if (creationResult.reason === 'invalid_url') {
          invalidUrlCount += 1;
        } else {
          failedCount += 1;
        }
      }

      const noMatchStreak = createdCount > 0
        ? 0
        : (await getRecentNoMatchStreak(job.id)) + 1;
      const finishedAt = new Date().toISOString();
      const nextScanAt = computeAdaptiveNextScanAt(settings, createdCount, noMatchStreak);

      await updateAssetScanState(job.id, {
        scanStatus: 'success',
        scanAttempts: job.scan_attempts,
        lastScannedAt: finishedAt,
        nextScanAt,
        scanProvider: detectionProvider,
        lastScanError: null,
      });

      await logScanEvent({
        assetId: job.id,
        status: 'success',
        startedAt,
        finishedAt,
        provider: detectionProvider,
        matchesFound: createdCount,
        duplicatesSkipped: duplicateCount,
        invalidResults: invalidUrlCount,
        failedResults: failedCount,
        estimatedCostUsd,
        metadata: {
          pagesWithMatchingImages: searchResults.pagesWithMatchingImages.length,
          fullMatchingImages: searchResults.fullMatchingImages.length,
          partialMatchingImages: searchResults.partialMatchingImages.length,
          visuallySimilarImages: searchResults.visuallySimilarImages.length,
          noMatchStreak,
          worker: true,
        },
      });

      if (createdCount > 0) {
        addNotification('success', `Found ${createdCount} new potential infringement${createdCount > 1 ? 's' : ''} for "${job.name}"`);
      }

      return {
        externalCallMade,
        estimatedCostUsd: externalCallMade ? estimatedCostUsd : 0,
      };
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const retryAt = addHoursToNowIso(settings.retryDelayHours || SCAN_RETRY_HOURS);
      const message = error instanceof Error ? error.message : 'Unknown error';

      await updateAssetScanState(job.id, {
        scanStatus: 'failed',
        scanAttempts: job.scan_attempts,
        lastScannedAt: finishedAt,
        nextScanAt: retryAt,
        scanProvider: detectionProvider,
        lastScanError: message,
      });

      await logScanEvent({
        assetId: job.id,
        status: 'failed',
        startedAt,
        finishedAt,
        provider: detectionProvider,
        estimatedCostUsd: externalCallMade ? estimatedCostUsd : undefined,
        errorMessage: message,
        metadata: { worker: true },
      });

      console.error(`Web scan failed for "${job.name}":`, error);

      return {
        externalCallMade,
        estimatedCostUsd: externalCallMade ? estimatedCostUsd : 0,
      };
    } finally {
      if (externalCallMade) {
        await recordDailyBudgetUsage(currentBrand.id, 1, estimatedCostUsd);
      }
    }
  }, [
    currentBrand,
    assets,
    getRecentNoMatchStreak,
    getAssetBase64FromStoragePath,
    createInfringementFromSearch,
    updateAssetScanState,
    logScanEvent,
    addNotification,
    recordDailyBudgetUsage,
  ]);

  const runScanWorkerCycle = useCallback(async (): Promise<void> => {
    if (!canLoadData || !currentBrand || isLocalDemoMode || scanWorkerRunningRef.current) {
      return;
    }

    scanWorkerRunningRef.current = true;
    try {
      const settings = await loadBrandScanSettings(currentBrand.id);
      const budget = await loadDailyBudgetUsage(currentBrand.id);

      const remainingScans = Math.max(0, settings.maxScansPerDay - budget.scansExecuted);
      const remainingSpend = Math.max(0, settings.maxSpendUsdPerDay - budget.spendUsd);
      if (remainingScans <= 0 || remainingSpend <= 0) return;

      const claimLimit = Math.max(
        1,
        Math.min(MAX_SCAN_CLAIM_BATCH_SIZE, settings.maxParallelScans, remainingScans)
      );
      const claimedJobs = await claimDueScanJobs(currentBrand.id, claimLimit);
      if (claimedJobs.length === 0) return;

      let projectedScans = budget.scansExecuted;
      let projectedSpend = budget.spendUsd;
      const executableJobs: ClaimedScanJob[] = [];
      const deferredJobs: ClaimedScanJob[] = [];

      for (const job of claimedJobs) {
        const estimatedCost = estimatedProviderCostUsd(settings, job.scan_provider);
        if (projectedScans + 1 > settings.maxScansPerDay || projectedSpend + estimatedCost > settings.maxSpendUsdPerDay) {
          deferredJobs.push(job);
          continue;
        }
        executableJobs.push(job);
        projectedScans += 1;
        projectedSpend += estimatedCost;
      }

      if (deferredJobs.length > 0) {
        const resumeAt = nextUtcDayIso();
        await Promise.all(deferredJobs.map(async (job) => {
          await updateAssetScanState(job.id, {
            scanStatus: 'queued',
            scanAttempts: Math.max(0, job.scan_attempts - 1),
            nextScanAt: resumeAt,
            scanProvider: job.scan_provider,
            lastScanError: 'Paused until daily scan budget resets.',
          });

          const now = new Date().toISOString();
          await logScanEvent({
            assetId: job.id,
            status: 'skipped',
            startedAt: now,
            finishedAt: now,
            provider: job.scan_provider || GOOGLE_VISION_PROVIDER,
            metadata: {
              reason: 'budget_cap',
              resumeAt,
              worker: true,
            },
          });
        }));
      }

      if (executableJobs.length === 0) return;
      await Promise.all(executableJobs.map((job) => processClaimedScanJob(job, settings)));
    } catch (error) {
      console.error('Scan worker cycle failed:', error);
    } finally {
      scanWorkerRunningRef.current = false;
    }
  }, [
    canLoadData,
    currentBrand,
    isLocalDemoMode,
    loadBrandScanSettings,
    loadDailyBudgetUsage,
    claimDueScanJobs,
    updateAssetScanState,
    logScanEvent,
    processClaimedScanJob,
  ]);

  const addAsset = useCallback(async (file: File): Promise<string> => {
    const mimeType = getMimeType(file);
    const type = getAssetType(mimeType);
    const visionConfig = getVisionConfig();
    const visionEnabled = isVisionConfigured();
    const activeSearchProvider = visionConfig.provider;
    const detectionProvider = activeSearchProvider === 'serpapi_lens'
      ? SERPAPI_LENS_PROVIDER
      : GOOGLE_VISION_PROVIDER;
    const detectionMethod = activeSearchProvider === 'serpapi_lens'
      ? SERPAPI_LENS_METHOD
      : GOOGLE_WEB_DETECTION_METHOD;
    const estimatedScanCostUsd = activeSearchProvider === 'serpapi_lens'
      ? undefined
      : GOOGLE_VISION_WEB_DETECTION_USD;
    const nowIso = new Date().toISOString();

    let content: string | undefined;
    if (type === 'text') {
      try {
        content = await readTextContent(file);
      } catch {
        content = 'Unable to read text content';
      }
    }

    let imageBuffer: ArrayBuffer | undefined;
    let imageBase64: string | undefined;
    let fingerprint: string | undefined;

    if (type === 'image') {
      imageBuffer = await fileToArrayBuffer(file);
      imageBase64 = arrayBufferToBase64(imageBuffer);
      fingerprint = await sha256Hex(imageBuffer);
    }

    if (isLocalDemoMode) {
      if (type === 'image' && fingerprint) {
        const existing = assets.find((asset) => asset.fingerprint === fingerprint);
        if (existing) {
          addNotification('info', `Skipped duplicate upload. "${existing.name}" already exists in protected assets.`);
          return existing.id;
        }
      }

      const localAssetId = `local_asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const localAsset: PersistedAsset = {
        id: localAssetId,
        type,
        name: file.name,
        mimeType,
        protected: true,
        dateAdded: Date.now(),
        content,
        fingerprint,
        scanStatus: type === 'image' ? (visionEnabled ? 'queued' : 'pending') : 'skipped',
        scanAttempts: 0,
        scanProvider: type === 'image' && visionEnabled ? detectionProvider : undefined,
      };

      localAssetFilesRef.current.set(localAssetId, file);
      if (type !== 'text') {
        const objectUrl = URL.createObjectURL(file);
        assetURLCache.set(localAssetId, objectUrl);
      }
      setAssets(prev => [localAsset, ...prev]);

      if (type !== 'image') {
        return localAssetId;
      }

      if (!visionEnabled) {
        addNotification('info', 'Configure a reverse image search provider in Settings to enable automatic infringement detection');
        return localAssetId;
      }

      if (!imageBase64) {
        addNotification('error', 'Image upload saved, but scan could not start because the file data was unavailable.');
        return localAssetId;
      }

      if (activeSearchProvider === 'serpapi_lens') {
        addNotification(
          'info',
          'SerpApi Google Lens requires a remotely accessible image URL. Disable auth bypass or sign in so assets upload to Supabase first.'
        );
        return localAssetId;
      }

      (async () => {
        const startedAt = new Date().toISOString();
        const currentAttempts = 1;

        await updateAssetScanState(localAssetId, {
          scanStatus: 'scanning',
          scanAttempts: currentAttempts,
          scanProvider: detectionProvider,
          lastScanError: null,
        });

        try {
          addNotification('info', `Scanning web for "${file.name}"...`);
          const searchResults = await searchByImage(imageBase64);

          const globalMatchingImages = [
            ...searchResults.fullMatchingImages.map(img => img.url),
            ...searchResults.partialMatchingImages.map(img => img.url),
            ...searchResults.visuallySimilarImages.map(img => img.url)
          ];

          let createdCount = 0;
          let duplicateCount = 0;
          let invalidUrlCount = 0;
          let failedCount = 0;

          for (const result of searchResults.pagesWithMatchingImages) {
            const hasPageImages = result.fullMatchingImages.length > 0 || result.partialMatchingImages.length > 0;
            const hasFallbackImages = globalMatchingImages.length > 0;

            if (hasPageImages || hasFallbackImages) {
              const creationResult = await createInfringementFromSearch(
                result,
                localAsset,
                globalMatchingImages,
                {
                  detectionProvider: detectionProvider,
                  detectionMethod: detectionMethod,
                  sourceFingerprint: localAsset.fingerprint,
                }
              );
              if (creationResult.created) {
                createdCount++;
              } else if (creationResult.reason === 'duplicate') {
                duplicateCount++;
              } else if (creationResult.reason === 'invalid_url') {
                invalidUrlCount++;
              } else {
                failedCount++;
              }
            }
          }

          const finishedAt = new Date().toISOString();
          const nextScanAt = new Date(Date.now() + DEFAULT_RESCAN_DAYS * 24 * 60 * 60 * 1000).toISOString();

          await updateAssetScanState(localAssetId, {
            scanStatus: 'success',
            scanAttempts: currentAttempts,
            lastScannedAt: finishedAt,
            nextScanAt,
            scanProvider: detectionProvider,
            lastScanError: null,
          });

          await logScanEvent({
            assetId: localAssetId,
            status: 'success',
            startedAt,
            finishedAt,
            provider: detectionProvider,
            matchesFound: createdCount,
            duplicatesSkipped: duplicateCount,
            invalidResults: invalidUrlCount,
            failedResults: failedCount,
            estimatedCostUsd: estimatedScanCostUsd,
            metadata: {
              pagesWithMatchingImages: searchResults.pagesWithMatchingImages.length,
              fullMatchingImages: searchResults.fullMatchingImages.length,
              partialMatchingImages: searchResults.partialMatchingImages.length,
              visuallySimilarImages: searchResults.visuallySimilarImages.length,
              mode: 'local_demo',
            },
          });

          if (createdCount > 0) {
            addNotification('success', `Found ${createdCount} new potential infringement${createdCount > 1 ? 's' : ''}`);
          } else {
            addNotification('info', `No infringements found for "${file.name}"`);
          }

          if (duplicateCount > 0) {
            addNotification('info', `Skipped ${duplicateCount} match${duplicateCount > 1 ? 'es' : ''} already tracked for this asset`);
          }

          if (invalidUrlCount > 0 || failedCount > 0) {
            addNotification('error', `Skipped ${invalidUrlCount + failedCount} match${invalidUrlCount + failedCount > 1 ? 'es' : ''} due to validation or save errors`);
          }
        } catch (error) {
          const finishedAt = new Date().toISOString();
          const retryAt = new Date(Date.now() + SCAN_RETRY_HOURS * 60 * 60 * 1000).toISOString();
          const message = error instanceof Error ? error.message : 'Unknown error';

          await updateAssetScanState(localAssetId, {
            scanStatus: 'failed',
            scanAttempts: currentAttempts,
            lastScannedAt: finishedAt,
            nextScanAt: retryAt,
            scanProvider: detectionProvider,
            lastScanError: message,
          });

          await logScanEvent({
            assetId: localAssetId,
            status: 'failed',
            startedAt,
            finishedAt,
            provider: detectionProvider,
            estimatedCostUsd: estimatedScanCostUsd,
            errorMessage: message,
            metadata: { mode: 'local_demo' },
          });

          addNotification('error', `Web scan failed: ${message}`);
        }
      })();

      return localAssetId;
    }

    if (!user || !currentBrand) {
      throw new Error('Not authenticated or no brand selected');
    }

    if (type === 'image') {

      const { data: fingerprintMatches, error: fingerprintError } = await supabase
        .from('assets')
        .select('id, name')
        .eq('brand_id', currentBrand.id)
        .eq('fingerprint', fingerprint)
        .limit(1);

      if (fingerprintError) {
        console.error('Fingerprint dedupe check failed:', fingerprintError);
      } else if (fingerprintMatches && fingerprintMatches.length > 0) {
        const existing = fingerprintMatches[0];
        addNotification('info', `Skipped duplicate upload. "${existing.name}" already exists in protected assets.`);
        return existing.id;
      }
    }

    // Upload to Supabase Storage
    const { path, error: uploadError } = await uploadToStorage(user.id, currentBrand.id, file);
    if (uploadError) {
      const isMissingBucket = uploadError.message.toLowerCase().includes('bucket not found');
      if (isMissingBucket) {
        const localFallbackId = `local_asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const localAsset: PersistedAsset = {
          id: localFallbackId,
          type,
          name: file.name,
          mimeType,
          protected: true,
          dateAdded: Date.now(),
          content,
          fingerprint,
          scanStatus: type === 'image' ? 'pending' : 'skipped',
          scanAttempts: 0,
          scanProvider: type === 'image' && visionEnabled ? detectionProvider : undefined,
          lastScanError: visionEnabled
            ? 'Automatic scan disabled because Supabase storage bucket "assets" is missing.'
            : undefined,
        };

        localAssetFilesRef.current.set(localFallbackId, file);
        if (type !== 'text') {
          const objectUrl = URL.createObjectURL(file);
          assetURLCache.set(localFallbackId, objectUrl);
        }
        setAssets(prev => [localAsset, ...prev]);

        addNotification(
          'info',
          'Storage bucket "assets" is missing in Supabase. Saved this asset locally for this session.'
        );
        return localFallbackId;
      }

      addNotification('error', 'Failed to upload file');
      throw uploadError;
    }

    const initialScanStatus: AssetScanStatus = type !== 'image'
      ? 'skipped'
      : visionEnabled
        ? 'queued'
        : 'pending';

    // Create asset record in database
    const { data, error: dbError } = await supabase
      .from('assets')
      .insert({
        brand_id: currentBrand.id,
        type,
        name: file.name,
        mime_type: mimeType,
        storage_path: path,
        is_protected: true,
        content,
        file_size: file.size,
        fingerprint,
        scan_status: initialScanStatus,
        scan_attempts: 0,
        next_scan_at: type === 'image' && visionEnabled ? nowIso : null,
        scan_provider: type === 'image' && visionEnabled ? detectionProvider : null,
      })
      .select()
      .single();

    if (dbError) {
      addNotification('error', 'Failed to save asset');
      throw dbError;
    }

    const persistedAsset: PersistedAsset = transformSupabaseAsset(data);
    setAssets(prev => [persistedAsset, ...prev]);
    addActivity('Asset Added', file.name, 'success');

    if (type !== 'image') {
      return data.id;
    }

    if (!visionEnabled) {
      addNotification('info', 'Configure a reverse image search provider in Settings to enable automatic infringement detection');
      return data.id;
    }

    const queuedAt = new Date().toISOString();
    await logScanEvent({
      assetId: persistedAsset.id,
      status: 'queued',
      startedAt: queuedAt,
      finishedAt: queuedAt,
      provider: detectionProvider,
      estimatedCostUsd: estimatedProviderCostUsd(DEFAULT_SCAN_SETTINGS, detectionProvider),
      metadata: {
        reason: 'asset_uploaded',
        worker: true,
      },
    });

    addNotification('info', `Queued "${file.name}" for continuous web scanning.`);
    void runScanWorkerCycle();
    return data.id;
  }, [
    user,
    currentBrand,
    isLocalDemoMode,
    assets,
    assetURLCache,
    addNotification,
    addActivity,
    createInfringementFromSearch,
    updateAssetScanState,
    logScanEvent,
    runScanWorkerCycle,
  ]);

  useEffect(() => {
    if (!canLoadData || !currentBrand || isLocalDemoMode) {
      return;
    }

    void runScanWorkerCycle();
    const intervalId = window.setInterval(() => {
      void runScanWorkerCycle();
    }, SCAN_WORKER_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      scanWorkerRunningRef.current = false;
    };
  }, [canLoadData, currentBrand?.id, isLocalDemoMode, runScanWorkerCycle]);

  const deleteAsset = useCallback(async (id: string): Promise<void> => {
    const asset = assets.find(a => a.id === id);
    const localFile = localAssetFilesRef.current.get(id);

    if (localFile) {
      localAssetFilesRef.current.delete(id);

      const cachedURL = assetURLCache.get(id);
      if (cachedURL) {
        URL.revokeObjectURL(cachedURL);
        assetURLCache.delete(id);
      }

      setAssets(prev => prev.filter(a => a.id !== id));
      if (asset) {
        addNotification('info', 'Asset deleted');
      }
      return;
    }

    // Get storage path from database
    const { data } = await supabase
      .from('assets')
      .select('storage_path')
      .eq('id', id)
      .single();

    if (data?.storage_path) {
      await deleteFromStorage(data.storage_path);
    }

    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', id);

    if (error) {
      addNotification('error', 'Failed to delete asset');
      return;
    }

    const cachedURL = assetURLCache.get(id);
    if (cachedURL) {
      URL.revokeObjectURL(cachedURL);
      assetURLCache.delete(id);
    }

    setAssets(prev => prev.filter(a => a.id !== id));
    if (asset) {
      addNotification('info', 'Asset deleted');
      addActivity('Asset Deleted', asset.name, 'warning');
    }
  }, [assets, assetURLCache, addNotification, addActivity]);

  const getAssetURL = useCallback(async (id: string): Promise<string> => {
    const cached = assetURLCache.get(id);
    if (cached) return cached;

    const localFile = localAssetFilesRef.current.get(id);
    if (localFile) {
      const objectUrl = URL.createObjectURL(localFile);
      assetURLCache.set(id, objectUrl);
      return objectUrl;
    }

    const { data } = await supabase
      .from('assets')
      .select('storage_path')
      .eq('id', id)
      .single();

    if (data?.storage_path) {
      const url = await getStorageUrl(data.storage_path);
      assetURLCache.set(id, url);
      return url;
    }
    throw new Error('Asset not found');
  }, [assetURLCache]);

  const getAssetBase64 = useCallback(async (id: string): Promise<string> => {
    const localFile = localAssetFilesRef.current.get(id);
    if (localFile) {
      const buffer = await fileToArrayBuffer(localFile);
      return arrayBufferToBase64(buffer);
    }

    const { data } = await supabase
      .from('assets')
      .select('storage_path')
      .eq('id', id)
      .single();

    if (!data?.storage_path) throw new Error('Asset not found');

    // Download from storage and convert to base64
    const { data: blob, error } = await supabase.storage
      .from('assets')
      .download(data.storage_path);

    if (error || !blob) throw new Error('Failed to download asset');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  const resetData = async () => {
    if (!currentBrand) return;

    // Delete all data for current brand from Supabase
    await supabase.from('infringements').delete().eq('brand_id', currentBrand.id);
    await supabase.from('keywords').delete().eq('brand_id', currentBrand.id);
    await supabase.from('assets').delete().eq('brand_id', currentBrand.id);

    // Reset local state
    setInfringements([]);
    setKeywords([]);
    setAssets([]);
    setTakedownRequests([]);

    addNotification('success', 'All data has been reset');
  };

  return (
    <DashboardContext.Provider value={{
      infringements,
      keywords,
      notifications,
      recentActivity,
      isMobileMenuOpen,
      toggleMobileMenu,
      theme,
      toggleTheme,
      isLoading,
      isConfigured,
      reportInfringement,
      dismissInfringement,
      undoInfringementStatus,
      addKeyword,
      deleteKeyword,
      addNotification,
      removeNotification,
      resetData,
      assets,
      assetsLoading,
      addAsset,
      deleteAsset,
      getAssetURL,
      getAssetBase64,
      createInfringementFromSearch,
      takedownRequests,
      requestTakedown,
      updateTakedownStatus,
      getTakedownForCase,
      addCaseUpdate,
      getCaseUpdates,
      markUpdatesAsRead,
      getUnreadUpdateCount
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};
