import React from 'react';

export type PlatformType = 'Meta Ads' | 'Instagram' | 'Shopify' | 'TikTok Shop' | 'Amazon' | 'AliExpress' | 'eBay' | 'Website';

export type InfringementStatus = 'detected' | 'pending_review' | 'in_progress' | 'resolved' | 'rejected';

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
  originalAssetId?: string; // Links to PersistedAsset.id
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

// Predefined status update types for lawyers
export type CaseUpdateType =
  | 'takedown_initiated'
  | 'platform_contacted'
  | 'dmca_sent'
  | 'awaiting_response'
  | 'follow_up_sent'
  | 'escalated'
  | 'content_removed'
  | 'case_closed'
  | 'custom';

// Individual case update/message
export interface CaseUpdate {
  id: string;
  caseId: string;
  type: CaseUpdateType;
  message: string;
  createdAt: string;
  createdBy: 'lawyer' | 'system' | 'brand_owner';
  isRead: boolean;
}

export interface TakedownRequest {
  id: string;
  caseId: string;              // Links to InfringementItem.id
  originalAssetId: string;     // Links to PersistedAsset.id
  infringingUrl: string;
  detectedDate: string;        // ISO date
  platform: PlatformType;
  status: InfringementStatus;
  adminNotes?: string;
  requestedAt: string;         // ISO timestamp
  processedAt?: string;        // ISO timestamp when admin processed
  updates: CaseUpdate[];       // Case updates/messages for lawyer-client communication
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

export type AssetScanStatus = 'pending' | 'queued' | 'scanning' | 'success' | 'failed' | 'skipped';

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
  fingerprint?: string;
  scanStatus?: AssetScanStatus;
  scanAttempts?: number;
  lastScannedAt?: string;
  nextScanAt?: string;
  scanProvider?: string;
  lastScanError?: string;
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
  visuallySimilarImages: { url: string }[];
  webEntities: VisionWebEntity[];
}
