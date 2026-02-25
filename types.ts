import React from 'react';

export type PlatformType = 'Meta Ads' | 'Instagram' | 'Shopify' | 'TikTok Shop' | 'Amazon' | 'AliExpress' | 'eBay' | 'Website' | 'Walmart' | 'Etsy' | 'Redbubble' | 'Printerval';

export type InfringementStatus =
  | 'detected'
  | 'pending_review'
  | 'needs_member_input'
  | 'in_progress'
  | 'resolved_success'
  | 'resolved_partial'
  | 'resolved_failed'
  | 'dismissed_by_member'
  | 'dismissed_by_admin';

// Priority levels for infringement cases
export type InfringementPriority = 'high' | 'medium' | 'low';
export type PrioritySetBy = 'member' | 'admin' | 'auto';

// Dismiss reasons when member or admin dismisses a case
export type DismissReason =
  | 'licensed_authorized'
  | 'not_our_product'
  | 'insufficient_evidence'
  | 'other';

export interface TrademarkMatch {
  name: string;              // e.g., "Brand A"
  foundIn: string;           // e.g., "t-shirt graphic"
  matchingProducts: string[]; // e.g., ["Shirts", "Graphic T-shirts"]
}

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
  detectionProvider?: string;
  detectionMethod?: string;
  sourceFingerprint?: string;
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
  // Enhanced modal fields
  images?: string[];              // Multiple images for carousel
  trademarkMatches?: TrademarkMatch[]; // Trademark matches found
  analysisText?: string;          // AI analysis text
  autoTakedown?: boolean;         // Whether auto-takedown is enabled
  // Priority and workflow fields
  priority?: InfringementPriority;      // Case priority level
  prioritySetBy?: PrioritySetBy;        // Who set the priority
  dismissReason?: DismissReason;        // Reason for dismissal (if dismissed)
  dismissReasonText?: string;           // Custom text if dismissReason is 'other'
  retryCount?: number;                  // Number of retry attempts for failed cases
}

// Predefined status update types for case workflow
export type CaseUpdateType =
  // Admin/lawyer actions
  | 'takedown_initiated'
  | 'platform_contacted'
  | 'dmca_sent'
  | 'awaiting_response'
  | 'follow_up_sent'
  | 'escalated'
  | 'content_removed'
  | 'case_closed'
  // New workflow types
  | 'sent_back_to_member'    // Admin requests more info from member
  | 'member_responded'        // Member responded to admin request
  | 'member_withdrew'         // Member withdrew the request
  | 'retry_requested'         // Member requested retry on failed case
  | 'priority_changed'        // Priority was changed
  | 'evidence_added'          // Additional evidence was added
  | 'enforcement_requested'   // Member requested enforcement
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

export type ScanEventStatus = 'queued' | 'success' | 'failed' | 'skipped';

export interface ScanEventItem {
  id: string;
  assetId: string | null;
  provider: string;
  status: ScanEventStatus;
  startedAt: string;
  finishedAt?: string;
  matchesFound: number;
  duplicatesSkipped: number;
  invalidResults: number;
  failedResults: number;
  estimatedCostUsd?: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
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

// Settings - Audit Log Types
export type AuditLogActionType =
  | 'detection'
  | 'takedown'
  | 'case_update'
  | 'resolution'
  | 'scan'
  | 'keyword'
  | 'user_action'
  | 'security'
  | 'report';

export type AuditLogLevel = 'info' | 'warning' | 'success' | 'danger';

export interface AuditLogEntry {
  id: string;
  actionType: AuditLogActionType;
  title: string;
  target: string;
  user: string;
  timestamp: string;
  level: AuditLogLevel;
}

// Settings - Notification Preferences
export interface DetectionAlertSettings {
  highSeverity: { enabled: boolean; frequency: 'instant' | 'digest' };
  mediumSeverity: { enabled: boolean; frequency: 'daily' | 'weekly' };
  lowSeverity: { enabled: boolean; frequency: 'weekly' };
  newPlatformDetection: boolean;
  repeatOffenderAlert: boolean;
}

export interface CaseProgressAlertSettings {
  takedownInitiated: boolean;
  platformResponse: boolean;
  caseResolved: boolean;
  caseEscalated: boolean;
  weeklyProgressSummary: boolean;
}

export interface ReportSettings {
  weeklySummary: boolean;
  monthlyAnalytics: boolean;
  deliveryDay: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
  deliveryTime: string;
}

export interface CommunicationPreferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  smsForCritical: boolean;
  slackWebhookUrl: string;
  marketingEmails: boolean;
}

export interface NotificationPreferences {
  detectionAlerts: DetectionAlertSettings;
  caseProgressAlerts: CaseProgressAlertSettings;
  reportSettings: ReportSettings;
  communicationPreferences: CommunicationPreferences;
}

// Settings - Plan & Usage
export type PlanTier = 'free' | 'pro' | 'enterprise';

export interface PlanUsage {
  scansUsed: number;
  scansLimit: number;
  keywordsMonitored: number;
  keywordsLimit: number;
  assetsProtected: number;
  assetsLimit: number;
  teamSeats: number;
  teamSeatsLimit: number;
  apiCalls: number;
  apiCallsLimit: number;
  storageUsedGB: number;
  storageLimitGB: number;
}

export interface PlanInfo {
  tier: PlanTier;
  price: number;
  billingCycle: 'monthly' | 'annually';
  renewalDate: string;
}

// Settings - Session Management
export interface SessionInfo {
  id: string;
  device: string;
  browser: string;
  location: string;
  ipAddress: string;
  lastActive: string;
  isCurrent: boolean;
}

// Settings - Team Member
export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  avatarUrl?: string;
  lastActive: string;
}

// Settings - Profile Extensions
export type JobTitle =
  | 'brand_manager'
  | 'legal_counsel'
  | 'ceo_founder'
  | 'marketing_director'
  | 'ip_specialist'
  | 'other';

export type BrandRole =
  | 'primary_contact'
  | 'team_member'
  | 'external_counsel'
  | 'auditor';

export type DashboardView = 'overview' | 'recent_detections' | 'active_cases';

export type DateFormatPreference = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
