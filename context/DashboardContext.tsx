import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { MOCK_INFRINGEMENTS, MOCK_KEYWORDS, MOCK_ACTIVITY } from '../constants';
import { InfringementItem, KeywordItem, ActivityLogItem, PlatformType, PersistedAsset, VisionSearchResult } from '../types';
import { assetDB, StoredAsset } from '../lib/indexeddb';
import { fileToArrayBuffer, arrayBufferToObjectURL, getMimeType, getAssetType, readTextContent } from '../lib/asset-utils';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
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
  createInfringementFromSearch: (result: VisionSearchResult, originalAsset: PersistedAsset) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// Helper to generate more mock data
const generateExtendedMocks = (base: InfringementItem[], count: number): InfringementItem[] => {
  const newItems: InfringementItem[] = [...base];
  const platforms: PlatformType[] = ['Instagram', 'Meta Ads', 'Shopify', 'TikTok Shop', 'Amazon', 'AliExpress'];
  const brandNames = ['PrimeTrendz', 'LuxeLife', 'UrbanKick'];
  
  // Use a fixed start date relative to now to ensure data looks recent but distributed
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    const id = `generated-${i}`;
    
    // Weighted Similarity Score Generation to ensure varied histogram heights
    // Previous logic was uniform (60-100), causing all bars to look the same height.
    const rand = Math.random();
    let similarity;

    if (rand < 0.10) {
        // 10% chance: 90-100 (Critical) - Fewer critical items usually
        similarity = Math.floor(Math.random() * 11) + 90;
    } else if (rand < 0.35) {
        // 25% chance: 80-89 (High)
        similarity = Math.floor(Math.random() * 10) + 80;
    } else if (rand < 0.75) {
        // 40% chance: 70-79 (Medium) - Most common
        similarity = Math.floor(Math.random() * 10) + 70;
    } else if (rand < 0.95) {
        // 20% chance: 60-69 (Low)
        similarity = Math.floor(Math.random() * 10) + 60;
    } else {
        // 5% chance: <60 (Noise/False Positives)
        similarity = Math.floor(Math.random() * 40) + 20;
    }
    
    // Generate date within last 90 days, weighted slightly towards recent
    const timeOffset = Math.floor(Math.random() * ninetyDaysMs);
    const date = new Date(now - timeOffset);
    
    // Random status distribution
    const statusRand = Math.random();
    let status: InfringementItem['status'] = 'pending';
    if (statusRand > 0.7) status = 'reported';
    else if (statusRand > 0.6) status = 'takedown_in_progress';
    else if (statusRand > 0.55) status = 'takedown_confirmed';

    newItems.push({
      id,
      brandName: brandNames[Math.floor(Math.random() * brandNames.length)],
      isTrademarked: Math.random() > 0.5,
      originalImage: `https://picsum.photos/id/${(i * 3) % 100 + 10}/400/400`,
      copycatImage: `https://picsum.photos/id/${(i * 3) % 100 + 10}/400/400?grayscale`,
      similarityScore: similarity,
      siteVisitors: Math.floor(Math.random() * 50000) + 100,
      platform,
      revenueLost: Math.floor(Math.random() * 2000) + 50,
      status,
      detectedAt: date.toISOString().split('T')[0],
      country: ['US', 'CN', 'UK', 'RU', 'BR', 'IN'][Math.floor(Math.random() * 6)],
      infringingUrl: `https://fake-shop-${i}.com/product`,
      sellerName: `Store_${Math.random().toString(36).substring(7)}`,
      whois: { registrar: 'NameCheap', creationDate: '2023-01-01', registrantCountry: 'Panama' },
      hosting: { provider: 'Cloudflare', ipAddress: '192.168.1.1' }
    });
  }
  return newItems;
};

export const DashboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- Persistence Logic ---
  
  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'dark';
  });

  // Infringements
  const [infringements, setInfringements] = useState<InfringementItem[]>(() => {
    const saved = localStorage.getItem('infringements');
    if (saved) return JSON.parse(saved);
    // If no data, populate with expanded mocks (150 items for better chart density)
    return generateExtendedMocks(MOCK_INFRINGEMENTS, 150); 
  });

  // Keywords
  const [keywords, setKeywords] = useState<KeywordItem[]>(() => {
    const saved = localStorage.getItem('keywords');
    return saved ? JSON.parse(saved) : MOCK_KEYWORDS;
  });

  // Activity
  const [recentActivity, setRecentActivity] = useState<ActivityLogItem[]>(() => {
    const saved = localStorage.getItem('recentActivity');
    return saved ? JSON.parse(saved) : MOCK_ACTIVITY;
  });

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Asset management state
  const [assets, setAssets] = useState<PersistedAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetURLCache] = useState<Map<string, string>>(new Map());

  // --- Effects to Save Data ---

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('infringements', JSON.stringify(infringements));
  }, [infringements]);

  useEffect(() => {
    localStorage.setItem('keywords', JSON.stringify(keywords));
  }, [keywords]);

  useEffect(() => {
    localStorage.setItem('recentActivity', JSON.stringify(recentActivity));
  }, [recentActivity]);

  // Load assets from IndexedDB on mount
  useEffect(() => {
    const loadAssets = async () => {
      try {
        await assetDB.init();
        const storedAssets = await assetDB.getAllAssets();
        setAssets(storedAssets.map(a => ({
          id: a.id,
          type: a.type,
          name: a.name,
          mimeType: a.mimeType,
          protected: a.protected,
          dateAdded: a.dateAdded,
          sourceUrl: a.sourceUrl,
          content: a.content
        })));
      } catch (error) {
        console.error('Failed to load assets:', error);
      } finally {
        setAssetsLoading(false);
      }
    };
    loadAssets();
  }, []);

  // --- Actions ---

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const addNotification = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  };

  const addActivity = (action: string, target: string, type: ActivityLogItem['type'] = 'info') => {
      const newLog: ActivityLogItem = {
          id: Date.now().toString(),
          action,
          target,
          user: 'You',
          timestamp: new Date(),
          type,
          icon: type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️'
      };
      setRecentActivity(prev => [newLog, ...prev]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const reportInfringement = (id: string) => {
    const item = infringements.find(i => i.id === id);
    setInfringements(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'reported' } : item
    ));
    addNotification('success', 'Infringement reported successfully');
    if (item) addActivity('Takedown Issued', item.brandName + ' on ' + item.platform, 'success');
  };

  const dismissInfringement = (id: string) => {
    const item = infringements.find(i => i.id === id);
    setInfringements(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'dismissed' } : item
    ));
    addNotification('info', 'Case dismissed');
    if (item) addActivity('Case Dismissed', item.brandName, 'info');
  };

  const undoInfringementStatus = (id: string) => {
    setInfringements(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'pending' } : item
    ));
    addNotification('info', 'Status reverted to Pending');
    addActivity('Status Reverted', 'Case #' + id, 'warning');
  };

  const addKeyword = (text: string, type: 'active' | 'negative' | 'suggested') => {
    const newKw: KeywordItem = {
        id: Date.now().toString(),
        text,
        tags: ['Manual'],
        matches: 0,
        type,
        trend: 'stable'
    };
    setKeywords(prev => [...prev, newKw]);
    addNotification('success', `Keyword "${text}" added`);
    addActivity('Keyword Added', text, 'info');
  };

  const deleteKeyword = (id: string) => {
    const kw = keywords.find(k => k.id === id);
    setKeywords(prev => prev.filter(k => k.id !== id));
    addNotification('info', 'Keyword removed');
    if (kw) addActivity('Keyword Removed', kw.text, 'warning');
  };

  // Asset management methods
  const addAsset = useCallback(async (file: File): Promise<string> => {
    const id = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mimeType = getMimeType(file);
    const type = getAssetType(mimeType);

    let content: string | undefined;
    if (type === 'text') {
      try {
        content = await readTextContent(file);
      } catch {
        content = 'Unable to read text content';
      }
    }

    const buffer = await fileToArrayBuffer(file);

    const storedAsset: StoredAsset = {
      id,
      type,
      name: file.name,
      mimeType,
      data: buffer,
      protected: true,
      dateAdded: Date.now(),
      content
    };

    await assetDB.addAsset(storedAsset);

    const persistedAsset: PersistedAsset = {
      id,
      type,
      name: file.name,
      mimeType,
      protected: true,
      dateAdded: Date.now(),
      content
    };

    setAssets(prev => [persistedAsset, ...prev]);
    addActivity('Asset Added', file.name, 'success');

    return id;
  }, []);

  const deleteAsset = useCallback(async (id: string): Promise<void> => {
    const asset = assets.find(a => a.id === id);
    await assetDB.deleteAsset(id);

    // Revoke cached URL if exists
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
  }, [assets, assetURLCache]);

  const getAssetURL = useCallback(async (id: string): Promise<string> => {
    // Check cache first
    const cached = assetURLCache.get(id);
    if (cached) return cached;

    const stored = await assetDB.getAsset(id);
    if (!stored) throw new Error('Asset not found');

    const url = arrayBufferToObjectURL(stored.data, stored.mimeType);
    assetURLCache.set(id, url);
    return url;
  }, [assetURLCache]);

  const getAssetBase64 = useCallback(async (id: string): Promise<string> => {
    const stored = await assetDB.getAsset(id);
    if (!stored) throw new Error('Asset not found');

    const bytes = new Uint8Array(stored.data);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }, []);

  const createInfringementFromSearch = useCallback((result: VisionSearchResult, originalAsset: PersistedAsset) => {
    const domain = new URL(result.url).hostname;
    const platforms: PlatformType[] = ['Instagram', 'Meta Ads', 'Shopify', 'TikTok Shop', 'Amazon', 'AliExpress'];

    // Try to determine platform from domain
    let platform: PlatformType = 'Shopify'; // default
    if (domain.includes('instagram')) platform = 'Instagram';
    else if (domain.includes('facebook') || domain.includes('meta')) platform = 'Meta Ads';
    else if (domain.includes('tiktok')) platform = 'TikTok Shop';
    else if (domain.includes('amazon')) platform = 'Amazon';
    else if (domain.includes('aliexpress')) platform = 'AliExpress';

    const newInfringement: InfringementItem = {
      id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      brandName: originalAsset.name.split('.')[0],
      isTrademarked: false,
      originalImage: '', // Will be loaded from IndexedDB when displayed
      copycatImage: result.fullMatchingImages[0] || result.partialMatchingImages[0] || '',
      similarityScore: result.score ? Math.round(result.score * 100) : 75,
      siteVisitors: Math.floor(Math.random() * 10000) + 100,
      platform,
      revenueLost: Math.floor(Math.random() * 1000) + 50,
      status: 'pending',
      detectedAt: new Date().toISOString().split('T')[0],
      country: 'Unknown',
      infringingUrl: result.url,
      sellerName: domain
    };

    setInfringements(prev => [newInfringement, ...prev]);
    addNotification('success', 'Infringement added from search');
    addActivity('Infringement Detected', `Found on ${domain}`, 'warning');
  }, []);

  const resetData = () => {
      localStorage.clear();
      window.location.reload();
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
      reportInfringement,
      dismissInfringement,
      undoInfringementStatus,
      addKeyword,
      deleteKeyword,
      addNotification,
      removeNotification,
      resetData,
      // Asset management
      assets,
      assetsLoading,
      addAsset,
      deleteAsset,
      getAssetURL,
      getAssetBase64,
      createInfringementFromSearch
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