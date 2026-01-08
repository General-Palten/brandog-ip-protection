import React from 'react';

export type PlatformType = 'Meta Ads' | 'Instagram' | 'Shopify' | 'TikTok Shop' | 'Amazon' | 'AliExpress';

export type InfringementStatus = 'pending' | 'reported' | 'dismissed' | 'takedown_in_progress' | 'takedown_confirmed';

export interface InfringementItem {
  id: string;
  brandName: string;
  isTrademarked: boolean;
  originalImage: string;
  copycatImage: string;
  similarityScore: number;
  siteVisitors: number;
  platform: PlatformType;
  revenueLost: number;
  status: InfringementStatus;
  detectedAt: string; // ISO date
  country: string;
  // Enhanced Data
  infringingUrl?: string;
  sellerName?: string;
  whois?: {
    registrar: string;
    creationDate: string;
    registrantCountry: string;
  };
  hosting?: {
    provider: string;
    ipAddress: string;
  };
}

export interface ActivityLogItem {
  id: string;
  action: string;
  target: string;
  user: string;
  timestamp: Date;
  icon?: string;
  type: 'info' | 'warning' | 'success' | 'danger';
}

export interface StatMetric {
  label: string;
  value: string | number;
  prefix?: string;
  actionLabel?: string;
  onAction?: () => void;
  infoTooltip?: string;
}

export interface SidebarLink {
  // Added React import at the top to resolve this type
  icon: React.ElementType;
  label: string;
  id: string;
  badge?: number;
}

export interface KeywordItem {
  id: string;
  text: string;
  tags: string[];
  matches: number;
  type: 'active' | 'negative' | 'suggested';
  trend?: 'up' | 'down' | 'stable';
}

// Persisted asset type (metadata only - binary data stays in IndexedDB)
export interface PersistedAsset {
  id: string;
  type: 'image' | 'video' | 'text';
  name: string;
  mimeType: string;
  protected: boolean;
  dateAdded: number;
  sourceUrl?: string;
  content?: string;
}

// Vision API search result types
export interface VisionSearchResult {
  url: string;
  pageTitle?: string;
  fullMatchingImages: string[];
  partialMatchingImages: string[];
  score?: number;
}

export interface VisionWebEntity {
  entityId: string;
  description: string;
  score: number;
}

export interface VisionSearchResponse {
  pagesWithMatchingImages: VisionSearchResult[];
  fullMatchingImages: { url: string }[];
  partialMatchingImages: { url: string }[];
  webEntities: VisionWebEntity[];
}