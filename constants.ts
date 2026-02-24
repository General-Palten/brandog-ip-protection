import { InfringementItem, KeywordItem, PlatformType, InfringementStatus, ActivityLogItem, CaseUpdateType, AuditLogActionType, PlanTier, JobTitle, BrandRole, DashboardView, DateFormatPreference, AuditLogEntry } from './types';

export const PLATFORM_CONFIG: Record<PlatformType, { label: string, color: string, category: 'social' | 'marketplace' }> = {
  'Meta Ads': { label: 'Meta Ads', color: 'blue', category: 'social' },
  'Instagram': { label: 'Instagram', color: 'pink', category: 'social' },
  'TikTok Shop': { label: 'TikTok Shop', color: 'black', category: 'social' },
  'Amazon': { label: 'Amazon', color: 'orange', category: 'marketplace' },
  'AliExpress': { label: 'AliExpress', color: 'red', category: 'marketplace' },
  'eBay': { label: 'eBay', color: 'blue', category: 'marketplace' },
  'Shopify': { label: 'Shopify', color: 'green', category: 'marketplace' },
  'Walmart': { label: 'Walmart', color: 'blue', category: 'marketplace' },
  'Etsy': { label: 'Etsy', color: 'orange', category: 'marketplace' },
  'Redbubble': { label: 'Redbubble', color: 'red', category: 'marketplace' },
  'Printerval': { label: 'Printerval', color: 'purple', category: 'marketplace' },
  'Website': { label: 'Website', color: 'gray', category: 'marketplace' }
};

export const STATUS_CONFIG: Record<InfringementStatus, { label: string, className: string }> = {
  'detected': { label: 'Detected', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  'pending_review': { label: 'Pending Review', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  'in_progress': { label: 'In Progress', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  'resolved': { label: 'Resolved', className: 'bg-green-100 text-green-700 border-green-200' },
  'rejected': { label: 'Rejected', className: 'bg-gray-100 text-gray-600 border-gray-200' }
};

// Predefined case update types for lawyer-client communication
export const CASE_UPDATE_TYPES: { type: CaseUpdateType; label: string; description: string; isPositive: boolean }[] = [
  {
    type: 'takedown_initiated',
    label: 'Takedown Initiated',
    description: 'We have initiated the takedown process for this case.',
    isPositive: false
  },
  {
    type: 'platform_contacted',
    label: 'Platform Contacted',
    description: 'We have contacted the platform\'s abuse/legal team.',
    isPositive: false
  },
  {
    type: 'dmca_sent',
    label: 'DMCA Notice Sent',
    description: 'A formal DMCA takedown notice has been submitted.',
    isPositive: false
  },
  {
    type: 'awaiting_response',
    label: 'Awaiting Response',
    description: 'Waiting for the platform to respond to our request.',
    isPositive: false
  },
  {
    type: 'follow_up_sent',
    label: 'Follow-up Sent',
    description: 'We have sent a follow-up to expedite the process.',
    isPositive: false
  },
  {
    type: 'escalated',
    label: 'Case Escalated',
    description: 'This case has been escalated for priority handling.',
    isPositive: false
  },
  {
    type: 'content_removed',
    label: 'Content Removed',
    description: 'The infringing content has been successfully removed!',
    isPositive: true
  },
  {
    type: 'case_closed',
    label: 'Case Closed',
    description: 'This case has been resolved and closed.',
    isPositive: true
  }
];

export const MOCK_ACTIVITY: ActivityLogItem[] = [
  {
    id: '1',
    action: 'High Risk Infringement',
    target: 'Nike Air Jordan Copy detected on Shopify',
    user: 'System',
    timestamp: new Date(),
    type: 'danger',
    icon: '🚨'
  },
  {
    id: '2',
    action: 'Takedown Confirmed',
    target: 'AliExpress listing #8829 removed successfully',
    user: 'System',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    type: 'success',
    icon: '✅'
  },
  {
    id: '3',
    action: 'New Report Ready',
    target: 'Q3 Brand Protection Summary available for download',
    user: 'System',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    type: 'info',
    icon: '📊'
  },
  {
    id: '4',
    action: 'Keyword Added',
    target: '"Super Max" added to watch list',
    user: 'Viktor',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    type: 'info',
    icon: '📝'
  }
];

export const MOCK_INFRINGEMENTS: InfringementItem[] = [
  {
    id: '1',
    brandName: 'PrimeTrendz',
    isTrademarked: true,
    originalImage: 'https://picsum.photos/id/20/400/400',
    copycatImage: 'https://picsum.photos/id/20/400/400?grayscale', 
    similarityScore: 100,
    siteVisitors: 7500,
    platform: 'Meta Ads',
    revenueLost: 250,
    status: 'detected',
    detectedAt: '2023-10-25',
    country: 'US',
    infringingUrl: 'https://super-deals-daily.com/products/notebook',
    sellerName: 'SuperDeals Daily',
    whois: { registrar: 'GoDaddy.com, LLC', creationDate: '2023-09-01', registrantCountry: 'US' },
    hosting: { provider: 'Cloudflare', ipAddress: '104.21.55.2' }
  },
  {
    id: '2',
    brandName: 'PrimeTrendz',
    isTrademarked: false,
    originalImage: 'https://picsum.photos/id/119/400/400',
    copycatImage: 'https://picsum.photos/id/119/400/400?blur=1',
    similarityScore: 100,
    siteVisitors: 60000,
    platform: 'Instagram',
    revenueLost: 250,
    status: 'detected',
    detectedAt: '2023-10-24',
    country: 'CN',
    infringingUrl: 'https://instagram.com/cheap_textures_official',
    sellerName: 'Cheap Textures Official',
    whois: { registrar: 'MarkMonitor Inc.', creationDate: '2010-10-06', registrantCountry: 'US' },
    hosting: { provider: 'Meta Platforms', ipAddress: '157.240.229.174' }
  },
  {
    id: '3',
    brandName: 'PrimeTrendz',
    isTrademarked: false,
    originalImage: 'https://picsum.photos/id/250/400/400',
    copycatImage: 'https://picsum.photos/id/250/400/400?grayscale',
    similarityScore: 100,
    siteVisitors: 7500,
    platform: 'Shopify',
    revenueLost: 250,
    status: 'in_progress',
    detectedAt: '2023-10-23',
    country: 'US',
    infringingUrl: 'https://fast-tech-gear.myshopify.com',
    sellerName: 'Fast Tech Gear',
    whois: { registrar: 'Tucows Domains Inc.', creationDate: '2023-08-15', registrantCountry: 'CA' },
    hosting: { provider: 'Shopify Inc.', ipAddress: '23.227.38.65' }
  },
  {
    id: '4',
    brandName: 'PrimeTrendz',
    isTrademarked: false,
    originalImage: 'https://picsum.photos/id/338/400/400',
    copycatImage: 'https://picsum.photos/id/338/400/400',
    similarityScore: 50,
    siteVisitors: 15000,
    platform: 'TikTok Shop',
    revenueLost: 250,
    status: 'detected',
    detectedAt: '2023-10-22',
    country: 'UK',
    infringingUrl: 'https://shop.tiktok.com/view/product/123456',
    sellerName: 'ViralBeautyUK',
    whois: { registrar: 'TikTok Pte. Ltd.', creationDate: '2022-01-01', registrantCountry: 'SG' },
    hosting: { provider: 'ByteDance', ipAddress: '192.168.1.1' }
  },
  {
    id: '5',
    brandName: 'LuxeLife',
    isTrademarked: true,
    originalImage: 'https://picsum.photos/id/445/400/400', 
    copycatImage: 'https://picsum.photos/id/445/400/400?blur=2',
    similarityScore: 92,
    siteVisitors: 1200,
    platform: 'Amazon',
    revenueLost: 1200,
    status: 'detected',
    detectedAt: '2023-10-21',
    country: 'US',
    infringingUrl: 'https://amazon.com/dp/B08XYZ123',
    sellerName: 'KnockOff King',
    whois: { registrar: 'Amazon Registry Services', creationDate: '1995-01-01', registrantCountry: 'US' },
    hosting: { provider: 'AWS', ipAddress: '54.239.28.85' }
  },
  {
    id: '6',
    brandName: 'UrbanKick',
    isTrademarked: true,
    originalImage: 'https://picsum.photos/id/103/400/400', 
    copycatImage: 'https://picsum.photos/id/103/400/400?grayscale',
    similarityScore: 98,
    siteVisitors: 8900,
    platform: 'AliExpress',
    revenueLost: 450,
    status: 'detected',
    detectedAt: '2023-10-20',
    country: 'CN',
    infringingUrl: 'https://aliexpress.com/item/100500123456',
    sellerName: 'Shenzhen Dropship Co.',
    whois: { registrar: 'Alibaba Cloud Computing', creationDate: '2009-04-01', registrantCountry: 'CN' },
    hosting: { provider: 'Alibaba Cloud', ipAddress: '47.88.1.1' }
  }
];

export const MOCK_KEYWORDS: KeywordItem[] = [
  { id: '1', text: 'PrimeTrendz', tags: ['Brand Name'], matches: 124, type: 'active', trend: 'stable' },
  { id: '2', text: 'Super Grip Socks', tags: ['Product'], matches: 45, type: 'active', trend: 'up' },
  { id: '3', text: 'LuxeLife', tags: ['Brand Name'], matches: 89, type: 'active', trend: 'down' },
  { id: '4', text: 'UrbanKick', tags: ['Brand Name'], matches: 202, type: 'active', trend: 'up' },
  { id: '5', text: 'Ergonomic Mouse', tags: ['Generic'], matches: 1500, type: 'active', trend: 'stable' },
  // Negative
  { id: '6', text: 'Prime Reviews', tags: ['Review Site'], matches: 0, type: 'negative' },
  { id: '7', text: 'Used', tags: ['Condition'], matches: 0, type: 'negative' },
  // Suggested
  { id: '8', text: 'Prime Trendz Scam', tags: ['Reputation'], matches: 12, type: 'suggested' },
  { id: '9', text: 'Cheap LuxeLife', tags: ['Competitor'], matches: 56, type: 'suggested' },
];

export const MOCK_ASSETS = [
  { id: '1', type: 'image', url: 'https://picsum.photos/id/20/400/400', name: 'Product Shot - Notebook', protected: true },
  { id: '2', type: 'image', url: 'https://picsum.photos/id/119/400/400', name: 'Texture Detail', protected: false },
  { id: '3', type: 'image', url: 'https://picsum.photos/id/250/400/400', name: 'Tech Camera V1', protected: true },
  { id: '4', type: 'image', url: 'https://picsum.photos/id/103/400/400', name: 'Sneaker Side Profile', protected: true },
  { id: '5', type: 'image', url: 'https://picsum.photos/id/445/400/400', name: 'Lifestyle Shoot', protected: true },
];

export const MOCK_WHITELIST = [
  { id: '1', name: 'Official Reseller UK', domain: 'reseller-uk.primetrendz.com', platform: 'Shopify', dateAdded: '2023-01-15' },
  { id: '2', name: 'Amazon Storefront', domain: 'amazon.com/shops/primetrendz', platform: 'Amazon', dateAdded: '2023-02-20' },
  { id: '3', name: 'Partner Distributor', domain: 'distributor-inc.com', platform: 'General Web', dateAdded: '2023-05-10' },
];

export const MOCK_DOCS = [
  { id: '1', name: 'US Trademark Registration', type: 'Trademark', regNumber: '88765432', status: 'Active', expiry: '2028-12-31' },
  { id: '2', name: 'EU IPO Certificate', type: 'Trademark', regNumber: '018234567', status: 'Active', expiry: '2029-06-15' },
  { id: '3', name: 'Copyright - Fall Collection', type: 'Copyright', regNumber: 'VAu 1-234-567', status: 'Pending', expiry: '-' },
];

export const NAV_CATEGORIES = [
  { title: "Products", items: [
    { id: 'search', label: 'Infringements', icon: 'Search' },
    { id: 'keywords', label: 'Keywords', icon: 'Type' },
    { id: 'images', label: 'Images & Videos', icon: 'Image' },
    { id: 'whitelist', label: 'Whitelist', icon: 'UserCheck' },
    { id: 'report-bad', label: 'Report Bad Actor', icon: 'UserX' },
    { id: 'docs', label: 'IP Documents', icon: 'FileText' },
  ]},
  { title: "Data", items: [
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { id: 'report-gen', label: 'Report Generator', icon: 'FileBarChart' },
  ]}
];

// Settings - Plan Tiers
export const PLAN_TIERS: Record<PlanTier, { name: string; price: number; features: Record<string, string | number | boolean> }> = {
  free: {
    name: 'Free',
    price: 0,
    features: {
      monthlyScans: 100,
      keywords: 5,
      teamSeats: 1,
      prioritySupport: false,
      apiAccess: false,
      customReports: false,
    }
  },
  pro: {
    name: 'Pro',
    price: 99,
    features: {
      monthlyScans: 1000,
      keywords: 50,
      teamSeats: 10,
      prioritySupport: 'Email',
      apiAccess: true,
      customReports: true,
    }
  },
  enterprise: {
    name: 'Enterprise',
    price: 499,
    features: {
      monthlyScans: 'Unlimited',
      keywords: 'Unlimited',
      teamSeats: 'Unlimited',
      prioritySupport: 'Dedicated',
      apiAccess: true,
      customReports: true,
    }
  }
};

// Settings - Log Action Types
export const LOG_ACTION_TYPES: Record<AuditLogActionType, { label: string; icon: string; color: string }> = {
  detection: { label: 'Detection', icon: 'AlertTriangle', color: 'orange' },
  takedown: { label: 'Takedown', icon: 'Shield', color: 'blue' },
  case_update: { label: 'Case Update', icon: 'FileText', color: 'purple' },
  resolution: { label: 'Resolution', icon: 'CheckCircle', color: 'green' },
  scan: { label: 'Scan', icon: 'Search', color: 'cyan' },
  keyword: { label: 'Keyword', icon: 'Type', color: 'pink' },
  user_action: { label: 'User Action', icon: 'User', color: 'gray' },
  security: { label: 'Security', icon: 'Lock', color: 'red' },
  report: { label: 'Report', icon: 'BarChart3', color: 'indigo' },
};

// Settings - Job Titles
export const JOB_TITLES: Record<JobTitle, string> = {
  brand_manager: 'Brand Manager',
  legal_counsel: 'Legal Counsel',
  ceo_founder: 'CEO/Founder',
  marketing_director: 'Marketing Director',
  ip_specialist: 'IP Specialist',
  other: 'Other',
};

// Settings - Brand Roles
export const BRAND_ROLES: Record<BrandRole, string> = {
  primary_contact: 'Primary Contact',
  team_member: 'Team Member',
  external_counsel: 'External Counsel',
  auditor: 'Auditor',
};

// Settings - Dashboard Views
export const DASHBOARD_VIEWS: Record<DashboardView, string> = {
  overview: 'Overview',
  recent_detections: 'Recent Detections',
  active_cases: 'Active Cases',
};

// Settings - Date Formats
export const DATE_FORMATS: Record<DateFormatPreference, string> = {
  'MM/DD/YYYY': 'MM/DD/YYYY (US)',
  'DD/MM/YYYY': 'DD/MM/YYYY (EU)',
  'YYYY-MM-DD': 'YYYY-MM-DD (ISO)',
};

// Settings - Common Timezones
export const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
];

// Settings - Mock Audit Logs
export const MOCK_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: '1',
    actionType: 'detection',
    title: 'New infringement detected',
    target: 'High similarity match on AliExpress - Fake brand sneakers',
    user: 'System',
    timestamp: new Date().toISOString(),
    level: 'warning',
  },
  {
    id: '2',
    actionType: 'takedown',
    title: 'Takedown request submitted',
    target: 'Amazon listing #B08XYZ123 - KnockOff King seller',
    user: 'Viktor',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    level: 'info',
  },
  {
    id: '3',
    actionType: 'resolution',
    title: 'Content removed',
    target: 'Instagram post by @cheap_textures_official',
    user: 'System',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    level: 'success',
  },
  {
    id: '4',
    actionType: 'scan',
    title: 'Asset scan completed',
    target: '45 assets scanned, 3 potential matches found',
    user: 'System',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    level: 'info',
  },
  {
    id: '5',
    actionType: 'keyword',
    title: 'Keyword added',
    target: '"Super Max" added to watch list',
    user: 'Viktor',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    level: 'info',
  },
  {
    id: '6',
    actionType: 'security',
    title: '2FA enabled',
    target: 'Two-factor authentication activated via authenticator app',
    user: 'Viktor',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    level: 'success',
  },
  {
    id: '7',
    actionType: 'case_update',
    title: 'Case escalated',
    target: 'Shopify case #3 escalated to priority handling',
    user: 'Legal Team',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    level: 'warning',
  },
  {
    id: '8',
    actionType: 'report',
    title: 'Weekly report generated',
    target: 'Q4 Week 3 Brand Protection Summary',
    user: 'System',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    level: 'info',
  },
  {
    id: '9',
    actionType: 'user_action',
    title: 'Settings updated',
    target: 'Notification preferences modified',
    user: 'Viktor',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    level: 'info',
  },
  {
    id: '10',
    actionType: 'detection',
    title: 'Repeat offender alert',
    target: 'Seller "Shenzhen Dropship Co." detected again on new listing',
    user: 'System',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 144).toISOString(),
    level: 'danger',
  },
];