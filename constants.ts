import { InfringementItem, KeywordItem, PlatformType, InfringementStatus, ActivityLogItem } from './types';

export const PLATFORM_CONFIG: Record<PlatformType, { label: string, color: string }> = {
  'Meta Ads': { label: 'Meta Ads', color: 'blue' },
  'Instagram': { label: 'Instagram', color: 'pink' },
  'Shopify': { label: 'Shopify', color: 'green' },
  'TikTok Shop': { label: 'TikTok Shop', color: 'black' },
  'Amazon': { label: 'Amazon', color: 'orange' },
  'AliExpress': { label: 'AliExpress', color: 'red' }
};

export const STATUS_CONFIG: Record<InfringementStatus, { label: string, className: string }> = {
  'pending': { label: 'Pending Review', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  'reported': { label: 'Reported', className: 'bg-green-100 text-green-700 border-green-200' },
  'dismissed': { label: 'Dismissed', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  'takedown_in_progress': { label: 'In Progress', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  'takedown_confirmed': { label: 'Takedown Confirmed', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
};

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
    status: 'pending',
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
    status: 'pending',
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
    status: 'takedown_in_progress',
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
    status: 'pending',
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
    status: 'pending',
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
    status: 'pending',
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
    { id: 'search', label: 'Search Copycats', icon: 'Search' },
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